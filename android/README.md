# [Android] NeoBrowser Android - Native Kotlin Port

A high-performance, privacy-first mobile browser for the **Neo Decentralized Web**, ported to native Android with **Kotlin**, **AndroidX WebKit**, and **Jetpack WorkManager**.

Package name: `com.dwip.neobrowser`

---

##  Features

- <i class="bi bi-globe2"></i> **Pure Base Browser Architecture**  
  All decentralized sites are dynamically loaded from the Neo serverless cloud backend (`https://neobrowser-bcknd.vercel.app/site/<domain>/`). The app acts as a fast, lightweight mobile gateway without bundled site bloat.

-  **Privacy & Decentralization First**  
  Zero tracking, zero ad telemetry, no Google web extensions, and built-in support for `fetch://<domain>.neo` protocols.

-  **P2P Drop Integration**  
  One-tap quick access to `fetch://share.neo` for real-time ephemeral peer-to-peer file transfers and WebSockets.

-  **Background Downloads with Notifications**  
  Downloads are processed via **Android Jetpack WorkManager** (`DownloadWorker`) with live progress percentage notifications, notification channels, foreground service handling, and direct tap-to-open from the system notification bar.

-  **File Uploads & Camera Support**  
  Native `WebChromeClient.onShowFileChooser` integration supporting camera capture, gallery selection, and all file MIME types for interactive decentralized applications.

- [Tabs] **Mobile Multi-Tab Manager**  
  Chrome-style tab manager with thumbnail cards, smooth animations, and dynamic tab switching.

- [*] **Quick-Launch Featured Portals**  
  Bottom sheet bookmarks including NeoShare, NeuralChat AI, CryptoTracker, Markdown Studio, 2048 Arcade, Cyber Threat Map, Lo-Fi Radio, and Cosmos 3D Explorer.

-  **Deep Cyberpunk Obsidian Theme**  
  Styled with edge-to-edge dark aesthetics, glowing violet `#8B5CF6` and cyan `#38BDF8` accents, and custom animated progress bars.

---

## Build & Installation

### Option 1: Using Android Studio
1. Open Android Studio.
2. Select **Open** and choose the `/android` directory.
3. Allow Gradle to sync dependencies.
4. Click **Run** or build APK from **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

### Option 2: Using Command Line
```bash
cd android
./gradlew assembleDebug
```
The compiled APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

##  Permissions

- `android.permission.INTERNET`: Connect to the Neo network and decentralized portals.
- `android.permission.POST_NOTIFICATIONS`: Display background download and upload progress.
- `android.permission.CAMERA`: Upload pictures directly from camera in .neo apps.
- `android.permission.FOREGROUND_SERVICE_DATA_SYNC`: Seamless background file downloading.
