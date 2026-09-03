// ==================== DISCOVER GRID & FEATURED SITES ====================
function pick4RandomSites() {
    const entries = Object.entries(REGISTRY);
    if (entries.length <= 4) return entries;
    const shuffled = [...entries].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
}

function renderDiscoverGrid() {
    const discoverGrid = document.getElementById('discover-grid');
    if (!discoverGrid) return;

    discoverGrid.innerHTML = '';
    const entries = Object.entries(REGISTRY);
    if (entries.length === 0) return;

    let displayEntries;
    const toggleText = document.getElementById('toggle-all-text');

    if (isShowingAll) {
        discoverGrid.classList.add('all-mode');
        displayEntries = entries;
        if (toggleText) toggleText.textContent = "Show Less (4)";
    } else {
        discoverGrid.classList.remove('all-mode');
        if (currentFeatured4.length === 0) {
            currentFeatured4 = pick4RandomSites();
        }
        displayEntries = currentFeatured4;
        if (toggleText) toggleText.textContent = `View All (${entries.length})`;
    }

    displayEntries.forEach(([domain, meta]) => {
        const cat = getSiteCategory(meta.path);
        const icon = SITE_ICONS[domain] || (cat === "Games" ? "🎮" : cat === "Official" ? "⚡" : "🧪");
        const badgeClass = cat === "Games" ? "game" : cat === "Official" ? "official" : "media";

        const card = document.createElement('div');
        card.className = 'site-card';
        card.innerHTML = `
            <div class="card-top">
                <div class="card-icon">${icon}</div>
                <span class="card-badge ${badgeClass}">${cat}</span>
            </div>
            <div class="card-bottom">
                <div class="card-name" title="${escapeHtml(meta.name)}">${escapeHtml(meta.name)}</div>
                <div class="card-domain">fetch://${domain}</div>
            </div>
        `;
        card.addEventListener('click', () => {
            loadNeoDomain(domain);
        });
        discoverGrid.appendChild(card);
    });
}
