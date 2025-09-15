# 🌐 NeoBrowser
![NeoBrowser Icon](icon.jpg)

A **fully decentralized, privacy-first web browser** built on Electron. Lightweight, sandboxed, and leaves zero traces - no accounts, no browsing history, no trackers, and no ads.

![Electron](https://img.shields.io/badge/Made_with-Electron-47848F?style=for-the-badge&logo=electron)
![Privacy](https://img.shields.io/badge/Privacy-First-4CAF50?style=for-the-badge)
![Decentralized](https://img.shields.io/badge/Completely-Decentralized-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Linux_FCC624?style=for-the-badge&logo=linux&logoColor=black)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![JSON](https://img.shields.io/badge/json-5E5C5C?style=for-the-badge&logo=json&logoColor=white)
![No Tracking](https://img.shields.io/badge/No-Tracking-success?style=for-the-badge)
![No Ads](https://img.shields.io/badge/No-Ads-red?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)

---

## ✨ Features

- 🔄 **Realtime Decentralization**  
  Automatically fetches the latest global server URL from a public JSON file. No hardcoded links - update the JSON and every user gets the new link instantly.

- 🔒 **Privacy by Default**  
  No accounts, no local storage of history/cookies/trackers, built-in `fetch://` protocol for sandboxed requests, and no ads or data collection (logging directory is temporary for testing purposes only).

- ⚡ **Zero Rebuilds**  
  Server updates propagate globally without app rebuilds thanks to our JSON key system.

- 🛠️ **Developer-Friendly**  
  Hot reload with `electronmon`, JSON-driven site mappings, and easy site management.

- 🖥️ **Lightweight & Cross-Platform**  
  Runs on Linux with minimal resource usage.

- 🪟 **Windows App Build Coming Soon**  
  .exe build for Windows in development.

---

## 📸 Demo

### 🔍 Home & Search 
![Demo Search](demo/demo-search.png)

### 🌐 Site Loading
![Demo Webview](demo/demo-webview.png)

### ⚙️ JSON Realtime Update
![Demo JSON](demo/demo-json.png)

---

## 🚀 Installation & Usage

1. **Clone and install**
   ```bash
   git clone https://github.com/dwip-the-dev/neobrowser.git
   cd neobrowser
   npm install
   ```

2. **Run in development**
   ```bash
   npm start
   ```

3. **Build for production**
   ```bash
   npm run build
   ```

---

## 🔑 How It Works

NeoBrowser fetches the latest server configuration from a public JSON file:

```json
{
  "GLOBAL_SERVER_URL": "https://example-server.trycloudflare.com"
}
```

All requests automatically use this dynamically updated URL, ensuring you never hit dead servers.

The configuration can be found at: `https://neobrowser-backend.github.io/key/index.json`

---

## 🛠️ Development

**Hot reload** is enabled via electronmon. The browser will automatically restart on file changes.

**Adding sites** is done through JSON configuration in `registry.json`:

```json
"pricing.neo": {
  "name": "Pricing",
  "path": "sites/official/pricing/index.html"
}
```

**Protocols**:
- `fetch://` - Custom sandboxed fetch requests

---

## 📅 Roadmap

- [ ] Multi-tab support
- [ ] Windows app build
- [ ] Built-in extensions (adblock toggle, custom DNS)
- [ ] Encrypted P2P mode (serverless experimental)
- [ ] Mobile app builds (Android / iOS)
- [ ] Plugin marketplace

---

## ⚠️ Disclaimer

NeoBrowser is an **experimental project**. Do not use it for sensitive browsing unless you fully understand the privacy/security model. The logging directory is temporary and will be removed in future releases.

---

## 💡 Credits

Built with [Electron](https://www.electronjs.org/) and inspired by decentralized & privacy-first software like **Tails OS**.

---

## 🖤 Contributing

Contributions are welcome! Open an issue, submit a PR, or suggest features.

---

## 📜 License

MIT License © 2025 NeoBrowser Team

---

*This README is a living document that will evolve with the project. Check back regularly for updates!*
