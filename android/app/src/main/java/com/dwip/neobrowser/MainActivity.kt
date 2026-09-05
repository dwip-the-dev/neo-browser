package com.dwip.neobrowser

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
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
import com.dwip.neobrowser.databinding.DialogChromeMenuBinding
import com.dwip.neobrowser.databinding.DialogTabsBinding
import com.dwip.neobrowser.network.ServerManager
import com.dwip.neobrowser.worker.DownloadWorker
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.card.MaterialCardView
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

    // Fullscreen Custom View (HTML5 video)
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge system window configuration
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupWindowInsets()
        setupBackNavigation()
        requestRequiredPermissions()
        setupOmniboxAndToolbar()
        setupFindInPage()
        setupBottomBar()
        initializeNetworkAndServer()

        // Create initial tab
        val initialTab = tabManager.createTab("", "NeoSearch")
        setupTabWebView(initialTab)
        switchToTab(initialTab.id)

        // Handle intent data if opened via URL scheme
        handleIntent(intent)
    }

    private fun setupWindowInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, windowInsets ->
            val topInset = windowInsets.getInsets(
                WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.displayCutout()
            ).top
            val bottomInset = windowInsets.getInsets(
                WindowInsetsCompat.Type.navigationBars()
            ).bottom

            // Ensure top bar sits safely below status bar, notch, and Dynamic Island
            binding.topBar.setPadding(0, topInset, 0, 0)

            // Ensure bottom navigation bar sits safely above system navigation / gesture pill
            binding.bottomBar.setPadding(0, 0, 0, bottomInset)

            windowInsets
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    binding.fullscreenCustomView.removeView(customView)
                    binding.fullscreenCustomView.isVisible = false
                    customViewCallback?.onCustomViewHidden()
                    customView = null
                    customViewCallback = null
                    return
                }

                if (binding.findInPageBar.isVisible) {
                    closeFindInPage()
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
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })
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
            ServerManager.initializeServerUrl()
            ServerManager.syncRegistry()

            while (isActive) {
                ServerManager.checkServerStatus()
                delay(20000)
            }
        }
    }

    private fun setupOmniboxAndToolbar() {
        // Omnibox Input Focus & Clear Button
        binding.omniboxInput.setOnFocusChangeListener { _, hasFocus ->
            binding.btnClear.isVisible = hasFocus && binding.omniboxInput.text?.isNotEmpty() == true
            if (hasFocus) {
                binding.omniboxInput.selectAll()
            }
        }

        binding.omniboxInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                binding.btnClear.isVisible = binding.omniboxInput.hasFocus() && !s.isNullOrEmpty()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.omniboxInput.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_GO || (event != null && event.keyCode == KeyEvent.KEYCODE_ENTER)) {
                val query = binding.omniboxInput.text.toString().trim()
                if (query.isNotEmpty()) loadUrlOrDomain(query)
                binding.omniboxInput.clearFocus()
                hideKeyboard()
                true
            } else {
                false
            }
        }

        binding.btnClear.setOnClickListener {
            binding.omniboxInput.text?.clear()
            binding.btnClear.isVisible = false
            binding.omniboxInput.requestFocus()
            val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
            imm?.showSoftInput(binding.omniboxInput, InputMethodManager.SHOW_IMPLICIT)
        }

        binding.btnRefresh.setOnClickListener {
            tabManager.getActiveTab()?.webView?.reload()
        }

        binding.securityIcon.setOnClickListener {
            val activeTab = tabManager.getActiveTab()
            val url = activeTab?.webView?.url ?: activeTab?.url ?: ""
            val isNeo = url.contains("/site/") || url.startsWith("fetch://") || url.contains(".neo")
            val msg = if (isNeo) {
                "Decentralized Neo Protocol v2.0\nPeer-to-peer verified connection."
            } else if (url.startsWith("https://")) {
                "Connection is Secure (HTTPS)\nYour information is private when sent to this site."
            } else {
                "Site Connection\nDomain: ${formatDisplayUrl(url)}"
            }
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        // Top Chrome Tab Box
        binding.btnTabsTop.setOnClickListener {
            showTabsDialog()
        }

        // Top Chrome 3-Dots Menu
        binding.btnMoreMenu.setOnClickListener {
            showChromeMenuDialog()
        }

        // Error retry
        binding.btnRetry.setOnClickListener {
            binding.errorOverlay.isVisible = false
            tabManager.getActiveTab()?.webView?.reload()
        }
    }

    private fun setupFindInPage() {
        binding.findQueryInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s?.toString().orEmpty()
                val activeTab = tabManager.getActiveTab()
                if (query.isNotEmpty()) {
                    activeTab?.webView?.findAllAsync(query)
                } else {
                    activeTab?.webView?.clearMatches()
                    binding.findMatchCount.text = "0/0"
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.findQueryInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                tabManager.getActiveTab()?.webView?.findNext(true)
                true
            } else false
        }

        binding.btnFindNext.setOnClickListener {
            tabManager.getActiveTab()?.webView?.findNext(true)
        }

        binding.btnFindPrev.setOnClickListener {
            tabManager.getActiveTab()?.webView?.findNext(false)
        }

        binding.btnFindClose.setOnClickListener {
            closeFindInPage()
        }
    }

    private fun openFindInPage() {
        binding.findInPageBar.isVisible = true
        binding.findQueryInput.requestFocus()
        val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.showSoftInput(binding.findQueryInput, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun closeFindInPage() {
        tabManager.getActiveTab()?.webView?.clearMatches()
        binding.findInPageBar.isVisible = false
        binding.findQueryInput.text?.clear()
        binding.findMatchCount.text = "0/0"
        hideKeyboard()
    }

    private fun setupBottomBar() {
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
            val activeTab = tabManager.getActiveTab()
            val url = activeTab?.webView?.url ?: activeTab?.url ?: ""
            val title = activeTab?.title ?: "Neo Site"
            val display = formatDisplayUrl(url)
            val added = BookmarkManager.toggleBookmark(title, if (display.isNotEmpty()) display else url)
            updateBookmarkStarState(display, url)
            Toast.makeText(
                this,
                if (added) "Saved to bookmarks" else "Removed from bookmarks",
                Toast.LENGTH_SHORT
            ).show()
        }

        binding.btnBookmarks.setOnLongClickListener {
            showBookmarksDialog()
            true
        }

        binding.btnShare.setOnClickListener {
            shareCurrentPage()
        }
    }

    private fun setupTabWebView(tab: NeoTab) {
        val webView = NeoWebView(this)

        webView.setFindListener { activeMatchOrdinal, numberOfMatches, _ ->
            if (numberOfMatches > 0) {
                binding.findMatchCount.text = "${activeMatchOrdinal + 1}/$numberOfMatches"
            } else {
                binding.findMatchCount.text = "0/0"
            }
        }

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

        binding.tabCountTop.text = tabManager.count.toString()

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
            trimmed.startsWith("fetch://") || trimmed.endsWith(".neo") || trimmed.contains(".neo/") || trimmed.contains(".neo") -> {
                val domain = trimmed.replace("fetch://", "").replace("https://", "").replace("http://", "").trimEnd('/')
                activeTab.domain = domain
                activeTab.url = "fetch://$domain/"
                ServerManager.resolveSiteUrl(domain)
            }
            trimmed.startsWith("http://") || trimmed.startsWith("https://") -> {
                activeTab.url = trimmed
                trimmed
            }
            trimmed.contains(".") && !trimmed.contains(" ") -> {
                val withScheme = "https://$trimmed"
                activeTab.url = withScheme
                withScheme
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
        activeTab.webView?.loadUrl(ServerManager.globalServerUrl)
    }

    private fun formatDisplayUrl(rawUrl: String): String {
        if (rawUrl.isEmpty()) return ""
        if (rawUrl.contains("/site/")) {
            val parts = rawUrl.split("/site/")
            if (parts.size > 1) {
                return parts[1].trimEnd('/')
            }
        }
        if (rawUrl.contains("/search?query=")) {
            val query = rawUrl.substringAfter("/search?query=")
            return Uri.decode(query)
        }
        if (rawUrl.trimEnd('/') == ServerManager.globalServerUrl.trimEnd('/')) {
            return "NeoSearch Portal"
        }
        return rawUrl.removePrefix("https://").removePrefix("http://").removePrefix("fetch://").trimEnd('/')
    }

    private fun updateOmniboxForUrl(url: String) {
        val display = formatDisplayUrl(url)

        if (!binding.omniboxInput.hasFocus()) {
            binding.omniboxInput.setText(display)
        }
        binding.btnClear.isVisible = binding.omniboxInput.text?.isNotEmpty() == true && binding.omniboxInput.hasFocus()

        val isNeo = url.contains("/site/") || url.startsWith("fetch://") || url.contains(".neo")
        val isHttps = url.startsWith("https://")

        if (isNeo) {
            binding.securityIcon.setImageResource(R.drawable.ic_shield_neo)
            binding.securityIcon.setColorFilter(ContextCompat.getColor(this, R.color.accent_cyan))
        } else if (isHttps) {
            binding.securityIcon.setImageResource(R.drawable.ic_lock)
            binding.securityIcon.setColorFilter(ContextCompat.getColor(this, R.color.chrome_security_green))
        } else {
            binding.securityIcon.setImageResource(R.drawable.ic_lock)
            binding.securityIcon.setColorFilter(ContextCompat.getColor(this, R.color.chrome_icon_muted))
        }

        updateNavigationButtons()
        updateBookmarkStarState(display, url)
    }

    private fun updateBookmarkStarState(displayDomain: String, fullUrl: String) {
        val isBm = BookmarkManager.isBookmarked(displayDomain) || BookmarkManager.isBookmarked(fullUrl)
        binding.btnBookmarks.setImageResource(
            if (isBm) R.drawable.ic_star_filled else R.drawable.ic_star_outline
        )
        binding.btnBookmarks.setColorFilter(
            ContextCompat.getColor(
                this,
                if (isBm) R.color.accent_cyan else R.color.chrome_icon
            )
        )
    }

    private fun updateNavigationButtons() {
        val activeTab = tabManager.getActiveTab()
        val wv = activeTab?.webView
        val canBack = wv?.canGoBack() == true
        val canForward = wv?.canGoForward() == true

        binding.btnBack.isEnabled = canBack
        binding.btnBack.alpha = if (canBack) 1.0f else 0.35f

        binding.btnForward.isEnabled = canForward
        binding.btnForward.alpha = if (canForward) 1.0f else 0.35f
    }

    private fun shareCurrentPage() {
        val activeTab = tabManager.getActiveTab() ?: return
        val url = activeTab.webView?.url ?: activeTab.url
        if (url.isEmpty()) {
            Toast.makeText(this, "Nothing to share", Toast.LENGTH_SHORT).show()
            return
        }
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, activeTab.title.ifEmpty { "NeoBrowser Link" })
            putExtra(Intent.EXTRA_TEXT, url)
        }
        startActivity(Intent.createChooser(shareIntent, "Share via"))
    }

    private fun openDownloadsFolder() {
        val intent = Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        try {
            startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(this, "Downloads folder", Toast.LENGTH_SHORT).show()
        }
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

    private fun showChromeMenuDialog() {
        val dialog = BottomSheetDialog(this, R.style.Theme_NeoBrowser_BottomSheet)
        val menuBinding = DialogChromeMenuBinding.inflate(layoutInflater)
        dialog.setContentView(menuBinding.root)

        val activeTab = tabManager.getActiveTab()
        val wv = activeTab?.webView
        val currentUrl = wv?.url ?: activeTab?.url ?: ""
        val display = formatDisplayUrl(currentUrl)
        val isBm = BookmarkManager.isBookmarked(display) || BookmarkManager.isBookmarked(currentUrl)

        // Quick Action Row
        menuBinding.menuBtnForward.isEnabled = wv?.canGoForward() == true
        menuBinding.menuBtnForward.alpha = if (wv?.canGoForward() == true) 1.0f else 0.4f
        menuBinding.menuBtnForward.setOnClickListener {
            wv?.goForward()
            dialog.dismiss()
        }

        menuBinding.menuBtnStar.setImageResource(
            if (isBm) R.drawable.ic_star_filled else R.drawable.ic_star_outline
        )
        menuBinding.menuBtnStar.setColorFilter(
            ContextCompat.getColor(this, if (isBm) R.color.accent_cyan else R.color.chrome_icon)
        )
        menuBinding.menuBtnStar.setOnClickListener {
            val title = activeTab?.title ?: "Neo Site"
            val domain = if (display.isNotEmpty()) display else currentUrl
            val added = BookmarkManager.toggleBookmark(title, domain)
            updateBookmarkStarState(domain, currentUrl)
            Toast.makeText(
                this,
                if (added) "Saved to bookmarks" else "Removed from bookmarks",
                Toast.LENGTH_SHORT
            ).show()
            dialog.dismiss()
        }

        menuBinding.menuBtnReload.setOnClickListener {
            wv?.reload()
            dialog.dismiss()
        }

        menuBinding.menuBtnShare.setOnClickListener {
            dialog.dismiss()
            shareCurrentPage()
        }

        // Menu Items
        menuBinding.menuItemNewTab.setOnClickListener {
            dialog.dismiss()
            val newTab = tabManager.createTab("", "NeoSearch")
            setupTabWebView(newTab)
            switchToTab(newTab.id)
        }

        menuBinding.menuItemHistory.setOnClickListener {
            dialog.dismiss()
            Toast.makeText(this, "Decentralized history is stored privately on device", Toast.LENGTH_SHORT).show()
        }

        menuBinding.menuItemBookmarks.setOnClickListener {
            dialog.dismiss()
            showBookmarksDialog()
        }

        menuBinding.menuItemDownloads.setOnClickListener {
            dialog.dismiss()
            openDownloadsFolder()
        }

        // Desktop Site Toggle
        menuBinding.switchDesktopSite.isChecked = activeTab?.isDesktopMode == true
        menuBinding.menuItemDesktopSite.setOnClickListener {
            val newState = !(activeTab?.isDesktopMode ?: false)
            menuBinding.switchDesktopSite.isChecked = newState
            activeTab?.let { tab ->
                tab.isDesktopMode = newState
                (tab.webView as? NeoWebView)?.setDesktopMode(newState)
                tab.webView?.reload()
            }
            dialog.dismiss()
        }

        menuBinding.menuItemFindInPage.setOnClickListener {
            dialog.dismiss()
            openFindInPage()
        }

        menuBinding.menuItemP2pDrop.setOnClickListener {
            dialog.dismiss()
            loadUrlOrDomain("share.neo")
        }

        menuBinding.menuItemClearCache.setOnClickListener {
            dialog.dismiss()
            wv?.clearCache(true)
            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()
            wv?.reload()
            Toast.makeText(this, "Cache and cookies cleared", Toast.LENGTH_SHORT).show()
        }

        dialog.show()
    }

    private fun showBookmarksDialog() {
        val dialog = BottomSheetDialog(this, R.style.Theme_NeoBrowser_BottomSheet)
        val sheetBinding = DialogBookmarksBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)

        sheetBinding.rvBookmarks.layoutManager = LinearLayoutManager(this)
        val items = BookmarkManager.getAllBookmarks()
        sheetBinding.rvBookmarks.adapter = object : RecyclerView.Adapter<BookmarkViewHolder>() {
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

        sheetBinding.tvTabsTitle.text = "Tabs (${tabManager.count})"

        sheetBinding.btnAddTab.setOnClickListener {
            dialog.dismiss()
            val newTab = tabManager.createTab("", "NeoSearch")
            setupTabWebView(newTab)
            switchToTab(newTab.id)
        }

        sheetBinding.rvTabs.layoutManager = GridLayoutManager(this, 2)

        val adapter = object : RecyclerView.Adapter<TabViewHolder>() {
            val tabs = tabManager.getTabs().toMutableList()

            override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TabViewHolder {
                val v = LayoutInflater.from(parent.context).inflate(R.layout.item_tab, parent, false)
                return TabViewHolder(v)
            }

            override fun onBindViewHolder(holder: TabViewHolder, position: Int) {
                val tab = tabs[position]
                val isActive = tab.id == tabManager.activeTabId

                holder.title.text = if (tab.title.isNotEmpty()) tab.title else "NeoSearch"
                holder.url.text = when {
                    tab.domain.isNotEmpty() -> "fetch://${tab.domain}/"
                    tab.url.isNotEmpty() -> formatDisplayUrl(tab.url)
                    else -> "NeoSearch Portal"
                }

                if (isActive) {
                    holder.card.strokeColor = ContextCompat.getColor(this@MainActivity, R.color.accent_cyan)
                    holder.card.strokeWidth = (2 * resources.displayMetrics.density).toInt()
                    holder.status.text = "Active"
                    holder.status.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.accent_cyan))
                } else {
                    holder.card.strokeColor = ContextCompat.getColor(this@MainActivity, R.color.chrome_divider)
                    holder.card.strokeWidth = (1 * resources.displayMetrics.density).toInt()
                    holder.status.text = "Background"
                    holder.status.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.chrome_icon_muted))
                }

                holder.card.setOnClickListener {
                    dialog.dismiss()
                    switchToTab(tab.id)
                }

                holder.btnClose.setOnClickListener {
                    val nextActive = tabManager.closeTab(tab.id)
                    tabs.removeAt(position)
                    notifyItemRemoved(position)
                    notifyItemRangeChanged(position, tabs.size)
                    binding.tabCountTop.text = tabManager.count.toString()
                    sheetBinding.tvTabsTitle.text = "Tabs (${tabManager.count})"
                    if (nextActive != null) {
                        switchToTab(nextActive.id)
                    }
                    if (tabManager.count <= 1) {
                        dialog.dismiss()
                    }
                }
            }

            override fun getItemCount() = tabs.size
        }

        sheetBinding.rvTabs.adapter = adapter
        dialog.show()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(binding.omniboxInput.windowToken, 0)
    }

    class BookmarkViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val icon: TextView = view.findViewById(R.id.bm_icon)
        val title: TextView = view.findViewById(R.id.bm_title)
        val domain: TextView = view.findViewById(R.id.bm_domain)
    }

    class TabViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val card: MaterialCardView = view.findViewById(R.id.card_tab)
        val favicon: ImageView = view.findViewById(R.id.tab_favicon)
        val title: TextView = view.findViewById(R.id.tab_title)
        val url: TextView = view.findViewById(R.id.tab_url)
        val status: TextView = view.findViewById(R.id.tab_status)
        val btnClose: ImageView = view.findViewById(R.id.btn_close_tab)
    }
}
