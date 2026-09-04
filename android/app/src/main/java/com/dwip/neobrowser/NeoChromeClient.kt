package com.dwip.neobrowser

import android.net.Uri
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView

class NeoChromeClient(
    private val onProgressUpdate: (progress: Int) -> Unit,
    private val onTitleReceived: (title: String) -> Unit,
    private val onOpenFileChooser: (callback: ValueCallback<Array<Uri>>, params: FileChooserParams) -> Unit,
    private val onShowCustomViewCallback: (view: View, callback: CustomViewCallback) -> Unit,
    private val onHideCustomViewCallback: () -> Unit
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        onProgressUpdate(newProgress)
    }

    override fun onReceivedTitle(view: WebView?, title: String?) {
        super.onReceivedTitle(view, title)
        title?.let { onTitleReceived(it) }
    }

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        if (filePathCallback != null && fileChooserParams != null) {
            onOpenFileChooser(filePathCallback, fileChooserParams)
            return true
        }
        return false
    }

    override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
        if (view != null && callback != null) {
            onShowCustomViewCallback(view, callback)
        }
    }

    override fun onHideCustomView() {
        onHideCustomViewCallback()
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        // Automatically grant camera and audio permissions for Neo P2P WebRTC portals
        request?.grant(request.resources)
    }
}
