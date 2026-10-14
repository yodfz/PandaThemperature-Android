package com.example.pandatemperature.data.device.parser
import org.junit.Assert.*
import org.junit.Test
class RetentionRequestBuilderTest {
    @Test fun absentCapabilityDoesNotWrite() {
        for(caps in listOf(0,0x3F,0x40,0x7F)) assertNull(RetentionRequestBuilder.buildDisable(caps))
    }
    @Test fun disableUsesOnlyFiveByteZeroHistoryCommand() {
        for(caps in listOf(0x80,0xFF))
            assertArrayEquals(byteArrayOf(0,0,0,0,4),RetentionRequestBuilder.buildDisable(caps))
    }
}
