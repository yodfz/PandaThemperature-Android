# PandaThemperature-Android

配套 **nRF52810 蓝牙温湿度记录仪**（E104-BT5010A + W25Q64）的 Android 客户端。

Gradle 工程位于本仓库的 **`source/`** 子目录（**不是**仓库根）。

---

## 这个 App 是做什么的

- BLE 扫描 / 连接 / 断线自动重连（带前台服务保活）
- 实时温湿度、气压、**电池电压**展示
- 历史记录同步（增量/全量）、曲线、导出
- 设备配置：历史记录间隔、时间同步、温度极值重置、清空数据
- **固件 OTA 升级**：选择 `zephyr.signed.bin` → 蓝牙推送到设备次级槽 → 触发重启升级
- 工具箱：营地助手、营地回溯、天气模块

---

## 硬件与固件

| 项目 | 值 |
|---|---|
| 模组 | E104-BT5010A |
| MCU | nRF52810（192 KiB Flash / 24 KiB RAM） |
| 外部 Flash | W25Q64（8 MiB SPI NOR） |
| 固件版本（本文档写作时） | `1.0.8+0` |
| 与本文档兼容的 App 提交 | `f86f670` |

固件仓库（含全部架构文档）：
**https://github.com/linckr/NRF52xxx-FieldTemp**

---

## 构建

**JDK 必须是 17。** Android Studio 自带的 `jbr` 现在是 JDK 25，Gradle 8.13 不支持，
失败时只会打印一行版本号（如 `What went wrong: 25.0.2`），没有任何上下文。

```powershell
$env:JAVA_HOME = "C:\Users\linckr\.workbuddy\binaries\jdk\jdk-17.0.20.1+1"
cd .\source

# Debug
.\gradlew.bat :app:assembleDebug --console=plain

# 单元测试
.\gradlew.bat :app:testDebugUnitTest --console=plain

# Release（缺 keystore.properties 时回退调试密钥签名，可安装但不可分发）
.\gradlew.bat :app:assembleRelease --console=plain

# AAB（上架）
.\gradlew.bat :app:bundleRelease --console=plain
```

**产物路径**（相对 `source/`）：

| 产物 | 路径 |
|---|---|
| Debug APK | `app\build\outputs\apk\debug\app-debug.apk` |
| Release APK | `app\build\outputs\apk\release\app-release.apk` |
| Release AAB | `app\build\outputs\bundle\release\app-release.aab` |

---

## 安装

```powershell
$ADB = "C:\Users\linckr\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $ADB install -r -t -g .\source\app\build\outputs\apk\debug\app-debug.apk
```

国内 ROM（MIUI/澎湃、ColorOS 等）会拒绝 `adb install` 并报
`INSTALL_FAILED_USER_RESTRICTED` —— 这**不是**签名问题，需要在手机上手动打开
**开发者选项 → USB 安装**（部分机型还要开「USB调试(安全设置)」）。
兜底：`adb push` 到 `/sdcard/Download/` 后用文件管理器手动安装。

---

## 配置：OTA 授权密钥

OTA 需要 16 字节授权密钥，与固件侧保持一致。

```powershell
Copy-Item .\source\ota.properties.example .\source\ota.properties
# 编辑 ota.properties，填入与固件 src/ble/ota_auth_key.h 相同的值
```

- `ota.properties` **已被 `.gitignore` 排除，绝不入库**。
- 它在构建期经 `buildConfigField` 注入为 `BuildConfig.OTA_DEFAULT_AUTH_KEY`，
  代码里通过 `OtaConstants.DEFAULT_AUTH_KEY` 读取。
- **缺少该文件时构建与测试仍然全部通过**，只是升级界面的密钥输入框不预填。

> ⚠️ 该密钥**不是安全边界**：它只防误触与无脑脚本，且可从固件镜像/APK 中逆向得到。
> 真正拦住恶意固件的是固件侧 **MCUboot 的 ECDSA-P256 验签**。

---

## OTA 架构（速览）

```
App 选择 zephyr.signed.bin
  → BLE 服务 12340050（Control 12340051 / Data 12340052 / Status 12340053）
  → 写入设备外置 W25Q64 的 MCUboot 次级槽 [0x00000, 0x28000) —— 160 KiB
  → TRIGGER → 设备重启
  → MCUboot 读次级槽 trailer → ECDSA-P256 验签
  → 通过则 overwrite 主槽 [0x08000, 0x30000)
```

关键点：

- **必须传 `zephyr.signed.bin`**，不能是 `zephyr.bin` / `merged.hex` / `zephyr.elf`。
  App 在发送前会校验镜像 magic，不符直接拒绝。
- **START 是异步的**：设备要先擦除整个次级槽（约 1~2 s），
  **必须等 Status 报 `state=READY` 才能发数据**（`IDLE` 不等于可以发）。
- 支持**断点续传**：续传身份绑定 `(total, ih_ver, SHA-256 前 16 字节)`。
- 设备若报 `err=11 OVERRUN`（接收缓冲溢出），应从 START 重发，设备会从已确认偏移续传。
- TRIGGER 后设备复位会拉断链路（Android 报 `status=133`），**这是成功的表现**。

---

## 关键代码位置

| 用途 | 文件 |
|---|---|
| BLE 入口（扫描/连接/读写/订阅） | `data/bluetooth/BleManager.kt` |
| 全部 UUID 与设备名常量 | `data/bluetooth/BleConstants.kt` |
| 数据解析（实时/状态/历史/极值） | `data/device/parser/*.kt` |
| Profile 选择（决定历史记录长度） | `data/device/profile/DeviceProfileFactory.kt` |
| **OTA 主流程** | `data/ota/OtaRunner.kt` |
| OTA 协议常量 / 报文 / 状态解析 | `data/ota/OtaConstants.kt`、`OtaMessages.kt`、`OtaStatus.kt` |
| OTA 流控与续传偏移 | `data/ota/OtaFlowController.kt` |
| OTA 镜像校验 | `data/ota/OtaImageParser.kt` |
| OTA 授权密钥编解码 | `data/ota/OtaAuthKey.kt` |
| OTA UI 入口 | `ui/viewmodel/FirmwareOtaViewModel.kt`、`ui/screen/FirmwareUpdateScreen.kt` |
| 主 ViewModel | `ui/viewmodel/MainViewModel.kt` |
| BLE 保活前台服务 | `service/BleConnectionForegroundService.kt` |
| 构建配置（含密钥注入） | `app/build.gradle.kts` |

---

## ⚠️ 协议上的坑（改代码前必看）

1. **不要用固件版本号推断历史记录长度。** 新固件上报的是 **patch 号**（8 表示 1.0.8），
   老固件是主/次版本编码（12 表示 v1.2），两者共用同一个 `uint16` 位段。
   历史上 `>= 3 ⇒ 14 字节` 的启发式曾把 patch=6 误判成 14 字节，导致历史**全部错位**。
   现在只按"是否有实时数据服务 / 有效版本号"选择 `V1(8)` 或 `V2(12)`。
2. **实时帧的气压是 0.1 hPa，历史记录的气压是 Pa** —— 单位不同，别混用。
3. `12340026` 只表示 `HISTORY_INFO_CHAR`；冲突的旧 `BATTERY_CHAR` 别名已删除，
   电池电压现在在实时帧的 offset 6。
4. 时间同步特征 `12340011` **声明在配置服务 `12340020` 内部**，
   没有独立的 `12340010` 服务 —— 不要去找它。

---

## 详细文档

架构与协议的权威文档在**固件仓库**：

- [CODEX_START_HERE.md](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/CODEX_START_HERE.md) —— 第一入口
- [HANDOFF.md](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/HANDOFF.md) —— 当前状态与下一步任务（含 Android 代码地图）
- [DEVELOPMENT.md](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/DEVELOPMENT.md) —— 环境、构建、烧录（含 Android 部分）
- [HARDWARE.md](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/HARDWARE.md) —— 引脚与 Flash 分区
- [OTA.md](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/OTA.md) —— OTA 架构与签名
- [PROTOCOL.md](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/PROTOCOL.md) —— **Firmware ↔ Android 接口协议（byte-level）**
- `source/docs/` —— 按日期保存的历史实施记录；与当前代码冲突时以代码和上述协议文档为准
