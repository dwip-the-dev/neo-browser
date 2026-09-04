package com.dwip.neobrowser.worker

import android.app.NotificationManager
import android.content.Context
import android.os.Environment
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit
import kotlin.random.Random

class DownloadWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val KEY_URL = "url"
        const val KEY_FILENAME = "filename"
        const val KEY_MIMETYPE = "mimetype"
        const val KEY_USER_AGENT = "user_agent"
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    override suspend fun doWork(): Result {
        val url = inputData.getString(KEY_URL) ?: return Result.failure()
        var fileName = inputData.getString(KEY_FILENAME) ?: "downloaded_file"
        val mimeType = inputData.getString(KEY_MIMETYPE) ?: ""
        val userAgent = inputData.getString(KEY_USER_AGENT) ?: ""

        val notificationId = Random.nextInt(1000, 99999)

        // Set foreground service info
        val initialNotif = NotificationHelper.buildDownloadProgressNotification(
            context, notificationId, fileName, 0, 0
        ).build()
        setForeground(ForegroundInfo(notificationId, initialNotif))

        val client = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()

        val request = Request.Builder()
            .url(url)
            .apply {
                if (userAgent.isNotEmpty()) header("User-Agent", userAgent)
            }
            .build()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                return Result.failure()
            }

            val body = response.body ?: return Result.failure()
            val totalBytes = body.contentLength()

            // Save in Downloads directory
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()

            var destFile = File(downloadsDir, fileName)
            var counter = 1
            while (destFile.exists()) {
                val dotIndex = fileName.lastIndexOf('.')
                destFile = if (dotIndex > 0) {
                    val namePart = fileName.substring(0, dotIndex)
                    val extPart = fileName.substring(dotIndex)
                    File(downloadsDir, "${namePart}_$counter$extPart")
                } else {
                    File(downloadsDir, "${fileName}_$counter")
                }
                counter++
            }

            body.byteStream().use { input ->
                FileOutputStream(destFile).use { output ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    var totalRead = 0L
                    var lastProgress = 0

                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                        totalRead += bytesRead

                        if (totalBytes > 0) {
                            val progress = ((totalRead * 100) / totalBytes).toInt()
                            if (progress != lastProgress) {
                                lastProgress = progress
                                val notif = NotificationHelper.buildDownloadProgressNotification(
                                    context, notificationId, destFile.name, progress, totalBytes
                                ).build()
                                notificationManager.notify(notificationId, notif)
                                setProgress(workDataOf("progress" to progress))
                            }
                        }
                    }
                    output.flush()
                }
            }

            // Show completion notification
            NotificationHelper.showDownloadCompleteNotification(
                context, notificationId, destFile.name, destFile, mimeType
            )

            return Result.success(workDataOf("filePath" to destFile.absolutePath))
        } catch (e: Exception) {
            e.printStackTrace()
            return Result.failure()
        }
    }
}
