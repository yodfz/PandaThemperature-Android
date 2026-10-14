package com.example.pandatemperature.data.bluetooth
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Test
class GattCallbackIdentityTest {
    @Test fun lateOldAckDoesNotConsumeCurrentUuidCallback() {
        val old=Any();val current=Any();val pending=CompletableDeferred<Boolean>()
        val callbacks=mutableMapOf("history-cccd" to { pending.complete(true);Unit })
        if(GattCallbackIdentity.isCurrent(old,current)) callbacks.remove("history-cccd")?.invoke()
        assertFalse(pending.isCompleted);assertTrue(callbacks.containsKey("history-cccd"))
        if(GattCallbackIdentity.isCurrent(current,current)) callbacks.remove("history-cccd")?.invoke()
        assertTrue(pending.isCompleted);assertFalse(callbacks.containsKey("history-cccd"))
    }
    @Test fun staleDisconnectAndClosedConnectionCannotClearNewState() {
        val old=Any();val current=Any();var cleared=false
        if(GattCallbackIdentity.isCurrent(old,current)) cleared=true
        assertFalse(cleared);assertFalse(GattCallbackIdentity.isCurrent(current,null))
    }
}
