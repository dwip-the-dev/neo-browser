package com.dwip.neobrowser

import android.app.Application
import com.dwip.neobrowser.worker.NotificationHelper

class NeoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize notification channels for downloads and uploads
        NotificationHelper.createNotificationChannels(this)
    }
}
