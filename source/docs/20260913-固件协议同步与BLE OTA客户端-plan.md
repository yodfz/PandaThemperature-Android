# 20260913 固件协议同步与 BLE OTA 客户端开发计划

日期：2026-09-13
上游文档：`APP-项目交接说明.md`、`docs/20260908-自动连接与电压展示-plan.md`、`docs/20260910-联调诊断与交付闭环-plan.md`、`docs/20260911-移除墨水屏模块与电压位与P0真机验证-plan.md`
固件侧权威依据：固件工程 `VERSION`（当前 `1.0.6+0`）、`OTA协议说明.md`、`source/ble/ble_ota.c` / `ble_ota.h`（外部仓库 `NRF52xxx-FieldTemp`）

## 需求背景

固件（nRF52810）刚完成一轮大改动，引入了**自定义极简 BLE OTA**，并调整了状态帧与历史记录语义。Android 端此前停留在对接「固件 v2」的认知上，存在两类问题：

1. **协议事实需要追平**：
   - 状态帧 `12340022` 由 8 字节扩为 **12 字节**，状态位新增 `bit3 墙钟可信`，能力字节 `[5]` 由 4 位扩为 **6 位**（新增 `0x10 墙钟边界对齐`、`0x20 对时后首窗可短`）。
   - `12340021` 语义由「采样间隔」改为「**历史记录间隔**」（60~3600 秒，默认 60）。
   - 历史记录**长度不变**（仍 12 字节/条 = 时间戳 u32 + 温度 i16 + 湿度 u16 + 气压 u32），但新增两类语义：周期记录时间戳**对齐整分边界**、新增「事件记录」（真实发生时刻、不对齐、两条之间至少间隔一个 history_interval）；对时后首个窗口可能不足一个周期。
   - 固件仍然**不上报电压**：实时帧 6 字节、历史 V2 12 字节，14 字节 V3 电压格式在现场固件中**不存在**。（**版本范围**：此为 **1.0.6 / 1.0.7** 的事实；**自固件 1.0.8 起**实时帧扩为 8 字节，`offset 6` 为小端 uint16 毫伏并新增无效哨兵 `0xFFFF`，App 侧对哨兵/越界值显示 `--`。1.0.6 / 1.0.7 仍为 6 字节，本条不改写。）
2. **存在一个会直接破坏历史解析的隐患**：既有 `DeviceProfileFactory` 用 `majorVersion >= 3 ⇒ ThermometerV3Profile（14 字节历史）` 的启发式选型。旧固件把版本号编码为「v1.2 → 12」这类两位整数，而**新固件在状态帧里上报的是 patch 号 6**。因此新固件会被误判为 V3 → 历史按 14 字节切分 → 全部记录错位。本轮必须修掉。

此外，**BLE OTA 是全新的用户可见能力**，App 侧此前完全没有对应代码，需要新增一整套协议、会话、传输与界面。

## 硬约束（沿用项目既有约定，不得违背）

1. **历史记录格式必须通过 `DeviceProfile` / 固件版本显式选择，绝不按数据包长度猜测。**（`APP-项目交接说明.md` §3.2 / §4.3）
2. 电压能力保持**预留**状态：固件不上报时 `-- V` 是预期行为，不得为了「看起来有数据」造假或改判定。（**版本范围**：1.0.6 / 1.0.7 的情况如上；**自 1.0.8 起**实时帧确实上报 8 字节电压，哨兵 `0xFFFF` 与越界值一律映射为 `--`，处理见 `20260908-自动连接与电压展示-plan.md` 末节。）
3. 遵循 `source/CLAUDE.md`：先写本文档；复用现有模块；逻辑按模块拆分，不堆进单文件；最小 MVP，不过度设计。
4. 本轮**只做代码、单元测试与 Debug/Release 构建验证**；不做真机 BLE 联调（团队正在用同一台设备做 OTA 栈修复复测，`CONFIG_BT_MAX_CONN=1`，安卓同时连接会打断）。
5. 不提交/改动 `local.properties`、`.gradle`、`.kotlin`、`app/build`、`keystore.properties`、`*.jks`；不执行 `git commit`/`git push`。

## 实现方案

### 一、协议同步（先修正确性隐患，再补新语义）

#### 1.1 修正固件版本 → Profile 选型（最高优先级）

- 现状：`DeviceProfileFactory.createThermometerProfile` 有 `majorVersion >= 3 → ThermometerV3Profile` 分支，会误抓 patch=6 的新固件。
- 改法：**版本号不再参与历史长度判定**。选型退化为两条显式路径：
  - 无实时数据服务且无有效版本号 → `ThermometerV1Profile`（8 字节历史，ESS 老固件）；
  - 有实时数据服务或有效版本号（> 0）→ `ThermometerV2Profile`（**12 字节历史**）。
- `ThermometerV3Profile` 与 `HistoryRecordFormat.V3`（14 字节，含电压）**保留**作为「电压预留能力」，但因固件未定义任何「历史含电压」的能力位，**不再由版本号自动选中**，KDoc 中写明：未来只有当固件显式提供能力标志时才可重新接入，禁止再用版本号猜测。
- `DeviceProfileFactory.isNewFirmware` 保持 >0 语义，行为等价。

#### 1.2 状态帧与能力位同步

`DeviceStatusParser`（按**绝对偏移**解析，向后兼容）与 `DeviceStatus` 模型补齐：

- 状态位 `[4]` 新增 `bit3 isWallClockTrusted`（墙钟可信；本次上电收到过手机对时才会置位；仅从 NVS 恢复旧时间时为 0）。
- 能力位 `[5]` 新增命名与便捷属性：
  - `bit3 historyIsPeriodMean`（历史为周期均值，已在意向文档描述，补属性）；
  - `bit4 supportsWallclockAlign`（墙钟边界对齐）；
  - `bit5 supportsPartialWindow`（对时后首个窗口可能短于一个周期）。
- `formatForLog` 输出补充「墙钟」与能力位十六进制，便于联调时在 `BLE诊断` 之外的设备状态日志里直接核对固件能力。

#### 1.3 历史记录新语义的落地方式

- 长度/偏移**不变**，因此解析器无需改动，**不做 V3 引入**。
- 「不对齐的事件记录 / 对时后首窗偏短」属于**显示层**语义。App 现有的列表与图表都以记录自带 `timestamp` 为准，不假设严格等间隔；本轮在计划与代码注释中显式记录该语义，并（在设备状态可读时）把「墙钟可信 / 事件记录支持」暴露给联调日志。
- 明确不做的事：不按时间戳等间隔补齐/造点；不因首窗短而告警。

#### 1.4 `12340021` 语义（已基本就位，做核对）

- 现有 `BleConstants.INTERVAL_CHAR`、`HISTORY_INTERVAL_MIN=60`、`HISTORY_INTERVAL_MAX=3600`、`ConfigModal` 默认 `60`、`MainViewModel.setInterval` 校验，已与新固件一致；本轮只做核对与注释对齐，不重复实现。

### 二、BLE OTA 客户端（本轮重点）

#### 2.1 分层架构（避免逻辑堆进单文件）

新增包 `data/ota`，把「纯协议逻辑」与「Android BLE 传输」彻底分离，前者可在 JVM 单测中完整覆盖，无需真机：

| 文件 | 职责 | 是否可单测 |
|---|---|---|
| `OtaConstants.kt` | UUID、操作码、报文长度、状态/错误码取值、magic、槽容量、流控窗口、对齐、MTU 与默认授权密钥 | 是 |
| `OtaMessages.kt` | START(61B) / END / CANCEL / TRIGGER 报文构造与长度断言 | 是 |
| `OtaStatus.kt` | OTA Status(12B) 解析、`OtaState` / `OtaError` 枚举与错误码文案 | 是 |
| `OtaImageParser.kt` | 解析 `zephyr.signed.bin`：总长、magic（`0x96F3B83D`）、`ih_ver`（偏移 20 起 8B）、整文件 SHA-256 | 是 |
| `OtaFlowController.kt` | 分片大小（MTU−3）、窗口（默认 4 KiB）判满、续传起点 | 是 |
| `OtaTransport.kt` | 传输抽象接口（MTU/订阅状态/写 Control/写 Data） | 接口 |
| `OtaRunner.kt` | 会话状态机：START→等待 READY→按窗口发 Data→END→等待 VERIFY；`trigger()` 发 TRIGGER 等 PENDING；`cancel()` | 是（用假传输） |
| `AndroidOtaTransport.kt` | 用 `BleManager` 实现 `OtaTransport`（Android 依赖） | 否 |

界面层：`ui/viewmodel/FirmwareOtaViewModel.kt` + `ui/screen/FirmwareUpdateScreen.kt`；在「设置 → 固件升级」进入。

#### 2.2 协议关键点（以 `OTA协议说明.md` / `ble_ota.c` 为准）

- **服务**：`12340050`；Control `12340051`(Write)；Data `12340052`(**Write Without Response**)；Status `12340053`(Notify)。必须**先订阅 Status**。
- **START(0x01) 61B**：`[op][16B key][4B total LE][8B ih_ver][32B 整文件 SHA-256]`。需 ATT MTU ≥ 64；固件请求 128，协商失败回退（65 也够）。
- **Data**：分片 = **协商 MTU − 3**，**不得硬编码 125**。
- **END(0x02)**：设备 flush 缓冲后校验 字节数/magic/ih_ver/SHA-256，通过→`VERIFY`，**不自动重启**。
- **TRIGGER(0x04)**：仅 `VERIFY` 时有效，设备保存写头→请求升级→通知 `PENDING`→重启；之后由 MCUboot 验签搬运。
- **CANCEL(0x03)**：释放分区、清续传、回 `IDLE`。
- **流控**：以 Status 的**设备已写入 Flash 连续偏移**为准，窗口 4 KiB；Status 每 **8 个数据包**通知一次，且该偏移刻意滞后（256B 缓冲满页才落盘）。
- **续传**：断线后重新 START 相同 `total/ih_ver/SHA-256`，设备回报**向下对齐到 256B** 的起始偏移，App 从该绝对偏移续发。
- **错误码映射**：0 NONE/1 AUTH/2 STATE/3 TOO_LARGE/4 FLASH/5 SIZE/6 MAGIC/7 VERSION/8 HASH/9 LEN/10 INTERNAL，UI 直接展示可读文案。
- **安全边界**：16B 授权密钥为**联调默认值**（ASCII `<16 字节授权密钥>`），只防无脑脚本，不防逆向；**量产必须与固件同步更换**。App 侧做成可编辑配置项，并在界面明确标注。

#### 2.3 传输层对 `BleManager` 的必要补齐

- 缓存并暴露 OTA 三个特征；`getCharacteristicByUuid` 增加分支。
- **补 `onMtuChanged` 回调**：现有 `requestMtu` 只保存了 `mtuCallback`，GATT 回调里没有 `onMtuChanged`，导致 MTU 请求永远等不到结果（既有隐患，OTA 必须依赖协商结果）。补上后 `requestMtu` 才真正可用。
- Data 特性以 `WRITE_TYPE_NO_RESPONSE` 写入；Status 以现有 `enableNotificationAsync` 订阅。

#### 2.4 会话实现要点

- `OtaRunner.run(image)`：协商 MTU → 订阅 Status → 发 START → 等 `READY` 并取设备起始偏移（续传）→ 循环「窗口未满就发一片」→ 等全部整页落盘 → 发 END → 等 `VERIFY`/`ERROR`。
- 传输抽象使 `OtaRunner` 可在单测中用**假设备**（维护 flash 偏移、每 8 包通知、支持续传与负向用例）验证：正/反向、续传、分片尺寸随 MTU 变化、错误码透传。
- 失败/异常一律返回结构化 `OtaResult`，UI 只做展示，不在界面层堆协议判断。

### 三、测试与构建

- 新增单测（沿用 JUnit4 + 假对象风格，不引入新依赖）：
  - `OtaMessagesTest`：START 长度/字段布局、END/CANCEL/TRIGGER 操作码。
  - `OtaStatusParserTest`：12B 解析、状态与错误码枚举、长度不足返回 null。
  - `OtaImageParserTest`：magic/ih_ver/total/SHA-256；错误 magic、过短文件被拒。
  - `OtaFlowControllerTest`：分片 = MTU−3（含 128 与 65 两种）、窗口判满、续传起点。
  - `OtaRunnerTest`：正路径（进度到 100% 并 `VERIFY`、`trigger`→`PENDING`）、错误密钥 → `AUTH`、续传只发剩余、MTU 回退到 62 分片。
  - `DeviceStatusParserTest`（新增）：12 字节状态帧（含 wallclock 位与 0x3F 能力）、8 字节老帧兼容、能力位语义。
  - `DeviceProfileFactoryTest`（新增）：**patch=6 不选 14 字节历史**（回归本隐患）、无服务无版本 → V1、有实时服务 → V2。
- 构建（**必须显式 JDK 17**）：
  ```powershell
  cd "C:\Users\linckr\Documents\Codex\2026-09-08\referenced-chatgpt-conversation-this-is-an\PandaThemperature-Android\source"
  $env:JAVA_HOME="C:\Users\linckr\.workbuddy\binaries\jdk\jdk-17.0.20.1+1"
  .\gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease
  ```
- 交付边界：只改工作区，不 commit/push；汇报改动清单、测试与构建结果、计划文档路径、真机待办。

## TODO

- [x] 通读交接说明、三份历史 plan、`OTA协议说明.md` 与固件 `ble_ota.h/.c`
- [x] 修正 `DeviceProfileFactory` 版本号 → V3 误选隐患
- [x] `DeviceStatus` / `DeviceStatusParser` 补齐 wallclock 位与 6 位能力位
- [x] 核对 `12340021` 历史记录间隔语义与范围
- [x] 新增 `data/ota` 纯协议层（常量/报文/状态/镜像/流控/传输抽象/会话）
- [x] `BleManager` 补齐 OTA 特征缓存与 `onMtuChanged`
- [x] `AndroidOtaTransport` 传输实现
- [x] `FirmwareOtaViewModel` + `FirmwareUpdateScreen` + 设置页入口
- [x] 新增单元测试（含隐患回归用例）
- [x] JDK 17 执行单测 + Debug/Release 构建
- [ ] **真机 OTA 联调（待设备空闲，见下）**

## 待办：需要真机验证的部分（本轮未做）

> 团队当前正在用同一台 nRF52810 做 OTA 栈修复复测（`CONFIG_BT_MAX_CONN=1`），安卓同时连接会打断。以下均**未执行**，等设备空闲后再做。

1. **固件 1.0.6 状态帧实测**：确认 12 字节、`offset6=0x06`、能力字节 `0x3F`、`bit3` 墙钟可信随对时变化。
2. **OTA 正路径**：用真实 `zephyr.signed.bin` 走完 START→Data→END→TRIGGER，确认重启后进入新固件。
3. **MTU 两种路径**：MTU 128（分片 125）与协商失败回退 65（分片 62）都能完成升级。
4. **断连续传**：中途断开后重新 START，设备回报对齐偏移并续传成功。
5. **负向用例**：错误密钥 → `err=1`；超大镜像 → `err=3` 且不擦除；错误 SHA-256 → `err=8` 且不重启。
6. **升级期间行为**：确认设备暂停历史落盘/NVS 写入，升级后历史与配置不丢。
7. **MTU 协商回调本身**：确认真机 `onMtuChanged` 能拿到协商值（历史隐患修复验证）。
8. **Room 旧版本升级回归**（沿用历史待办）、事件记录/首窗偏短在真实数据上的显示表现。

## 构建与测试结果

命令（JDK 17）：

~~~powershell
cd "C:\Users\linckr\Documents\Codex\2026-09-08\referenced-chatgpt-conversation-this-is-an\PandaThemperature-Android\source"
$env:JAVA_HOME="C:\Users\linckr\.workbuddy\binaries\jdk\jdk-17.0.20.1+1"
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease
~~~

结果：**BUILD SUCCESSFUL**（97 个任务）；单元测试 **70 项全部通过**（0 失败 0 错误）。

| 测试类 | 用例数 | 说明 |
|---|---|---|
| `data/ota/OtaRunnerTest` | 7 | 正路径/续传/错误密钥/超限/MTU 回退/MTU 过小/取消 |
| `data/ota/OtaFlowControllerTest` | 8 | 分片=MTU−3、窗口、续传、整页边界 |
| `data/ota/OtaStatusParserTest` | 5 | 12B 解析、状态/错误码、无符号偏移 |
| `data/ota/OtaMessagesTest` | 5 | START 61B 布局、操作码、长度断言 |
| `data/ota/OtaImageParserTest` | 4 | magic/ih_ver/SHA-256、拒绝裸 bin、过短、超限 |
| `data/ota/OtaAuthKeyTest` | 4 | ASCII/十六进制解析 |
| `data/device/parser/DeviceStatusParserTest` | 7 | 12B 状态帧、能力位、老帧兼容、版本文案 |
| `data/device/profile/DeviceProfileFactoryTest` | 5 | **patch=6 不再误选 14 字节历史** 回归 |
| 既有（BleFrameDiagnostics / HistoryDataParser / RealtimeDataParser / WeatherChartEvents / Example） | 25 | 基线不变 |

本轮由 25 项增至 70 项，新增 45 项。

## 完成记录

2026-09-13：完成协议同步（状态帧/能力位/历史间隔语义）与固件版本 → Profile 选型隐患修复；新增 `data/ota` 纯协议层、`AndroidOtaTransport`、`FirmwareOtaViewModel` 与「设置 → 固件升级」界面；补齐 `BleManager` 的 `onMtuChanged`；新增协议与 OTA 单元测试（70 项全通过），Debug/Release 构建成功。真机 OTA 联调列为待办。

## 后续优化建议（坏味道，供决策，本轮未改）

1. **`ConfigModal` 中 `ActionButton` 为既有死代码**（界面只用 `CompactActionButton`），可删。
2. **固件版本显示口径**：状态栏仍显示原始 `(v6)`，配置弹窗/配置卡片已改为能力感知的 `firmwareVersionLabel`（新固件 `v6`、旧固件 `v1.2`）。若要全局统一，需把标签透传到 `StatusBar`；本轮未做以免改动过多。
3. **`MainViewModel` 体量偏大**（2000+ 行），OTA 已刻意独立为 `FirmwareOtaViewModel`，未继续膨胀它。

---

# 追加轮（同日）：三项清理 + 固件异步 START 同步

## 1. 固件版本显示口径统一

`StatusBar.kt` 的参数由 `firmwareVersion: Int?` 改为 `firmwareVersionLabel: String?`，
`MainScreen.kt` 的 `HomeScreen` 同步透传，调用点直接给 `deviceStatus?.firmwareVersionLabel`。
状态帧解析**未改**；未引入新格式；无版本号（或 `--`）时不占位。

新增表驱动用例 `DeviceStatusParserTest.formatsVersionLabelPerFirmwareGeneration`：

| 能力字节 | 版本号 | 显示 | 含义 |
|---|---|---|---|
| ≠ 0 | 6 / 5 | `v6` / `v5` | 新固件：patch 号 |
| = 0 | 12 / 2 | `v1.2` / `v0.2` | 旧固件：主/次版本编码 |
| = 0 | 6 | `v0.6` | 同一个数字在两代下解释不同，口径必须由能力字节决定 |
| = 0 | 0 | `--` | 缺失不伪造 |

## 2. 删除 `ConfigModal.ActionButton`

已删除；全仓仅剩 `CompactActionButton` 被引用。以 `:app:assembleDebug` 编译验证（不是只 grep）。

## 3. `MainViewModel` 提取式瘦身

把 **WAPS 实时气象监测采样循环**（每秒采气压 / 每 10 秒采 GPS / 每分钟中值滤波与静止判定）
搬到新文件 `data/weather/WapsMonitor.kt`：实时值、开关、GPS 获取由 `WapsMonitor.Inputs` 注入，
结果由 `WapsMonitor.Outputs` 回收，故该类不再依赖 ViewModel。
`MainViewModel` 只保留 `wapsResult` / `lastGpsAltitudeMeters` 状态与 `startWaps()` / `stopWaps()` 编排，
**逻辑逐行搬移，业务行为零改动**。

## 4. 固件异步 START 与新错误码 11（OVERRUN）

固件把「整槽擦除 / 写 Flash / NVS / 整镜像 SHA-256」从 BLE GATT 回调搬到系统工作队列后：

1. **START 变异步**：写完 START 后设备不会立即 READY，期间可能没有状态通知；客户端必须等待 READY。
   - `OtaRunner` 新增 `readyTimeoutMs`（默认 `OtaConstants.START_READY_TIMEOUT_MS = 15s`），
     START 后**只认 `state == READY`**；超时返回 `Failed(null, "等待设备 READY 超时…")`。
   - **IDLE 且 err=0 绝不等价于"可以发数据"** —— 代码与注释都显式写死这一点。
2. **新增错误码 11 = `OVERRUN`**：设备 512B 环形缓冲 + 双缓冲溢出时的**保护性中止**
   （已落盘部分完整，不会写坏镜像）。`OtaError` 已补 11 与中文文案。
   - `OtaRunner.run()` 拆成「编排 + `uploadOnce()` 单次会话」：只有 `OVERRUN` 才重发 START，
     续传偏移由设备回报（`NVS` 持久化的已确认偏移），其余错误直接上抛。
   - 重发前 `dropStaleStatuses()` 丢弃上一轮的 ERROR 通知，避免"看起来又失败"。
   - 重试预算 `OtaConstants.MAX_OVERRUN_RESTARTS = 2`，超出仍溢出则报 `Failed(OVERRUN)`。
   - 提示通过新增的 `onNotice` 回调透给 `FirmwareOtaViewModel`（界面上只是更新文案，流程不变）。
3. **流控窗口口径已复核**：`OtaFlowController.canQueueMore()` =
   `(queuedOffset - confirmedOffset) < windowBytes`，`confirmedOffset` **只**来自 Status 上报的
   「设备已写入 Flash 的连续偏移」，不是"我已发出多少字节"。新增
   `windowKeysOffDeviceConfirmedFlashOffsetNotBytesSent` 用例锁死。

## 追加轮的构建与测试结果

命令同上（JDK 17，`:app:testDebugUnitTest :app:assembleDebug :app:assembleRelease`）：
**BUILD SUCCESSFUL**；单元测试 **76 项全部通过**（基线 70 + 新增 6，0 失败 0 错误 0 跳过），
并用 `--rerun-tasks` 强制重跑确认非 UP-TO-DATE 假通过。

新增用例：`waitsForReadyAfterStartWhenDeviceReportsIdleFirst`、
`idleWithoutErrorIsNotTreatedAsReady`、`overrunRestartsFromStartAndResumesAtConfirmedOffset`、
`repeatedOverrunGivesUpAfterRetryBudget`、`parsesOverrunErrorIntroducedByAsyncStartFirmware`、
`windowKeysOffDeviceConfirmedFlashOffsetNotBytesSent`。

**仍未做真机 BLE 联调**（设备被固件侧占用，`CONFIG_BT_MAX_CONN=1`）：
异步 START 的实际耗时分布、err=11 的触发概率、重发 START 后设备是否接受（ERROR 态能否直接 START）
都需要真机确认。

---

# 再追加轮（同日）：真机 OTA 联调

设备 `PandaTemp_7086`（MAC `D3:AE:E9:82:70:86`），镜像
`build-ota3/zephyr/zephyr.signed.bin` **145,590 B**（md5 `22c0a7a80b230f95eb80d93d118cb26b`，
本地与手机一致），密钥默认 `<16 字节授权密钥>`。

## 1. 采集到的实测数据

| 项目 | 实测值 | 结论 |
|---|---|---|
| MTU 协商 | App 请求 247 → 设备回 **128**；`onMtuChanged` 生效 | 分片 = 128−3 = **125 B**，无回退到 65 |
| 状态帧长度 | **12 字节** | offset6 = `0x06`（v6），能力字节 `0x3F`，墙钟位「可信」 |
| Profile 选型 | `已选择设备配置: V2(新固件)` | 上一轮「patch=6 误判 14B V3」修复在真机确认 |
| 状态栏 | `PandaTemp_7086 (v6) -- V` | 显示口径统一在真机确认 |
| START→READY | 10:51:09.207 写 START → 10:51:10.276 收 Status ≈ **1.07 s** | 落在 1~2 s，`START_READY_TIMEOUT_MS=15_000` 余量充足 |
| 传输 | 145,590 B，约 **24 s**，≈ **5 KB/s** | — |
| 流控落点 | 已确认 **144,896** / 已发送 145,590 | 144,896 = 566×256 整页边界，尾部 694 B 由 END flush |
| err=11 OVERRUN | **一次未出现** | 与 PC 侧 4 次实测一致 |
| END 之后 | 设备停在 **VERIFY** | 与固件侧说明一致 |
| TRIGGER 之后 | 10:58:11 断连 → 10:59:05 重连成功、服务已发现 | 设备确实重启 |
| 重启后状态帧 | `记录间隔:60秒, 记录数:4069, 固件:v6, 可保留:45天, 墙钟:可信, 能力:0x3F` | 再次选中 V2 Profile，自动初始化完成 |

> 注意：本次推的就是设备上已在跑的 1.0.6+0 同一份镜像，因此状态帧里的「固件:v6」
> 升级前后**不变**，不能用它判断主槽是否真的换了镜像 —— 需由固件侧用 SWD 读主槽
> 镜像头 / MCUboot swap 状态独立确认。

## 2. 真机才暴露的两个客户端缺陷（均已修）

### 2.1 `AndroidOtaTransport.writeData()`：第 2 片 Data 就被拒

现象：App 显示「升级失败：写入 OTA Data 失败（偏移 125）」，进度「已确认 0 / 已发送 125」；
logcat 中 `12340052` 只有 1 次「特征写入成功」且**蓝牙栈无任何报错**。

根因：原实现是 fire-and-forget，直接返回 `gatt.writeCharacteristic()` 的 Boolean。
真机（MIUI / Android 13 + QTI 栈）**同一特征同时只允许 1 个在途写**，上一片还没收到
`onCharacteristicWrite` 就发下一片时 API 直接返回 `false` —— 这是瞬时「忙」，不是链路错误。

修法（`AndroidOtaTransport.kt:55`）：改为**等写完回调再发下一片 + 忙重试**，
`WRITE_TIMEOUT_MS=5_000` 超时视为链路问题直接失败，`DATA_WRITE_ATTEMPTS=5`、
`DATA_WRITE_RETRY_MS=8`。协议与业务语义未动（正确性仍由 END 的字节数 + 整镜像 SHA-256 兜底）。

### 2.2 `OtaRunner.triggerUpgrade()`：`status=133` 被误判为触发失败

现象（真机 logcat 原文）：

```
09-13 10:58:11.180 E/BleManager(20011): 特征写入失败: 133
09-13 10:58:11.180 D/BleManager(20011): 设备已断开
09-13 10:58:11.214 D/MainViewModel(20011): [INFO] 设备已断开连接
```

设备其实**已经收到 TRIGGER 并立即复位**，链路被拉断导致 Android 报 `133 (GATT_ERROR)`，
App 却把它判成「触发失败」。

修法（`OtaRunner.kt:202`）：TRIGGER 写失败后轮询链路，
`TRIGGER_DISCONNECT_GRACE_STEPS=15 × TRIGGER_DISCONNECT_GRACE_MS=100ms`（最长 1.5 s）内
若 `isConnected()` 变 false ⇒ 判定**已成功触发**（返回 true）。

## 3. UI 分水岭已确认，无需补代码

`FirmwareUpdateScreen.kt` 中 `Phase.VERIFIED` 分支已有
`Button(onClick = viewModel::triggerUpgrade) { Text("立即重启并安装") }`，
`FirmwareOtaViewModel` 已接；另有文案提示「上传完成后设备不会自动重启」。

## 4. 本轮构建与测试结果

JDK 17，`:app:testDebugUnitTest :app:assembleDebug :app:assembleRelease`：
**BUILD SUCCESSFUL**（EXIT=0）。单测 **13 个类共 79 项，0 失败 0 错误 0 跳过**
（上一轮 76 + 本轮新增 3）；`OtaRunnerTest` 单项 **14 项**通过。

新增用例：`triggerCountsAsTriggeredWhenDeviceResetsAndLinkDrops`、
`triggerStillFailsWhenWriteErrorHappensWithLinkUp`、`triggerFailsFastWhenAlreadyDisconnected`。
`FakeDevice` 新增 `triggerWriteFails` / `dropLinkOnTrigger` / `markDisconnected()` 三个真机行为开关。

> 期间 `dexBuilderRelease` 曾因 Windows 文件锁
> `AccessDeniedException: ...\WapsBufferKt.dex` 失败一次，`./gradlew.bat --stop` 后重跑通过
> （环境性抖动，非代码问题）。

## 5. 遗留

* 第二次真机跑时 APK 里还没有 2.2 的修复，因此「TRIGGER 显示为成功」的干净证据尚未采集；
  修复后的 APK 已构建完成，待决定是否再跑一轮。
* 主槽是否真的换成新镜像，待固件侧 SWD 独立确认。

---

# 第三轮（同日）：1.0.7 镜像判决跑

上一轮推送的是设备上已在跑的同一份镜像（`ih_ver=1.0.6+0`），版本号不变化，无法作为
「主槽真的换了」的判据（固件侧 SWD 读到的 `img_size=144928 / ih_ver=1.0.6+0` 与推送前一致）。
本轮机固件侧把版本抬到 **1.0.7**，用**含 2.1 / 2.2 两处修复的 APK**重跑完整 OTA。

## 1. 输入与前置

| 项 | 值 |
|---|---|
| 镜像 | `zephyr_107.signed.bin`，**145,591 B**，MD5 `16C6ADBCDE0C5C39270903757AA829AD`（电脑与手机一致） |
| 镜像版本 | App 预校验显示 **1.0.7+0**，SHA-256 前缀 `608D4FFA…` |
| APK | `app-debug.apk`（本日 11:04 构建，含两处修复） |
| 设备 | `PandaTemp_7086`，升级前 `固件:v6` |
| 密钥 | `<16 字节授权密钥>`（预填） |

## 2. 完整时间线（logcat 原文时间戳）

```
11:28:46.319  点击「开始升级」
11:28:47.800  写入特征: 12340051（START）
11:28:48.684  特征写入成功: 12340051
11:28:48.865  特征值变化: 12340053, 数据长度: 12   ← START→READY ≈ 1.07 s
11:28:48.881  写入特征: 12340052（首片 Data，之后 1 片/次连续写入，无一次失败）
11:29:46.022  写入特征: 12340051（END）
11:29:46.794  特征写入成功: 12340051
11:30:02      截图：99%，已确认 144896 / 已发送 145591，「上传并校验通过」
11:30:15.011  写入特征: 12340051（TRIGGER）
11:30:20.028  E/BleManager: 特征写入失败: 133
11:30:20.028  D/BleManager: 设备已断开
11:30:20.028  D/MainViewModel: [INFO] 设备已断开连接
              → UI 显示「升级已触发。设备重启后请重新连接确认固件版本。」
11:32:01.754  D/MainViewModel: [SUCCESS] 设备连接成功，服务已发现
11:32:03.490  [SUCCESS] 读取设备状态成功 - 记录间隔:60秒, 记录数:4099, 清空:空闲,
              固件:v7, 可保留:45天, 墙钟:可信, 能力:0x3F        ← 判决依据
11:32:03.840  [INFO] 已选择设备配置: V2(新固件)
```

## 3. 判决结果

* **TRIGGER 后设备确实复位断链**：写入 TRIGGER 后 5.0 s 收到 `特征写入失败: 133` 与
  `设备已断开`，与设备立即复位、链路被拉断的现象一致。
* **修复 2.2 生效**：App 侧不再报「触发失败」，而是显示「升级已触发」——
  即 `triggerUpgrade()` 的链路断开宽限轮询按预期把 `status=133` 判为「已成功触发」。
* **重连后状态帧版本号由 v6 → v7**（能力字节 `0x3F` ≠ 0，patch 号口径），
  首页状态栏与「设置 → 设备配置」弹窗均显示 **v7**。
  这证明 MCUboot 完成了实签与搬运 —— 整条 OTA 链路在真机闭环。

## 4. 采集到的指标

| 项目 | 本轮实测 | 对比上一轮 |
|---|---|---|
| MTU | 128（分片 125 B） | 一致 |
| START→READY | **1.07 s** | 1.07 s |
| 传输 145,591 B | **约 57 s ≈ 2.55 KB/s** | 上轮约 24 s ≈ 5 KB/s（本机后台有 GMS/Finsky 任务，速率波动） |
| 流控落点 | 已确认 **144,896** / 已发送 145,591 | 一致（566×256 整页边界） |
| END→校验通过 | 约 16.7 s（含整镜像 SHA-256） | — |
| err=11 OVERRUN | **0 次**（`12340051` 全场只有 START/END/TRIGGER 三次写，无重发 START） | 一致 |
| TRIGGER→断链 | 5.0 s | — |
| 重连后版本 | **v7** | v6（未变，因镜像相同） |

> 本轮 TRIGGER 后的重连不是纯自动：App 停在「固件升级」页，需回首页触发自动重连
> （上一轮停在首页时约 49 s 自动重连成功，本轮由人工驱动，故断链到重连间隔较长）。

## 5. 结论

1.0.7 判决跑通过：App 侧 `固件:v6 → v7`，客户端 OTA 全链路
（START → Data → END → VERIFY → TRIGGER → 重启 → 重连）在真机上闭环。
**固件侧 SWD 回传（已确认）**：主槽
`magic=96f3b83d / img_size=144,928 / ih_ver=1.0.7+0`（升级前 1.0.6+0），
`PC=0x24BF0（App 区） VTOR=0x8200 CFSR/HFSR=0`。
客户端侧与固件侧独立事实对上，**OTA 全链路在真机闭环，本轮收工**。

验收口径的结论汇总另见 `20260913-安卓端OTA联调验收小结.md`。
