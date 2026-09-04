package com.dwip.neobrowser.worker

import android.app.NotificationManager
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.random.Random

class UploadWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val KEY_FILE_PATH = "file_path"
        const val KEY_TARGET_URL = "target_url"
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    override suspend fun doWork(): Result {
        val filePath = inputData.getString(KEY_FILE_PATH) ?: return Result.failure()
        val targetUrl = inputData.getString(KEY_TARGET_URL) ?: return Result.failure()

        val file = File(filePath)
        if (!file.exists()) return Result.failure()

        val notificationId = Random.nextInt(20000, 99999)

        val initialNotif = NotificationHelper.buildUploadProgressNotification(
            context, notificationId, file.name, 0
        ).build()
        setForeground(ForegroundInfo(notificationId, initialNotif))

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .build()

        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "file",
                file.name,
                file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
            )
            .build()

        val request = Request.Builder()
            .url(targetUrl)
            .post(body)
            .build()

        return try {
            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val completeNotif = NotificationHelper.buildUploadProgressNotification(
                    context, notificationId, file.name, 100
                ).setContentTitle("Upload Complete")
                    .setOngoing(false)
                    .build()
                notificationManager.notify(notificationId, completeNotif)
                Result.success()
            } else {
                Result.failure()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure()
        }
    }
}
