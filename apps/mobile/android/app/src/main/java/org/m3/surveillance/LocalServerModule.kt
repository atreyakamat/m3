package org.m3.surveillance

import android.content.Context
import android.util.Log
import com.chaquo.python.PyException
import com.chaquo.python.PyObject
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * LocalServerModule — hosts the REAL M3 FastAPI backend inside the app process
 * via Chaquopy (CPython 3.12) and uvicorn, bound to 127.0.0.1 only.
 *
 * Responsibilities:
 *  - Lazily start the embedded Python runtime (`Python.start(AndroidPlatform)`).
 *  - Extract the alembic migration tree (APK assets `alembic_pack/`) into the
 *    app-private files dir — data files must exist as REAL files because
 *    alembic loads them from disk.
 *  - Drive m3_local_server.py: start/status/stop/reset.
 *  - Surface explicit failure text to the JS layer (never a fabricated
 *    success).
 *
 * All Python work happens on the RN native-modules background thread; the
 * server itself runs inside a Python thread in the app process (lifecycle
 * documented in docs/STANDALONE_LOCAL_SERVER.md).
 */
class LocalServerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val filesDir: String
        get() = reactApplicationContext.filesDir.absolutePath

    private val PORT = 8741L // must match src/api.ts LOCAL_SERVER_PORT

    override fun getName() = "M3LocalServer"

    private fun ensurePython() {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(reactApplicationContext as Context))
        }
    }

    private fun extractMigrationsIfNeeded() {
        val migrRoot = File(filesDir, "migration")
        val marker = File(migrRoot, ".extracted")
        val stamp = "3.12.15-migr1"
        if (marker.exists() && marker.readText().trim() == stamp) return
        val mgr = reactApplicationContext.assets
        val entries = mgr.list("alembic_pack") ?: emptyArray()
        // Top level: alembic.ini + alembic/ (recursively copied)
        for (entry in entries) {
            copyAssetRecursive("alembic_pack/$entry", migrRoot)
        }
        if (entries.isEmpty()) throw IllegalStateException("no migrations packaged in APK assets")
        marker.parentFile?.mkdirs()
        marker.writeText(stamp)
    }

    private fun copyAssetRecursive(assetPath: String, targetDir: File) {
        val name = assetPath.substringAfterLast('/')
        val target = File(targetDir, name)
        val children = try {
            reactApplicationContext.assets.list(assetPath).orEmpty()
        } catch (e: Exception) {
            emptyArray<String>()
        }
        if (children.isEmpty()) {
            target.parentFile?.mkdirs()
            reactApplicationContext.assets.open(assetPath).use { ins ->
                target.outputStream().use { outs -> ins.copyTo(outs) }
            }
        } else {
            target.mkdirs()
            for (child in children) copyAssetRecursive("$assetPath/$child", target)
        }
    }

    private fun module(): PyObject {
        ensurePython()
        return Python.getInstance().getModule("m3_local_server")
    }

    @ReactMethod
    fun start(dataDirUnused: String?, portUnused: Double, promise: Promise) {
        try {
            ensurePython()
            extractMigrationsIfNeeded()
            module().callAttr("start", filesDir, PORT)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("M3LocalServer", "start failed", e)
            promise.reject("START_ERROR", describe(e), e)
        }
    }

    @ReactMethod
    fun status(promise: Promise) {
        try {
            ensurePython()
            promise.resolve(module().callAttr("status").toString())
        } catch (e: Exception) {
            // Before Python is started, status is simply idle.
            promise.resolve("""{"status":"idle","detail":"python not started: ${describe(e)}"}""")
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            module().callAttr("stop")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("M3LocalServer", "stop failed", e)
            promise.reject("STOP_ERROR", describe(e), e)
        }
    }

    @ReactMethod
    fun reset(dataDirUnused: String?, promise: Promise) {
        try {
            module().callAttr("reset", filesDir)
            promise.resolve(true)
        } catch (e: PyException) {
            Log.e("M3LocalServer", "reset failed", e)
            promise.reject("RESET_ERROR", describe(e), e)
        } catch (e: Exception) {
            Log.e("M3LocalServer", "reset failed", e)
            promise.reject("RESET_ERROR", describe(e), e)
        }
    }

    private fun describe(e: Exception): String =
        (e.message ?: e.toString()).take(400)
}
