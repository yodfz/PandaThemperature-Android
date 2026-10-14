package com.example.pandatemperature.utils

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/** Uses the same runtime permission check as MainActivity and handles revocation races. */
fun safeBluetoothDeviceName(context: Context, device: BluetoothDevice): String? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return null
    return try { device.name } catch (_: SecurityException) { null }
}
