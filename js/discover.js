// ==================== DYNAMIC DISCOVER GRID & PAGINATED BROWSE ====================

function pick4RandomSites() {
    const entries = Object.entries(REGISTRY);
    if (entries.length <= 4) return entries;
    const shuffled = [...entries].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
}

function updateCategoryPillCounts() {
    const entries = Object.entries(REGISTRY);
    const counts = { all: entries.length };
    entries.forEach(([_, meta]) => {
        const cat = getSiteCategory(meta.path);
        counts[cat] = (counts[cat] || 0) + 1;
    });

    const icons = {
        "all": "",
        "AI": '<i class="bi bi-robot"></i> ',
        "Dev Tools": '<i class="bi bi-code-square"></i> ',
        "Finance": '<i class="bi bi-coin"></i> ',
        "Productivity": '<i class="bi bi-lightning-charge"></i> ',
        "Media": '<i class="bi bi-film"></i> ',
        "Social": '<i class="bi bi-chat-dots"></i> ',
        "Science": '<i class="bi bi-globe-americas"></i> ',
        "Security": '<i class="bi bi-shield-check"></i> ',
        "Commerce": '<i class="bi bi-bag"></i> ',
        "Games": '<i class="bi bi-controller"></i> ',
        "Official": '<i class="bi bi-lightning-charge"></i> '
    };

    document.querySelectorAll('.cat-pill').forEach(pill => {
        const cat = pill.getAttribute('data-cat');
        const count = counts[cat] || (cat === "all" ? entries.length : 0);
        const iconPrefix = icons[cat] || "";
        pill.innerHTML = `${iconPrefix}${cat === "all" ? "All Sites" : cat} (${count})`;
    });
}

function renderDiscoverGrid() {
    const discoverGrid = document.getElementById('discover-grid');
    const categoryFilters = document.getElementById('category-filters');
    const loadMoreWrap = document.getElementById('discover-load-more-wrap');
    const toggleText = document.getElementById('toggle-all-text');
    if (!discoverGrid) return;

    discoverGrid.innerHTML = '';
    const entries = Object.entries(REGISTRY);
    if (entries.length === 0) return;

    if (isShowingAll) {
        discoverGrid.classList.add('all-mode');
        if (categoryFilters) categoryFilters.style.display = 'flex';
        if (toggleText) toggleText.textContent = "Show Less (4)";

        updateCategoryPillCounts();

        // Filter by selectedCategory
        let filtered = entries;
        if (selectedCategory && selectedCategory !== "all") {
            filtered = entries.filter(([_, meta]) => getSiteCategory(meta.path).toLowerCase() === selectedCategory.toLowerCase());
        }

        const maxVisible = discoverPage * DISCOVER_PAGE_SIZE;
        const pageItems = filtered.slice(0, maxVisible);

        pageItems.forEach(([domain, meta]) => {
            renderSiteCard(discoverGrid, domain, meta);
        });

        // Pagination control
        if (loadMoreWrap) {
            const remaining = filtered.length - maxVisible;
            if (remaining > 0) {
                loadMoreWrap.style.display = 'block';
                const loadBtn = document.getElementById('btn-discover-load-more');
                if (loadBtn) {
                    loadBtn.querySelector('span').textContent = `Load More (${Math.min(remaining, DISCOVER_PAGE_SIZE)} of ${remaining} remaining)`;
                }
            } else {
                loadMoreWrap.style.display = 'none';
            }
        }
    } else {
        discoverGrid.classList.remove('all-mode');
        if (categoryFilters) categoryFilters.style.display = 'none';
        if (loadMoreWrap) loadMoreWrap.style.display = 'none';

        if (currentFeatured4.length === 0) {
            currentFeatured4 = pick4RandomSites();
        }
        if (toggleText) toggleText.textContent = `View All (${entries.length})`;

        currentFeatured4.forEach(([domain, meta]) => {
            renderSiteCard(discoverGrid, domain, meta);
        });
    }
}

function renderSiteCard(container, domain, meta) {
    const cat = getSiteCategory(meta.path);
    const icon = getFaviconHtml(domain, meta.name);
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
    container.appendChild(card);
}
