// ==================== CONFIGURATION & DYNAMIC STATE ====================
const { ipcRenderer } = require('electron');

let GLOBAL_SERVER_URL = "https://neobrowser-bcknd.vercel.app";
let REGISTRY = {};
let REGISTRY_VERSION = "";
let activeQuery = "";
let currentLoadedDomain = null;
let isShowingAll = false;
let currentFeatured4 = [];
let selectedCategory = "all";
let discoverPage = 1;
const DISCOVER_PAGE_SIZE = 24;

function getSiteCategory(path) {
    if (!path) return "Games";
    const p = path.toLowerCase();
    if (p.includes("/official/")) return "Official";
    if (p.includes("/ai/")) return "AI";
    if (p.includes("/dev/")) return "Dev Tools";
    if (p.includes("/finance/")) return "Finance";
    if (p.includes("/productivity/")) return "Productivity";
    if (p.includes("/media/")) return "Media";
    if (p.includes("/social/")) return "Social";
    if (p.includes("/science/")) return "Science";
    if (p.includes("/security/")) return "Security";
    if (p.includes("/commerce/")) return "Commerce";
    if (p.includes("/games/") || p.includes("/sites/")) return "Games";
    if (p.includes("/testing/")) return "Testing";
    return "Games";
}

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Initializes registry from local cache or package file,
 * then triggers background synchronization with the global server.
 */
function initRegistry() {
    // 1. Try localStorage cache
    try {
        const cached = localStorage.getItem('neo_registry_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.reg && Object.keys(parsed.reg).length > 0) {
                REGISTRY = parsed.reg;
                REGISTRY_VERSION = parsed.version || "";
                console.log(`[CACHE] Loaded ${Object.keys(REGISTRY).length} cached sites (version: ${REGISTRY_VERSION})`);
            }
        }
    } catch (e) {
        console.warn("Could not read local registry cache:", e);
    }

    // 2. Fallback to bundled JSON if cache is empty
    if (Object.keys(REGISTRY).length === 0) {
        try {
            REGISTRY = require('./registry.json');
            console.log("[OK] Registry loaded from local JSON fallback:", Object.keys(REGISTRY).length, "entries");
        } catch (e) {
            console.warn("Could not require registry.json, initializing empty:", e);
            REGISTRY = {};
        }
    }

    // 3. Immediately trigger background server sync
    syncRegistryFromServer();
}

/**
 * Dynamic registry sync: fetches /api/registry from remote server.
 * Automatically updates in-memory registry, cache, and UI if remote version is newer.
 */
async function syncRegistryFromServer(force = false) {
    try {
        const baseUrl = (GLOBAL_SERVER_URL || "").replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/api/registry`, { cache: "no-store" });
        if (!res.ok) return false;

        const data = await res.json();
        if (data.status === "success" && data.version) {
            if (force || data.version !== REGISTRY_VERSION || Object.keys(REGISTRY).length !== data.entries) {
                console.log(`[SYNC] Syncing registry: remote version ${data.version} (${data.entries} sites) vs local ${REGISTRY_VERSION} (${Object.keys(REGISTRY).length} sites)`);
                
                if (data.registry) {
                    REGISTRY = data.registry;
                } else if (Array.isArray(data.items)) {
                    const newReg = {};
                    data.items.forEach(item => {
                        newReg[item.domain] = {
                            name: item.name,
                            path: item.path
                        };
                    });
                    REGISTRY = newReg;
                }
                
                REGISTRY_VERSION = data.version;
                
                // Save to localStorage for instant startup next launch
                try {
                    localStorage.setItem('neo_registry_cache', JSON.stringify({
                        version: REGISTRY_VERSION,
                        reg: REGISTRY
                    }));
                } catch (err) {
                    console.warn("Failed to persist registry cache:", err);
                }

                // Dynamically update UI if active
                if (typeof renderDiscoverGrid === "function") {
                    renderDiscoverGrid();
                }
                const pillText = document.getElementById('status-text');
                if (pillText) {
                    pillText.textContent = `${Object.keys(REGISTRY).length} Sites Online`;
                }

                return true;
            }
        }
    } catch (e) {
        console.warn("Background registry sync failed, using current offline copy:", e);
    }
    return false;
}
