package com.example.pandatemperature.data.device.profile.thermometer

import com.example.pandatemperature.data.device.parser.DataParser
import com.example.pandatemperature.data.device.parser.HistoryDataParser
import com.example.pandatemperature.data.device.parser.HistoryRecordFormat
import com.example.pandatemperature.data.model.TemperatureRecord

/**
 * 温度计 V3 配置：历史记录使用 14 字节格式（V2 + 末尾 2 字节电池毫伏）。
 *
 * ⚠️ **预留能力，当前不被任何固件选中。**
 *
 * 现场固件（含 1.0.6+0）的历史记录**始终是 12 字节 V2，不含电压**，
 * 因此 [DeviceProfileFactory][com.example.pandatemperature.data.device.profile.DeviceProfileFactory]
 * **不会**按固件版本号选中本 Profile —— 旧固件的版本号是主/次版本编码，新固件是 patch 号，
 * 用版本号推断 14 字节长度会把正常历史记录解析错位（参见工厂注释）。
 *
 * 未来只有当固件**显式提供**「历史记录含电压」能力标志（状态帧能力字节新增位）时，
 * 才可以在工厂里按该能力位接入本 Profile。在具备该能力标志前，禁止用版本号或包长推断。
 */
class ThermometerV3Profile(
    firmwareVersion: Int
) : ThermometerV2Profile(firmwareVersion) {

    override fun getHistoryParser(deviceId: String): DataParser<List<TemperatureRecord>> {
        return HistoryDataParser(deviceId, HistoryRecordFormat.V3)
    }
}
