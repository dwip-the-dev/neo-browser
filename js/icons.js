// ==================== REAL FAVICON & VECTOR ICONS ====================

// Returns a real favicon <img> element from the internet / local cache with automatic fallback
function getFaviconHtml(domain, altName = "") {
    cleanDomain = (domain || "").replace("fetch://", "").replace(/\/$/, "");
    const localSrc = `assets/favicons/${cleanDomain}.png`;
    const fallbackUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${cleanDomain}&size=64`;
    
    return `<img src="${localSrc}" class="favicon-img" onerror="this.onerror=null; this.src='${fallbackUrl}'" alt="${altName || cleanDomain}" loading="lazy">`;
}

// Function to get external service favicon
function getServiceFaviconHtml(serviceName) {
    const localSrc = `assets/favicons/${serviceName}.png`;
    return `<img src="${localSrc}" class="favicon-img" alt="${serviceName}" loading="lazy">`;
}
