package com.example.pandatemperature

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Operator-only signature migration. Refuses to overwrite any existing private files. */
@RunWith(AndroidJUnit4::class)
class ReleaseDataTransferTest {
    @Test fun transferExplicitArchive() {
        val args = InstrumentationRegistry.getArguments()
        val action = args.getString("releaseDataAction")
        assumeTrue("Explicit restore/export only", action == "restore" || action == "export")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val data = instrumentation.targetContext.dataDir.canonicalFile
        val staging = requireNotNull(instrumentation.targetContext.getExternalFilesDir(null))
        val roots = setOf("databases", "shared_prefs", "files")
        fun destination(name: String): File {
            require(name.substringBefore('/') in roots && !name.contains('\\'))
            val file = File(data, name).canonicalFile
            require(file.path.startsWith(data.path + File.separator))
            return file
        }
        if (action == "restore") {
            val input = File(staging, "restore.zip")
            val hash = MessageDigest.getInstance("SHA-256").digest(input.readBytes())
                .joinToString("") { "%02x".format(it) }
            assertEquals("Archive must match operator hash", args.getString("archiveSha256"), hash)
            // Validate the whole archive and all destinations before touching target data.
            val entries = linkedMapOf<String, ByteArray>()
            ZipInputStream(input.inputStream()).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    require(!entry.isDirectory && !entries.containsKey(entry.name))
                    val file = destination(entry.name)
                    assertFalse("Refuse overwrite: ${entry.name}", file.exists())
                    entries[entry.name] = zip.readBytes()
                }
            }
            require(entries.containsKey("databases/panda_temperature_database"))
            entries.forEach { (name, bytes) ->
                val file = destination(name)
                file.parentFile!!.mkdirs()
                file.writeBytes(bytes)
                assertArrayEquals(bytes, file.readBytes())
            }
            input.delete()
        } else {
            ZipOutputStream(File(staging, "export.zip").outputStream()).use { zip ->
                roots.forEach { root ->
                    File(data, root).walkTopDown().filter { it.isFile }.forEach { file ->
                        val name = file.relativeTo(data).invariantSeparatorsPath
                        assertEquals(file.canonicalFile, destination(name))
                        zip.putNextEntry(ZipEntry(name))
                        file.inputStream().use { it.copyTo(zip) }
                        zip.closeEntry()
                    }
                }
            }
        }
    }
}
