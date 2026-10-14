package com.example.pandatemperature.ui.viewmodel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.async
import kotlinx.coroutines.yield
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Test
class HistoryNotificationSequenceTest {
    @Test fun reconnectWithoutLocalSubscriptionStillRequiresRemoteDisableAck() = runBlocking {
        val calls=mutableListOf<String>()
        assertTrue(HistoryNotificationSequence.start({true},{calls.add("disable");true},
            {calls.add("request");true},{calls.add("enable");true}))
        assertEquals(listOf("disable","request","enable"),calls)
    }
    @Test fun unconfirmedDisableOrRequestNeverEnables() = runBlocking {
        val calls=mutableListOf<String>()
        assertFalse(HistoryNotificationSequence.start({true},{calls.add("disable");false},
            {calls.add("request");true},{calls.add("enable");true}))
        assertEquals(listOf("disable"),calls)
        calls.clear()
        assertFalse(HistoryNotificationSequence.start({true},{calls.add("disable");true},
            {calls.add("request");false},{calls.add("enable");true}))
        assertEquals(listOf("disable","request"),calls)
    }
    @Test fun sessionInvalidationAfterRequestNeverEnables() = runBlocking {
        var owns=true;var enabled=false
        assertFalse(HistoryNotificationSequence.start({owns},{true},{owns=false;true},{enabled=true;true}))
        assertFalse(enabled)
    }
    @Test fun cancellationPropagatesWithoutEnabling() = runBlocking {
        var enabled=false;var cancelled=false
        try {
            HistoryNotificationSequence.start({true},{true},
                {throw kotlinx.coroutines.CancellationException("disconnect")},{enabled=true;true})
        } catch (_: kotlinx.coroutines.CancellationException) {cancelled=true}
        assertTrue(cancelled);assertFalse(enabled)
    }
    @Test fun requestAndEnableWaitForActualAcknowledgements() = runBlocking {
        val disabled=CompletableDeferred<Boolean>();val written=CompletableDeferred<Boolean>()
        val calls=mutableListOf<String>()
        val job=async { HistoryNotificationSequence.start({true},
            {calls.add("disable");disabled.await()}, {calls.add("request");written.await()},
            {calls.add("enable");true}) }
        yield();assertEquals(listOf("disable"),calls)
        disabled.complete(true);yield();assertEquals(listOf("disable","request"),calls)
        written.complete(true);assertTrue(job.await())
        assertEquals(listOf("disable","request","enable"),calls)
    }
}
