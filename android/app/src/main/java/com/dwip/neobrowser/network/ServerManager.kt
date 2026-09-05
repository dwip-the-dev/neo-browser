package com.dwip.neobrowser.network

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ServerManager {
    private const val VERCEL_FALLBACK = "https://neobrowser-bcknd.vercel.app"
    private const val GITHUB_KEY_URL = "https://neobrowser-backend.github.io/key/index.json"

    var globalServerUrl: String = VERCEL_FALLBACK
        private set

    val registry = mutableMapOf<String, NeoSite>()
    var registryVersion: String = ""
        private set

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    suspend fun initializeServerUrl(): String = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url(GITHUB_KEY_URL).build()
            val resp = client.newCall(req).execute()
            if (resp.isSuccessful) {
                val body = resp.body?.string()
                if (!body.isNullOrEmpty()) {
                    val json = JSONObject(body)
                    val candidate = json.optString("GLOBAL_SERVER_URL", "")
                    if (candidate.isNotEmpty() && isServerAlive(candidate)) {
                        globalServerUrl = candidate.trimEnd('/')
                        return@withContext globalServerUrl
                    }
                }
            }
        } catch (_: Exception) {
            // fallback
        }
        globalServerUrl = VERCEL_FALLBACK
        globalServerUrl
    }

    private fun isServerAlive(url: String): Boolean {
        return try {
            val checkReq = Request.Builder().url("${url.trimEnd('/')}/status").build()
            val checkResp = client.newCall(checkReq).execute()
            checkResp.isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    suspend fun checkServerStatus(): ServerStatus = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url("${globalServerUrl}/status").build()
            val resp = client.newCall(req).execute()
            if (resp.isSuccessful) {
                val json = JSONObject(resp.body?.string() ?: "{}")
                val status = json.optString("status", "online")
                val entries = json.optInt("entries", registry.size)
                val version = json.optString("version", "")
                return@withContext ServerStatus(status, globalServerUrl, entries, version)
            }
        } catch (e: Exception) {
            return@withContext ServerStatus("offline", globalServerUrl, 0, "")
        }
        ServerStatus("offline", globalServerUrl, 0, "")
    }

    suspend fun syncRegistry(): Boolean = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url("${globalServerUrl}/api/registry").build()
            val resp = client.newCall(req).execute()
            if (resp.isSuccessful) {
                val json = JSONObject(resp.body?.string() ?: "{}")
                if (json.optString("status") == "success") {
                    val regObj = json.optJSONObject("registry")
                    if (regObj != null) {
                        registry.clear()
                        for (key in regObj.keys()) {
                            val siteObj = regObj.getJSONObject(key)
                            val name = siteObj.optString("name", key)
                            val path = siteObj.optString("path", "")
                            registry[key] = NeoSite(key, name, path)
                        }
                    }
                    registryVersion = json.optString("version", "")
                    return@withContext true
                }
            }
        } catch (_: Exception) {}
        false
    }

    fun resolveSiteUrl(domain: String, context: Context? = null): String {
        val clean = domain.trim()
            .replace("fetch://", "")
            .replace("https://", "")
            .replace("http://", "")
            .trimEnd('/')
        return "${globalServerUrl}/site/$clean/"
    }
}
