package com.example.pandatemperature.data.device.profile

import com.example.pandatemperature.data.bluetooth.BleConstants
import com.example.pandatemperature.data.device.model.DeviceTypes
import com.example.pandatemperature.data.device.model.HistoryRecord
import com.example.pandatemperature.data.device.model.SensorData
import com.example.pandatemperature.data.device.profile.thermometer.ThermometerProfile
import com.example.pandatemperature.data.device.profile.thermometer.ThermometerV1Profile
import com.example.pandatemperature.data.device.profile.thermometer.ThermometerV2Profile

/**
 * 设备配置工厂
 * 根据设备类型、固件版本、可用服务创建对应的设备配置
 */
object DeviceProfileFactory {
    
    /**
     * 创建设备配置（通用方法）
     * @param deviceType 设备类型（字符串常量，参见 DeviceTypes）
     * @param firmwareVersion 固件版本号，0 或 null 表示老固件
     * @param availableServiceUuids 设备支持的服务 UUID 集合
     * @return 对应的设备配置
     */
    fun <T : SensorData, H : HistoryRecord> createProfile(
        deviceType: String,
        firmwareVersion: Int?,
        availableServiceUuids: Set<String> = emptySet()
    ): DeviceProfile<T, H>? {
        @Suppress("UNCHECKED_CAST")
        return when (deviceType) {
            DeviceTypes.THERMOMETER -> createThermometerProfile(firmwareVersion, availableServiceUuids) as? DeviceProfile<T, H>
            DeviceTypes.UNKNOWN -> createThermometerProfile(firmwareVersion, availableServiceUuids) as? DeviceProfile<T, H>
            else -> null
        }
    }
    
    /**
     * 创建温度计配置（专用方法）
     *
     * ⚠️ 历史记录长度**只按固件是否提供合并实时数据能力显式选择**，绝不按数据包长度猜测。
     *
     * 为什么不再用「固件版本号 >= 3 ⇒ 14 字节 V3」的启发式：
     * - 旧固件的版本号是主/次版本编码（例如 12 表示 v1.2、2 表示 v2）；
     * - 新固件（1.0.6+0 起）在状态帧里上报的是 **patch 号**（例如 6 表示 1.0.6）；
     * - 两者混用同一位段，`>= 3` 会把新固件的 patch=6 误判成「14 字节 V3 历史」，
     *   导致历史记录按错误长度切分、全部错位。现场固件的历史记录**始终是 12 字节 V2**。
     *
     * 因此这里只区分两条显式路径：老 ESS 固件（8 字节 V1）与合并实时数据固件（12 字节 V2）。
     * `ThermometerV3Profile` / `HistoryRecordFormat.V3` 仅作为「电压预留能力」保留，
     * 未来只有在固件**显式提供**「历史含电压」能力标志时才可接入，禁止再用版本号推断。
     *
     * @param firmwareVersion 固件版本号（新固件为 patch 号）
     * @param availableServiceUuids 可用服务 UUID
     * @return 温度计配置
     */
    fun createThermometerProfile(
        firmwareVersion: Int?,
        availableServiceUuids: Set<String> = emptySet()
    ): ThermometerProfile {
        // 合并实时数据固件：有有效版本号，或设备直接暴露了实时数据服务。
        val hasRealtimeDataService = availableServiceUuids.contains(BleConstants.REALTIME_DATA_SERVICE)
        val hasValidVersion = firmwareVersion != null && firmwareVersion > 0
        val isCombinedRealtimeFirmware = hasValidVersion || hasRealtimeDataService

        return if (isCombinedRealtimeFirmware) {
            // 12 字节历史（V2），含气压、不含电压。旧固件与 1.0.6+0 新固件同属此路径。
            ThermometerV2Profile(firmwareVersion ?: 0)
        } else {
            // 老 ESS 固件：8 字节历史（V1），分开读取温度/湿度。
            ThermometerV1Profile()
        }
    }
    
    /**
     * 根据固件版本快速判断是否为新固件
     * 用于在读取设备状态后快速判断
     */
    fun isNewFirmware(firmwareVersion: Int?): Boolean {
        return firmwareVersion != null && firmwareVersion > 0
    }
}
