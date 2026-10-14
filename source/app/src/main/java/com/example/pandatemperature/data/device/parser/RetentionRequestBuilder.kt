package com.example.pandatemperature.data.device.parser
import com.example.pandatemperature.data.model.DeviceStatus
/** Disable retained history via HISTORY, never via CLEAR. Old firmware rejects zero safely. */
object RetentionRequestBuilder {
    fun buildDisable(capabilityFlags: Int): ByteArray? =
        if ((capabilityFlags and DeviceStatus.HISTORY_RETENTION_CAPABILITY) == 0) null
        else byteArrayOf(0, 0, 0, 0, 4)
}
