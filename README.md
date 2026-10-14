# Android 客户端

本统一仓库 `android/` 是唯一日常开发入口。独立Android仓库 `source/` 通过受控同步维护，用于上游PR，不在两处独立修改并无记录地互相覆盖。

当前生产 App **1.1.4/code6**，Room11；配套 Firmware **1.0.11+0**。电压显示统一为3位小数，包括首页、配置、历史列表/详情、设备管理、电池指示和日志；原始毫伏记录、ADC精度及协议未改。历史按设备能力协商V3电压；App保留模块缓存并按正常增量同步，手机有/无GPS来源独立保护。

构建使用JDK17、Android SDK36和Gradle Wrapper8.13。Debug执行 `gradlew.bat :app:assembleDebug`；生产Release设置仓库外 `PANDA_RELEASE_KEYSTORE_PROPERTIES` 后执行 `:app:assembleRelease :app:lintRelease`。OTA配置参考 `ota.properties.example`，私钥、keystore、配置口令及私人档案不提交。当前Release配置缺失仍会回退Debug签名，是待修复风险；正式分发必须验证生产证书。

123 JVM、真实C历史回归和Release lint通过；实际生产APK哈希及小米Android12/API31真机配对Live73.935 s通过。原3477条记录核心字段及手机采样保留，最终模块3184/手机样本364，未来日期和模块重复0。测试辅助APK已卸载，不会持续运行全量回归。

来源为手机的零温湿度采样、缺失/撤回权限路径、Android13+权限及长期运行仍待独立排查。三位小数不等于ADC已经校准。

入口：[CODEX_START_HERE](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/CODEX_START_HERE.md)、[PROTOCOL](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/PROTOCOL.md)、[最终验收](https://github.com/linckr/NRF52xxx-FieldTemp/blob/main/docs/20261014-startup-voltage-validation.md)、[正式发布v1.0.11](https://github.com/linckr/NRF52xxx-FieldTemp/releases/tag/v1.0.11)。
