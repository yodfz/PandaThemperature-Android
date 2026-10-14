package com.example.pandatemperature.data.bluetooth
/** UUID alone is not an operation identity after reconnect: callbacks must match the live GATT instance. */
internal object GattCallbackIdentity {
    fun isCurrent(callbackGatt: Any, currentGatt: Any?): Boolean =
        currentGatt != null && callbackGatt === currentGatt
}
