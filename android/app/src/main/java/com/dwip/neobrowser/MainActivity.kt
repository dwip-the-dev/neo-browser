package com.dwip.neobrowser

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.dwip.neobrowser.data.BookmarkManager
import com.dwip.neobrowser.data.NeoTab
import com.dwip.neobrowser.data.TabManager
import com.dwip.neobrowser.databinding.ActivityMainBinding
import com.dwip.neobrowser.databinding.DialogBookmarksBinding
import com.dwip.neobrowser.databinding.DialogTabsBinding
import com.dwip.neobrowser.network.NeoSite
import com.dwip.neobrowser.network.ServerManager
import com.dwip.neobrowser.worker.DownloadWorker
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val tabManager = TabManager()

    // File Upload Handlers
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback != null) {
            val results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            fileUploadCallback?.onReceiveValue(results)
            fileUploadCallback = null
        }
    }

    // Permission Launcher (Notifications for Android 13+)
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    // Fullscreen Custom View
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        requestRequiredPermissions()
        setupListeners()
        initializeNetworkAndServer()

        // Create initial tab
        val initialTab = tabManager.createTab("", "NeoSearch")
        setupTabWebView(initialTab)
        switchToTab(initialTab.id)

        // Handle intent data if opened via URL scheme
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.data ?: return
        val url = data.toString()
        if (url.isNotEmpty()) {
            loadUrlOrDomain(url)
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (permissions.isNotEmpty()) {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun initializeNetworkAndServer() {
        lifecycleScope.launch {
            binding.statusText.text = "Connecting…"
            binding.statusDot.setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.status_connecting))

            ServerManager.initializeServerUrl()
            ServerManager.syncRegistry()

            // Check server status loop
            while (isActive) {
                val status = ServerManager.checkServerStatus()
                withContext(Dispatchers.Main) {
                    if (status.status == "online") {
                        binding.statusDot.setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.accent_emerald))
                        val siteCount = if (status.entries > 0) status.entries else ServerManager.registry.size
                        binding.statusText.text = getString(R.string.online, siteCount)
                    } else {
                        binding.statusDot.setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.status_error))
                        binding.statusText.text = getString(R.string.offline)
                    }
                }
                delay(20000)
            }
        }
    }

    private fun setupListeners() {
        // Omnibox Actions
        binding.btnGo.setOnClickListener {
            val query = binding.omniboxInput.text.toString().trim()
            if (query.isNotEmpty()) loadUrlOrDomain(query)
        }

        binding.omniboxInput.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_GO || (event != null && event.keyCode == KeyEvent.KEYCODE_ENTER)) {
                val query = binding.omniboxInput.text.toString().trim()
                if (query.isNotEmpty()) loadUrlOrDomain(query)
                hideKeyboard()
                true
            } else {
                false
            }
        }

        binding.btnClear.setOnClickListener {
            binding.omniboxInput.text.clear()
            binding.btnClear.isVisible = false
        }



        // Top Navigation Buttons
        binding.btnBrand.setOnClickListener {
            loadNeoSearchHome()
        }

        binding.btnP2pDrop.setOnClickListener {
            loadUrlOrDomain("share.neo")
        }

        // Bottom Navigation Bar
        binding.btnBack.setOnClickListener {
            val activeTab = tabManager.getActiveTab()
            if (activeTab?.webView?.canGoBack() == true) {
                activeTab.webView?.goBack()
            }
        }

        binding.btnForward.setOnClickListener {
            val activeTab = tabManager.getActiveTab()
            if (activeTab?.webView?.canGoForward() == true) {
                activeTab.webView?.goForward()
            }
        }

        binding.btnHome.setOnClickListener {
            loadNeoSearchHome()
        }

        binding.btnBookmarks.setOnClickListener {
            showBookmarksDialog()
        }

        binding.btnTabs.setOnClickListener {
            showTabsDialog()
        }

        binding.btnDownloads.setOnClickListener {
            val intent = Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            try {
                startActivity(intent)
            } catch (_: Exception) {
                Toast.makeText(this, "Downloads folder opened", Toast.LENGTH_SHORT).show()
            }
        }

        // Error retry
        binding.btnRetry.setOnClickListener {
            binding.errorOverlay.isVisible = false
            tabManager.getActiveTab()?.webView?.reload()
        }
    }

    private fun setupTabWebView(tab: NeoTab) {
        val webView = NeoWebView(this)

        webView.webViewClient = NeoClient(
            onPageStartedCallback = { url ->
                binding.loadingBar.isVisible = true
                binding.errorOverlay.isVisible = false
                updateOmniboxForUrl(url)
            },
            onPageFinishedCallback = { url ->
                binding.loadingBar.isVisible = false
                updateOmniboxForUrl(url)
                updateNavigationButtons()
            },
            onErrorCallback = { desc ->
                binding.loadingBar.isVisible = false
                binding.errorDesc.text = desc
                binding.errorOverlay.isVisible = true
            }
        )

        webView.webChromeClient = NeoChromeClient(
            onProgressUpdate = { progress ->
                binding.loadingBar.progress = progress
                binding.loadingBar.isVisible = progress in 1..99
            },
            onTitleReceived = { title ->
                tab.title = title
            },
            onOpenFileChooser = { callback, params ->
                fileUploadCallback = callback
                val intent = params.createIntent()
                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    Toast.makeText(this, "Cannot open file chooser", Toast.LENGTH_SHORT).show()
                }
            },
            onShowCustomViewCallback = { view, callback ->
                customView = view
                customViewCallback = callback
                binding.fullscreenCustomView.addView(view)
                binding.fullscreenCustomView.isVisible = true
            },
            onHideCustomViewCallback = {
                binding.fullscreenCustomView.removeView(customView)
                binding.fullscreenCustomView.isVisible = false
                customViewCallback?.onCustomViewHidden()
                customView = null
                customViewCallback = null
            }
        )

        // File download listener
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
            startBackgroundDownload(url, fileName, mimetype, userAgent)
        }

        tab.webView = webView
        binding.webviewContainer.addView(webView)
    }

    private fun switchToTab(tabId: Int) {
        val tab = tabManager.switchTab(tabId) ?: return

        // Hide other webviews, show this one
        for (t in tabManager.getTabs()) {
            t.webView?.isVisible = (t.id == tab.id)
        }

        binding.tabCountBadge.text = tabManager.count.toString()

        if (tab.url.isEmpty()) {
            loadNeoSearchHome()
        } else {
            updateOmniboxForUrl(tab.url)
        }
        updateNavigationButtons()
    }

    private fun loadUrlOrDomain(input: String) {
        val trimmed = input.trim()
        val activeTab = tabManager.getActiveTab() ?: return

        hideKeyboard()

        val targetUrl = when {
            trimmed.startsWith("fetch://") || trimmed.endsWith(".neo") || trimmed.contains(".neo/") -> {
                val domain = trimmed.replace("fetch://", "").replace("https://", "").replace("http://", "").trimEnd('/')
                activeTab.domain = domain
                activeTab.url = "fetch://$domain/"
                ServerManager.resolveSiteUrl(domain)
            }
            trimmed.startsWith("http://") || trimmed.startsWith("https://") -> {
                activeTab.url = trimmed
                trimmed
            }
            else -> {
                // Search query against Neo serverless endpoint
                activeTab.url = "${ServerManager.globalServerUrl}/search?query=${Uri.encode(trimmed)}"
                activeTab.url
            }
        }

        activeTab.webView?.loadUrl(targetUrl)
    }

    private fun loadNeoSearchHome() {
        val activeTab = tabManager.getActiveTab() ?: return
        activeTab.domain = ""
        activeTab.url = ""
        binding.omniboxInput.setText("")
        binding.protocolBadge.text = "fetch://"
        activeTab.webView?.loadUrl(ServerManager.globalServerUrl)
    }

    private fun updateOmniboxForUrl(url: String) {
        if (url.contains("/site/")) {
            val parts = url.split("/site/")
            if (parts.size > 1) {
                val domain = parts[1].trimEnd('/')
                binding.protocolBadge.text = "fetch://"
                binding.omniboxInput.setText(domain)
                binding.btnClear.isVisible = true
                return
            }
        }
        binding.protocolBadge.text = if (url.startsWith("https")) "https://" else "http://"
        binding.omniboxInput.setText(url)
        binding.btnClear.isVisible = url.isNotEmpty()
    }

    private fun updateNavigationButtons() {
        val activeTab = tabManager.getActiveTab()
        val wv = activeTab?.webView
        binding.btnBack.alpha = if (wv?.canGoBack() == true) 1.0f else 0.35f
        binding.btnForward.alpha = if (wv?.canGoForward() == true) 1.0f else 0.35f
    }

    private fun startBackgroundDownload(url: String, fileName: String, mimeType: String, userAgent: String) {
        Toast.makeText(this, "Starting download: $fileName", Toast.LENGTH_SHORT).show()

        val downloadWork = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setInputData(
                workDataOf(
                    DownloadWorker.KEY_URL to url,
                    DownloadWorker.KEY_FILENAME to fileName,
                    DownloadWorker.KEY_MIMETYPE to mimeType,
                    DownloadWorker.KEY_USER_AGENT to userAgent
                )
            )
            .build()

        WorkManager.getInstance(this).enqueue(downloadWork)
    }

    private fun showBookmarksDialog() {
        val dialog = BottomSheetDialog(this, R.style.Theme_NeoBrowser_BottomSheet)
        val sheetBinding = DialogBookmarksBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)

        sheetBinding.rvBookmarks.layoutManager = LinearLayoutManager(this)
        sheetBinding.rvBookmarks.adapter = object : RecyclerView.Adapter<BookmarkViewHolder>() {
            val items = BookmarkManager.defaultBookmarks

            override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): BookmarkViewHolder {
                val v = LayoutInflater.from(parent.context).inflate(R.layout.item_bookmark, parent, false)
                return BookmarkViewHolder(v)
            }

            override fun onBindViewHolder(holder: BookmarkViewHolder, position: Int) {
                val site = items[position]
                holder.title.text = site.name
                holder.domain.text = "fetch://${site.domain}/"
                holder.icon.text = site.icon
                holder.itemView.setOnClickListener {
                    dialog.dismiss()
                    loadUrlOrDomain(site.domain)
                }
            }

            override fun getItemCount() = items.size
        }

        dialog.show()
    }

    private fun showTabsDialog() {
        val dialog = BottomSheetDialog(this, R.style.Theme_NeoBrowser_BottomSheet)
        val sheetBinding = DialogTabsBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)

        sheetBinding.btnAddTab.setOnClickListener {
            dialog.dismiss()
            val newTab = tabManager.createTab("", "NeoSearch")
            setupTabWebView(newTab)
            switchToTab(newTab.id)
        }

        sheetBinding.rvTabs.layoutManager = LinearLayoutManager(this)
        sheetBinding.rvTabs.adapter = object : RecyclerView.Adapter<TabViewHolder>() {
            val tabs = tabManager.getTabs()

            override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TabViewHolder {
                val v = LayoutInflater.from(parent.context).inflate(R.layout.item_tab, parent, false)
                return TabViewHolder(v)
            }

            override fun onBindViewHolder(holder: TabViewHolder, position: Int) {
                val tab = tabs[position]
                holder.title.text = if (tab.title.isNotEmpty()) tab.title else "New Tab"
                holder.url.text = if (tab.domain.isNotEmpty()) "fetch://${tab.domain}/" else "NeoSearch Portal"
                holder.status.text = if (tab.id == tabManager.activeTabId) "• Active Tab" else "Background Tab"
                holder.status.setTextColor(
                    ContextCompat.getColor(
                        this@MainActivity,
                        if (tab.id == tabManager.activeTabId) R.color.primary_light else R.color.text_muted
                    )
                )

                holder.itemView.setOnClickListener {
                    dialog.dismiss()
                    switchToTab(tab.id)
                }

                holder.btnClose.setOnClickListener {
                    val nextActive = tabManager.closeTab(tab.id)
                    notifyItemRemoved(position)
                    if (nextActive != null) {
                        switchToTab(nextActive.id)
                    }
                    if (tabManager.count == 1) dialog.dismiss()
                }
            }

            override fun getItemCount() = tabs.size
        }

        dialog.show()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(binding.omniboxInput.windowToken, 0)
    }

    override fun onBackPressed() {
        if (customView != null) {
            binding.fullscreenCustomView.removeView(customView)
            binding.fullscreenCustomView.isVisible = false
            customViewCallback?.onCustomViewHidden()
            customView = null
            customViewCallback = null
            return
        }

        val activeTab = tabManager.getActiveTab()
        if (activeTab?.webView?.canGoBack() == true) {
            activeTab.webView?.goBack()
        } else if (tabManager.count > 1) {
            val activeId = tabManager.activeTabId
            val nextTab = tabManager.closeTab(activeId)
            if (nextTab != null) switchToTab(nextTab.id)
        } else {
            super.onBackPressed()
        }
    }

    class BookmarkViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val icon: TextView = view.findViewById(R.id.bm_icon)
        val title: TextView = view.findViewById(R.id.bm_title)
        val domain: TextView = view.findViewById(R.id.bm_domain)
    }

    class TabViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.tab_title)
        val url: TextView = view.findViewById(R.id.tab_url)
        val status: TextView = view.findViewById(R.id.tab_status)
        val btnClose: ImageView = view.findViewById(R.id.btn_close_tab)
    }
}
