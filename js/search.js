// ==================== SEARCH ENGINE & RESULTS ====================
function performSearch(query) {
    query = (query || "").trim();
    if (!query) {
        showHomeView();
        return;
    }

    // Direct domain detection
    if (query.endsWith('.neo') || query.startsWith('fetch://')) {
        const cleanDomain = query.replace('fetch://', '').replace(/\/$/, '');
        if (REGISTRY[cleanDomain]) {
            loadNeoDomain(cleanDomain);
            return;
        }
    }

    // If external URL
    if (/^https?:\/\//i.test(query)) {
        loadWebUrl(query);
        return;
    }

    activeQuery = query;
    const heroSearchInput = document.getElementById('hero-search-input');
    const omniboxInput = document.getElementById('omnibox-input');
    const discoverSection = document.getElementById('discover-section');
    const resultsView = document.getElementById('results-view');
    const resultsStats = document.getElementById('results-stats');
    const googleBoxTitle = document.getElementById('google-box-title');
    const resultsList = document.getElementById('results-list');
    const searchView = document.getElementById('search-view');

    if (heroSearchInput) heroSearchInput.value = query;
    if (omniboxInput) omniboxInput.value = query;

    // Show Results View, Hide Discover Section
    if (discoverSection) discoverSection.style.display = 'none';
    if (resultsView) resultsView.style.display = 'flex';

    // Search registry
    const qLower = query.toLowerCase();
    const results = [];
    for (const [domain, meta] of Object.entries(REGISTRY)) {
        const name = (meta.name || "").toLowerCase();
        const cat = getSiteCategory(meta.path);
        if (name.includes(qLower) || domain.toLowerCase().includes(qLower) || cat.toLowerCase().includes(qLower)) {
            results.push({ domain, meta, cat });
        }
    }

    if (resultsStats) resultsStats.textContent = `Found ${results.length} .neo sites for "${query}" (in 0.01s)`;
    if (googleBoxTitle) googleBoxTitle.textContent = `Search Google Web for "${query}"`;
    if (resultsList) resultsList.innerHTML = '';

    if (results.length === 0) {
        const noRes = document.createElement('div');
        noRes.style = "padding: 30px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);";
        noRes.innerHTML = `
            <div style="width: 36px; height: 36px; margin: 0 auto 12px auto; color: var(--primary);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
            <div style="font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px;">No matching .neo sites found</div>
            <div style="font-size: 13px;">No registered .neo domain matched "${escapeHtml(query)}". Try searching on Google Web below.</div>
        `;
        if (resultsList) resultsList.appendChild(noRes);
    } else {
        results.forEach(({ domain, meta, cat }) => {
            const icon = getFaviconHtml(domain, meta.name);
            const card = document.createElement('div');
            card.className = 'serp-card';
            card.innerHTML = `
                <div class="serp-breadcrumb">
                    ${icon}
                    <span>fetch://${domain}</span>
                    <span style="color: var(--text-dim);">› ${meta.path || 'site'}</span>
                </div>
                <div class="serp-title">
                    <span>${escapeHtml(meta.name)}</span>
                    <span class="launch-arrow">↗</span>
                </div>
                <div class="serp-desc">
                    Decentralized application accessible on the Neo network at fetch://${domain}. Fast, peer-routed, and offline-capable.
                </div>
                <div class="serp-meta">
                    <span class="serp-tag">${cat}</span>
                    <span class="serp-tag">Instant Launch</span>
                </div>
            `;
            card.addEventListener('click', () => {
                loadNeoDomain(domain);
            });
            if (resultsList) resultsList.appendChild(card);
        });
    }

    // Scroll to top of results
    if (searchView) searchView.scrollTop = 0;
}

function showHomeView() {
    const resultsView = document.getElementById('results-view');
    const discoverSection = document.getElementById('discover-section');
    const heroSearchInput = document.getElementById('hero-search-input');
    const omniboxInput = document.getElementById('omnibox-input');
    const protocolText = document.getElementById('protocol-text');

    if (resultsView) resultsView.style.display = 'none';
    if (discoverSection) discoverSection.style.display = 'flex';
    activeQuery = "";
    if (heroSearchInput) heroSearchInput.value = "";
    if (omniboxInput) omniboxInput.value = "";
    if (protocolText) protocolText.textContent = "fetch://";
    currentLoadedDomain = null;
    hideWebview();
    if (typeof updateActiveTabState === 'function') {
        updateActiveTabState("", "NeoSearch");
    }
    currentFeatured4 = pick4RandomSites();
    isShowingAll = false;
    renderDiscoverGrid();
}

function updateAutocomplete(inputEl) {
    const omniboxDropdown = document.getElementById('omnibox-dropdown');
    if (!omniboxDropdown) return;

    const val = inputEl.value.trim().toLowerCase();
    if (!val) {
        omniboxDropdown.style.display = 'none';
        return;
    }

    const matches = [];
    for (const [domain, meta] of Object.entries(REGISTRY)) {
        if (domain.toLowerCase().includes(val) || (meta.name && meta.name.toLowerCase().includes(val))) {
            matches.push({ domain, meta });
            if (matches.length >= 7) break;
        }
    }

    if (matches.length === 0) {
        omniboxDropdown.style.display = 'none';
        return;
    }

    omniboxDropdown.innerHTML = '';
    matches.forEach(({ domain, meta }) => {
        const cat = getSiteCategory(meta.path);
        const icon = getFaviconHtml(domain, meta.name);
        const item = document.createElement('div');
        item.className = 'omnibox-item';
        item.innerHTML = `
            <div class="omnibox-item-left">
                <span class="item-icon">${icon}</span>
                <div>
                    <div class="item-title">${escapeHtml(meta.name)}</div>
                    <div class="item-domain">fetch://${domain}</div>
                </div>
            </div>
            <span class="item-badge">${cat}</span>
        `;
        item.addEventListener('click', () => {
            omniboxDropdown.style.display = 'none';
            loadNeoDomain(domain);
        });
        omniboxDropdown.appendChild(item);
    });

    omniboxDropdown.style.display = 'block';
}
