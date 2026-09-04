package com.dwip.neobrowser.data

import android.webkit.WebView

data class NeoTab(
    val id: Int,
    var url: String,
    var title: String,
    var domain: String,
    var webView: WebView? = null
)

class TabManager {
    private val tabs = mutableListOf<NeoTab>()
    private var nextTabId = 1
    var activeTabId: Int = -1
        private set

    fun getTabs(): List<NeoTab> = tabs.toList()

    fun getActiveTab(): NeoTab? = tabs.find { it.id == activeTabId }

    fun createTab(url: String = "", title: String = "NeoSearch"): NeoTab {
        val tabId = nextTabId++
        val domain = url.replace("fetch://", "").replace("https://", "").replace("http://", "").trimEnd('/')
        val tab = NeoTab(tabId, url, title, domain)
        tabs.add(tab)
        activeTabId = tabId
        return tab
    }

    fun switchTab(tabId: Int): NeoTab? {
        val tab = tabs.find { it.id == tabId }
        if (tab != null) {
            activeTabId = tabId
        }
        return tab
    }

    fun closeTab(tabId: Int): NeoTab? {
        val index = tabs.indexOfFirst { it.id == tabId }
        if (index == -1) return null

        val closed = tabs.removeAt(index)
        closed.webView?.destroy()
        closed.webView = null

        if (tabs.isEmpty()) {
            return createTab("", "NeoSearch")
        }

        if (activeTabId == tabId) {
            val nextIndex = index.coerceAtMost(tabs.size - 1)
            activeTabId = tabs[nextIndex].id
        }
        return getActiveTab()
    }

    val count: Int
        get() = tabs.size
}
