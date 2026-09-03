// ==================== DYNAMIC FAVICON & VECTOR ICON ENGINE ====================

const PALETTES = [
    ["#38bdf8", "#818cf8"], // Cyan -> Indigo
    ["#f43f5e", "#fb923c"], // Rose -> Orange
    ["#10b981", "#06b6d4"], // Emerald -> Cyan
    ["#8b5cf6", "#d946ef"], // Purple -> Fuchsia
    ["#f59e0b", "#ef4444"], // Amber -> Red
    ["#06b6d4", "#3b82f6"]  // Cyan -> Blue
];

/**
 * Deterministically generates an algorithmic vector SVG badge for any domain.
 * Ensures 100% icon coverage across hundreds of thousands of sites without missing assets.
 */
function generateAvatarSvg(domain) {
    const raw = (domain || "").replace(/^fetch:\/\//, "").replace(/\.neo$/, "").replace(/[-_]/g, " ").trim();
    const char = (raw[0] || "N").toUpperCase();
    
    let hash = 0;
    const str = domain || "neo";
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % PALETTES.length;
    const [c1, c2] = PALETTES[idx];
    const gradId = `av_${Math.abs(hash)}_${char.charCodeAt(0)}`;

    return `<svg class="favicon-img avatar-svg" viewBox="0 0 64 64" width="100%" height="100%">
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${c1}"/>
                <stop offset="100%" stop-color="${c2}"/>
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#${gradId})"/>
        <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${char}</text>
    </svg>`;
}

/**
 * Returns dynamic favicon HTML with multi-tiered resilience:
 * Tier 1: Local / Cloud server (/favicon/<domain>)
 * Tier 2: Local cache assets/favicons/<domain>.png
 * Tier 3: Live Google Favicon CDN
 * Tier 4: Algorithmic SVG vector avatar
 */
function getFaviconHtml(domain, altName = "") {
    const clean = (domain || "").replace(/^fetch:\/\//, "").replace(/\/$/, "");
    const baseUrl = (typeof GLOBAL_SERVER_URL !== "undefined" ? GLOBAL_SERVER_URL : "https://neobrowser-bcknd.vercel.app").replace(/\/+$/, "");
    const primarySrc = `${baseUrl}/favicon/${clean}`;
    const localSrc = `assets/favicons/${clean}.png`;
    const cdnFallback = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${clean}&size=64`;
    
    return `<img src="${primarySrc}" class="favicon-img" onerror="this.onerror=function(){ this.onerror=function(){ this.parentElement.innerHTML = generateAvatarSvg('${clean}'); }; this.src='${cdnFallback}'; }; this.src='${localSrc}';" alt="${altName || clean}" loading="lazy">`;
}

/**
 * Returns favicon for external branded services
 */
function getServiceFaviconHtml(serviceName) {
    const localSrc = `assets/favicons/${serviceName}.png`;
    return `<img src="${localSrc}" class="favicon-img" alt="${serviceName}" loading="lazy">`;
}
