package com.dwip.neobrowser

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView

@SuppressLint("SetJavaScriptEnabled")
class NeoWebView(context: Context) : WebView(context) {

    private var defaultMobileUserAgent: String = ""

    init {
        // Force Dark Background
        setBackgroundColor(0xFF09090B.toInt())

        // Hardware Acceleration
        setLayerType(View.LAYER_TYPE_HARDWARE, null)

        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true

            // Multi-touch Zoom
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false

            // Media & WebRTC
            mediaPlaybackRequiresUserGesture = false

            // Mixed content for decentralized network assets
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // Performance & Caching
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true

            // User Agent (Mobile Chrome with NeoMobile tag)
            userAgentString = "$userAgentString NeoMobile/8.0.1"
        }

        defaultMobileUserAgent = settings.userAgentString

        // Enable debugging in debug builds
        if (BuildConfig.DEBUG) {
            setWebContentsDebuggingEnabled(true)
        }
    }

    fun setDesktopMode(enabled: Boolean) {
        settings.userAgentString = if (enabled) {
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        } else {
            defaultMobileUserAgent
        }
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
    }
}
