package com.dwip.neobrowser

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool

object SoundManager {
    private var soundPool: SoundPool? = null
    private var clickSoundId: Int = 0
    private var tabSoundId: Int = 0
    private var successSoundId: Int = 0
    private var isLoaded: Boolean = false

    fun init(context: Context) {
        if (soundPool != null) return
        try {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            soundPool = SoundPool.Builder()
                .setMaxStreams(4)
                .setAudioAttributes(attrs)
                .build()

            soundPool?.let { pool ->
                val res = context.resources
                val clickResId = res.getIdentifier("sound_click", "raw", context.packageName)
                val tabResId = res.getIdentifier("sound_tab_new", "raw", context.packageName)
                val successResId = res.getIdentifier("sound_success", "raw", context.packageName)

                if (clickResId != 0) clickSoundId = pool.load(context, clickResId, 1)
                if (tabResId != 0) tabSoundId = pool.load(context, tabResId, 1)
                if (successResId != 0) successResId.let { successSoundId = pool.load(context, it, 1) }
                isLoaded = true
            }
        } catch (_: Exception) {}
    }

    fun playClick() {
        if (isLoaded && clickSoundId != 0) {
            soundPool?.play(clickSoundId, 0.35f, 0.35f, 1, 0, 1.0f)
        }
    }

    fun playTabNew() {
        if (isLoaded && tabSoundId != 0) {
            soundPool?.play(tabSoundId, 0.45f, 0.45f, 1, 0, 1.0f)
        }
    }

    fun playSuccess() {
        if (isLoaded && successSoundId != 0) {
            soundPool?.play(successSoundId, 0.45f, 0.45f, 1, 0, 1.0f)
        }
    }
}
