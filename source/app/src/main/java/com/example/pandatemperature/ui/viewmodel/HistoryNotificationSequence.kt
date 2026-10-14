package com.example.pandatemperature.ui.viewmodel
/** Serialize remote CCCD ACKs; never enable after unconfirmed reset/request or stale session. */
object HistoryNotificationSequence {
    suspend fun start(ownsSession: () -> Boolean, disable: suspend () -> Boolean,
                      writeRequest: suspend () -> Boolean, enable: suspend () -> Boolean): Boolean {
        if (!ownsSession() || !disable() || !ownsSession()) return false
        if (!writeRequest() || !ownsSession()) return false
        return enable() && ownsSession()
    }
}
