package com.dwip.neobrowser.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import com.dwip.neobrowser.R
import java.io.File

object NotificationHelper {
    const val CHANNEL_DOWNLOADS = "neo_downloads"
    const val CHANNEL_UPLOADS = "neo_uploads"

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val dlChannel = NotificationChannel(
                CHANNEL_DOWNLOADS,
                context.getString(R.string.channel_downloads),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = context.getString(R.string.channel_downloads_desc)
                enableVibration(false)
            }

            val ulChannel = NotificationChannel(
                CHANNEL_UPLOADS,
                context.getString(R.string.channel_uploads),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = context.getString(R.string.channel_uploads_desc)
                enableVibration(false)
            }

            notificationManager.createNotificationChannel(dlChannel)
            notificationManager.createNotificationChannel(ulChannel)
        }
    }

    fun buildDownloadProgressNotification(
        context: Context,
        notificationId: Int,
        fileName: String,
        progress: Int,
        totalBytes: Long
    ): NotificationCompat.Builder {
        val totalMb = if (totalBytes > 0) String.format("%.1f MB", totalBytes / (1024f * 1024f)) else "Unknown size"
        return NotificationCompat.Builder(context, CHANNEL_DOWNLOADS)
            .setContentTitle("Downloading $fileName")
            .setContentText(if (progress >= 0) "$progress% of $totalMb" else "Downloading…")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setProgress(100, if (progress >= 0) progress else 0, progress < 0)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
    }

    fun showDownloadCompleteNotification(
        context: Context,
        notificationId: Int,
        fileName: String,
        file: File,
        mimeType: String
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val openIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType.ifEmpty { "*/*" })
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(context, CHANNEL_DOWNLOADS)
            .setContentTitle("Download Complete")
            .setContentText(fileName)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(notificationId, notif)
    }

    fun buildUploadProgressNotification(
        context: Context,
        notificationId: Int,
        fileName: String,
        progress: Int
    ): NotificationCompat.Builder {
        return NotificationCompat.Builder(context, CHANNEL_UPLOADS)
            .setContentTitle("Uploading $fileName")
            .setContentText(if (progress >= 0) "$progress%" else "Uploading…")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setProgress(100, progress, progress < 0)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
    }
}
