# NFC 图片发送协议与实现说明（EEPROM 方案）

> ⚠️ **本文档对应的 App 侧实现已于 2026-09-11 移除。**
>
> `data/nfc/`（含 `EInkEepromImageSender`、`Iso15693`、`St25dvFtm` 等）已整体删除，App 不再具备 NFC 图片发送能力。移除范围见 [20260911-移除墨水屏模块与电压位与P0真机验证-plan.md](./20260911-移除墨水屏模块与电压位与P0真机验证-plan.md)。
>
> **本文档作为硬件侧协议资料保留。** 其中定义的块顺序、确认机制、超时与 RF/I2C 竞态处理，是 ST25DV16K 硬件本身的既有约定，与 App 是否实现无关。若将来重新接入，请以本文档为协议依据。

## 1. 文档说明与策略选择

### 1.1 目的

本文档定义墨水屏挂件「手机 → ST25DV16K → STM32」的 **EEPROM 分块传输协议**，包括：  
先发送**清理 ST25 缓冲区命令**，再按「发送块 N → 等待 STM32 确认 → 发送块 N+1」的严格顺序发送；并明确**中断、超时、RF/I2C 竞态**等处理方式。

### 1.2 FTM 与 EEPROM 分工

- **EEPROM 方案**：作为**主路径**，使用 ISO15693 标准命令（Read/Write Single Block），兼容性好，避免 Android 端对 ST 厂商命令（0xCA/0xAD）支持不稳导致的 transceive failed / Tag lost。
- **FTM 方案**：**保留现有代码**（如 `EInkNfcImageSender`、`St25dvFtm`、`EInkFtmImageSender`），不在默认发送流程中使用；后续可在兼容性好的设备上作为可选加速路径。

### 1.3 容量与块大小

- ST25DV16K 用户 EEPROM 总容量：**2KB（2048 字节）**。
- 采用「控制区 + 单块数据区」布局，**数据区用满剩余空间**，减少往返次数：
  - **控制区**：128 字节（0x0000 ～ 0x007F）
  - **数据区**：**1920 字节**（0x0080 ～ 0x07FF），即单块最大 1920 字节
- 单张图片约 8KB（黑平面 4KB + 红平面 4KB），块数：`ceil(8000 / 1920) = 5` 块。

---

## 2. EEPROM 布局（2KB 总容量）

### 2.1 地址分配

| 区域       | 起始地址 | 长度（字节） | 说明                                       |
| ---------- | -------- | ------------ | ------------------------------------------ |
| 控制区     | 0x0000   | 128          | 协议头、状态、流控；APP 写 tx，STM32 写 rx |
| 数据缓冲区 | 0x0080   | 1920         | 当前块图像数据；APP 写，STM32 读           |

### 2.2 控制区结构（128 字节，小端）

与现有 `EInkNfcProtocol` 对齐，字段如下：

| 偏移    | 长度 | 字段            | 说明                                                           |
| ------- | ---- | --------------- | -------------------------------------------------------------- |
| 0..1    | 2    | magic           | 0x45, 0x49（"EI"）                                             |
| 2       | 1    | version         | 0x01                                                           |
| 3       | 1    | sessionId       | 每次发送自增（循环），用于清理/重试时区分会话                  |
| 4..5    | 2    | width           | 图像宽（u16），MVP=128                                         |
| 6..7    | 2    | height          | 图像高（u16），MVP=250                                         |
| 8       | 1    | format          | bit0=黑平面, bit1=红平面；MVP=0x03                             |
| 9       | 1    | txState         | APP 写：0=IDLE, 1=SENDING, 2=DONE, 3=ABORT                     |
| 10      | 1    | rxState         | STM32 写：0=IDLE, 1=RECEIVING, 2=APPLYING, 3=OK, 4=ERROR       |
| 11      | 1    | errorCode       | STM32 写（可选）                                               |
| 12..15  | 4    | totalBytes      | 整包图像字节数（u32），MVP=8000                                |
| 16..17  | 2    | chunkSize       | 每块字节数（u16），1920                                        |
| 18..19  | 2    | totalChunks     | 总块数（u16），5                                               |
| 20..21  | 2    | crc16_ccitt     | 整包 CRC16-CCITT（u16）                                        |
| 22..23  | 2    | txChunkIndex    | APP 写：当前已写入数据区的块序号（0..totalChunks-1）           |
| 24..25  | 2    | txChunkLen      | APP 写：本块有效字节数（最后一块可能 &lt; chunkSize）          |
| 26..27  | 2    | rxConsumedIndex | **STM32 写**：已消费块数（即「下一块期待序号」= 下一块 index） |
| 28..127 | 100  | 预留            | 填 0                                                           |

**流控语义**：

- APP 写入块 N 的数据到数据区，再写控制区 `txChunkIndex=N`、`txChunkLen=本块长度`。
- STM32 发现 `txChunkIndex == 当前期待块序号` 后，从数据区读走本块，然后写 `rxConsumedIndex = N+1`。
- APP 轮询控制区，当 `rxConsumedIndex > N`（即 >= N+1）时，才写入下一块，避免覆盖未读数据。

---

## 3. 清理 ST25 缓冲区命令

### 3.1 目的

- 发送新图前，使 STM32 与 ST25 控制区处于已知状态，避免旧会话残留导致串包或误解析。
- 明确表示「本次发送开始」，STM32 可丢弃未完成的旧会话并准备新会话。

### 3.2 做法

**方式 A（推荐）：写控制区复位状态**

1. APP 写入控制区至少前 28 字节，其中：
   - `magic` = 0x45, 0x49（保持有效）；
   - `txState` = **ABORT（3）** 或 **IDLE（0）**；
   - `sessionId` = **本次要用的新 sessionId**（与上一轮不同）；
   - 其余字段可为 0 或占位。
2. 可选：APP 轮询读控制区，直到 `rxState == IDLE(0)`（表示 STM32 已处理完复位并清空内部缓冲），再继续；若超时（如 2s）仍非 IDLE，可继续发或提示用户重试。

### 3.3 与「块发送」的顺序

1. **清理**：写控制区（ABORT + 新 sessionId），可选等待 rx_state=IDLE。
2. **写头部**：写控制区完整头部（magic, version, sessionId, width, height, format, totalBytes, chunkSize, totalChunks, crc16, tx_state=SENDING, txChunkIndex=0, txChunkLen=0 等），此时尚未写任何数据块。
3. **块 0**：写数据区 1920 字节（或最后一块 &lt; 1920），再写控制区 `txChunkIndex=0`、`txChunkLen=实际长度`。
4. **等确认**：轮询读控制区，直到 `rxConsumedIndex >= 1`（或 == 1，与 STM32 约定一致）。
5. **块 1**：写数据区，再写 `txChunkIndex=1`、`txChunkLen=…`；再等 `rxConsumedIndex >= 2`。
6. 依此类推，直到发完所有块。
7. **结束**：写 `tx_state=DONE`。

---

## 4. 发送流程（APP 侧严格顺序）

### 4.1 总序

1. **清理**：写控制区（ABORT + 新 sessionId），可选等待 rx_state=IDLE，超时可继续或提示重试。
2. **写头部**：写入完整控制区（含 sessionId, width, height, format, totalBytes, chunkSize, totalChunks, crc16, tx_state=SENDING）；txChunkIndex/txChunkLen 可先写 0。
3. **循环（块序号 k = 0 .. totalChunks-1）**：
   - **等待可写**：若 k &gt; 0，轮询读控制区直到 `rxConsumedIndex >= k`（表示 STM32 已消费完块 k-1）。
   - **写数据区**：将第 k 块图像数据（最多 1920 字节）写入数据区 0x0080 起。
   - **写控制区**：更新 `txChunkIndex=k`、`txChunkLen=本块实际长度`（仅更新这两字段或整块重写控制区均可，以实现简单为准）。
   - 若任意一步 NFC 失败（transceive 异常、Tag lost）：见第 6 节。
4. **结束**：写 `tx_state=DONE`；可选读 `rx_state` 展示 OK/ERROR。

### 4.2 读写顺序的意义（避免 RF 与 I2C 竞态）

- **先写数据区，再写控制区 txChunkIndex/txChunkLen**：  
  STM32 只有在看到 `txChunkIndex == 当前期待块` 时才去读数据区。若 APP 先写控制区再写数据区，STM32 可能提前读数据区，读到旧数据或半新半旧。因此顺序必须是：**先写数据区，再写控制区**。
- **等 rxConsumedIndex 再发下一块**：  
  APP 只有在 `rxConsumedIndex >= 当前块序号+1` 时才写下一块，保证 STM32 已读走当前块，避免覆盖未读数据。
- **STM32 侧**：发现 `txChunkIndex == 期待块` 后，**仅通过 I2C 读数据区**，读完后**再写**控制区 `rxConsumedIndex`。这样 RF 写与 I2C 读在时间上错开，ST25DV 内部对同一区域的并发访问由芯片仲裁，我们通过协议顺序降低冲突窗口。

---

## 5. STM32 侧要点（与 APP 对齐）

### 5.1 清理命令的处理

- 当检测到 `tx_state=ABORT` 或 `tx_state=IDLE`，且/或 `session_id` 与当前记录不同：
  - 立即丢弃当前接收会话（清空或重置接收缓冲与状态）；
  - 将 `rx_state` 置为 **IDLE**（写回控制区）；
  - 等待 APP 写入新会话头部（tx_state=SENDING、新 session_id 等）。

### 5.2 接收状态机（简要）

1. **IDLE**
   - 轮询控制区。
   - 若 magic 有效且 `tx_state=SENDING`，且 `session_id` 为新或与当前一致且 `tx_chunk_index==0`：
     - 解析 totalBytes、chunkSize、totalChunks、crc16 等，分配 8KB 缓冲；
     - 写回 `rx_state=RECEIVING`、`rx_consumed_index=0`；
     - 进入 RECEIVING，期待块 0。
2. **RECEIVING**
   - 对块序号 k = 0 .. totalChunks-1：
     - 轮询直到 `tx_chunk_index == k`（且 tx_state 仍为 SENDING、session_id 未变）；
     - **通过 I2C 从数据区 0x0080 读取本块**（长度为 `tx_chunk_len`，最多 1920）；
     - 写入 MCU 缓冲对应位置；
     - **写回控制区 `rx_consumed_index = k+1`**；
     - 若中途发现 tx_state=ABORT 或 session_id 变化，退回 IDLE。
3. **接收完成**
   - 当 k == totalChunks-1 且已读本块并写回 rx_consumed_index 后：
     - 校验整包 CRC16；
     - 成功：写 rx_state=APPLYING，刷屏，再写 rx_state=OK；
     - 失败：写 rx_state=ERROR、error_code。

### 5.3 I2C 与 RF 的协调

- ST25DV16K 支持 RF 与 I2C 同时访问，芯片内部有仲裁。
- 通过**协议顺序**减少竞态：
  - APP 只在「写数据区 → 写控制区 txChunkIndex」之后才认为「块就绪」；
  - STM32 只在「看到 txChunkIndex 匹配」后才读数据区，读完后才写 rxConsumedIndex。
- 若 STM32 在墨水屏刷新等阶段长时间占用 I2C，可能导致一段时间内无法及时写回 rxConsumedIndex；APP 端通过**轮询超时**（见下节）处理，不造成数据错乱，仅可能本次发送超时提示重试。

---

## 6. 异常与中断处理

### 6.1 发送过程中 Tag 丢失（手机移开、RF 中断）

- **现象**：transceive 抛异常或系统报「Tag was lost」。
- **处理**：
  - 本次发送视为失败，不再继续写下一块。
  - 若此时 NFC 仍可用，**尽量写一次控制区**：`tx_state=ABORT`（及当前 session_id），以便 STM32 回到 IDLE，不把半包当完整图解析。
  - 提示用户「请重新贴近挂件后重试」。

### 6.2 轮询 rxConsumedIndex 超时

- **原因**：STM32 未及时读块或未写回 rxConsumedIndex（例如 I2C 被其他任务占用、固件卡住、未正确写回）。
- **处理**：
  - 设置合理超时（如 5 ～ 10s per 块）。
  - 超时后：写 `tx_state=ABORT`（若还能写），并提示用户重试或检查设备。
  - 避免无限等待。

### 6.3 清理阶段超时（等待 rx_state=IDLE）

- 若选择「清理后等待 rx_state=IDLE」：
  - 超时（如 2s）后可直接进入写头部与发块流程，或提示用户重试。
  - 新 session_id 能帮助 STM32 区分旧会话，减少串包风险。

### 6.4 用户连续多次点击发送

- 每次发送使用**新的 session_id**（如自增循环）。
- STM32 见新 session_id 即丢弃旧会话并准备新图，避免混包。
- APP 可在发送中禁用「发送」按钮，防止重复触发。

### 6.5 STM32 复位或掉电

- 控制区可能保留旧数据。
- 下次发送前**先发清理命令**（ABORT + 新 session_id），STM32 上电后轮询到 ABORT 或新 session 会进入 IDLE，不会把旧控制区当有效任务。

### 6.6 数据区与控制区写入失败

- 某次 Write Single Block 失败：视为本次发送失败，写 ABORT（若可行），提示重试。
- 不做单块重传（MVP）；若需可后续扩展。

---

## 7. NfcV 读写方式（EEPROM）

- 使用 **ISO15693 标准命令**：
  - **Write Single Block**（0x21）写控制区/数据区；
  - **Read Single Block**（0x20）读控制区（轮询 rxConsumedIndex、rx_state）。
- ST25DV16K 常见 **Block 大小为 4 字节**；块号 = 字节地址 / 4。
  - 控制区：128 字节 → 32 个 block；
  - 数据区：1920 字节 → 480 个 block。
- 读写前可通过 Get System Info 获取 block 大小与块数，若不支持则按 4 字节/块处理。

---

## 8. Android 实现要点

### 8.1 保留 FTM 代码

- 保留现有 FTM 相关类（如 `EInkNfcImageSender`、`St25dvFtm`、`EInkFtmImageSender`），**默认发送路径改为 EEPROM**。
- 可在配置或后续版本中提供「尝试 FTM」选项，在兼容性好的设备上使用。

### 8.2 新增 EEPROM 发送器

- 实现 **EInkEepromImageSender**（或等效命名）：
  - 使用 `St25dvEInkLayout`（需将 DATA_LEN 调整为 1920，CONTROL 仍 128）；
  - 使用 `EInkNfcProtocol` 的 Control 编码/解码；
  - 流程：清理 → 写头部 → for each 块：等 rxConsumedIndex → 写数据区 → 写控制区 txChunkIndex/txChunkLen → 最后写 tx_state=DONE。
- 通过 Iso15693 **Read/Write Single Block** 封装对 EEPROM 的按块读写（按 4 字节或实际 block 大小）。

### 8.3 布局常量（与文档一致）

- `CONTROL_ADDR = 0x0000`，`CONTROL_LEN = 128`
- `DATA_ADDR = 0x0080`，`DATA_LEN = 1920`
- `chunkSize = 1920`，单张 8KB 图片 `totalChunks = 5`

---

## 9. 开发计划（TODO）

- [x] 更新 `St25dvEInkLayout`：DATA_LEN 改为 1920，DATA_ADDR 保持 0x0080。（已满足，无需改动）
- [x] 在 `Iso15693` 或单独模块中封装 EEPROM 按块读/写（0x20/0x21，支持 4B block）。
- [x] 实现 **EInkEepromImageSender**：清理命令 → 写头部 → 块循环（等确认 → 写数据区 → 写控制区）→ tx_state=DONE。
- [x] MainViewModel 中默认使用 EEPROM 发送器发送图片，保留 FTM 入口可选。
- [ ] STM32 固件：实现清理处理（ABORT/新 session_id → IDLE）、1920 字节/块的数据区读取、rx_consumed_index 写回与超时策略。
- [ ] 联调：验证清理 → 块 1 → 确认 → 块 2 → … 流程，以及 Tag 丢失、超时、重复发送等场景。

---

## 10. 小结

| 项目      | 说明                                                                                         |
| --------- | -------------------------------------------------------------------------------------------- |
| 主路径    | EEPROM，标准 ISO15693 0x20/0x21，兼容性好。                                                  |
| FTM       | 保留代码，不作为默认路径。                                                                   |
| 容量      | 2KB EEPROM：控制区 128B，数据区 1920B。                                                      |
| 流程      | 先发清理命令（ABORT + 新 sessionId），再写头部，再「写块 → 等 rxConsumedIndex → 写下一块」。 |
| 顺序      | 先写数据区，再写控制区 txChunkIndex/txChunkLen；等 STM32 写回 rxConsumedIndex 再发下一块。   |
| 异常      | Tag 丢失则写 ABORT 并提示重试；轮询超时则放弃并提示；新 session_id 防串包。                  |
| I2C 与 RF | 通过严格顺序错开 RF 写与 STM32 I2C 读，避免覆盖与误解析；STM32 慢时由 APP 轮询超时处理。     |

本文档为 NFC 图片发送的协议与实现依据，与 20260311 墨水屏挂件开发计划中的 EEPROM 部分一致，并在此基础上明确清理命令、2KB 数据区与异常处理。
