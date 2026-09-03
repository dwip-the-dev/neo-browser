/**
 * NeoBrowser Chrome-Style Multi-Tab, Bookmarks, History & Downloads Architecture
 */

let TABS = [];
let ACTIVE_TAB_ID = null;
let NEXT_TAB_ID = 1;

let BROWSING_HISTORY = [];
let DOWNLOADS_LIST = [];

function getActiveTab() {
    return TABS.find(t => t.id === ACTIVE_TAB_ID);
}

function initTabs() {
    loadStoredHistory();
    loadStoredDownloads();

    // Create initial home tab
    createTab("", "NeoSearch");

    // New Tab button
    const btnNewTab = document.getElementById('btn-new-tab');
    if (btnNewTab) {
        btnNewTab.addEventListener('click', () => createTab("", "NeoSearch"));
    }

    // Bookmarks click
    document.querySelectorAll('.bm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const domain = btn.getAttribute('data-domain');
            if (domain) loadNeoDomain(domain);
        });
    });

    // Drawers toggle
    const btnToggleDl = document.getElementById('btn-toggle-downloads');
    const btnCloseDl = document.getElementById('btn-close-downloads');
    const dlDrawer = document.getElementById('downloads-drawer');
    if (btnToggleDl && dlDrawer) {
        btnToggleDl.addEventListener('click', () => {
            const isVisible = dlDrawer.style.display === 'flex';
            dlDrawer.style.display = isVisible ? 'none' : 'flex';
            const histDrawer = document.getElementById('history-drawer');
            if (histDrawer) histDrawer.style.display = 'none';
        });
    }
    if (btnCloseDl && dlDrawer) {
        btnCloseDl.addEventListener('click', () => dlDrawer.style.display = 'none');
    }

    const btnToggleHist = document.getElementById('btn-toggle-history');
    const btnCloseHist = document.getElementById('btn-close-history');
    const histDrawer = document.getElementById('history-drawer');
    const btnClearHist = document.getElementById('btn-clear-history');
    if (btnToggleHist && histDrawer) {
        btnToggleHist.addEventListener('click', () => {
            const isVisible = histDrawer.style.display === 'flex';
            histDrawer.style.display = isVisible ? 'none' : 'flex';
            if (dlDrawer) dlDrawer.style.display = 'none';
        });
    }
    if (btnCloseHist && histDrawer) {
        btnCloseHist.addEventListener('click', () => histDrawer.style.display = 'none');
    }
    if (btnClearHist) {
        btnClearHist.addEventListener('click', () => {
            BROWSING_HISTORY = [];
            localStorage.removeItem('neo_history');
            renderHistory();
        });
    }

    // Keyboard Shortcuts (Chrome / Brave Compatible)
    document.addEventListener('keydown', (e) => {
        // Ctrl+T: New Tab
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
            e.preventDefault();
            createTab("", "NeoSearch");
        }
        // Ctrl+W: Close Tab
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
            e.preventDefault();
            if (ACTIVE_TAB_ID) closeTab(ACTIVE_TAB_ID);
        }
        // Ctrl+Tab / Ctrl+Shift+Tab: Cycle tabs
        else if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
            e.preventDefault();
            if (TABS.length > 1) {
                const curIdx = TABS.findIndex(t => t.id === ACTIVE_TAB_ID);
                let nextIdx = e.shiftKey ? curIdx - 1 : curIdx + 1;
                if (nextIdx >= TABS.length) nextIdx = 0;
                if (nextIdx < 0) nextIdx = TABS.length - 1;
                switchTab(TABS[nextIdx].id);
            }
        }
        // Ctrl+1 through Ctrl+8: Jump to Tab N
        else if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '8') {
            const targetIdx = parseInt(e.key) - 1;
            if (targetIdx < TABS.length) {
                e.preventDefault();
                switchTab(TABS[targetIdx].id);
            }
        }
        // Ctrl+9: Jump to last Tab
        else if ((e.ctrlKey || e.metaKey) && e.key === '9') {
            if (TABS.length > 0) {
                e.preventDefault();
                switchTab(TABS[TABS.length - 1].id);
            }
        }
        // Ctrl+J: Downloads Drawer
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
            e.preventDefault();
            if (dlDrawer) dlDrawer.style.display = dlDrawer.style.display === 'flex' ? 'none' : 'flex';
        }
        // Ctrl+H: History Drawer
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
            e.preventDefault();
            if (histDrawer) histDrawer.style.display = histDrawer.style.display === 'flex' ? 'none' : 'flex';
        }
    });

    // Close drawers when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#downloads-drawer') && !e.target.closest('#btn-toggle-downloads') && dlDrawer) {
            dlDrawer.style.display = 'none';
        }
        if (!e.target.closest('#history-drawer') && !e.target.closest('#btn-toggle-history') && histDrawer) {
            histDrawer.style.display = 'none';
        }
    });
}

function createTab(url = "", title = "NeoSearch") {
    const tabId = NEXT_TAB_ID++;
    const domain = url ? url.replace('fetch://', '').replace(/\/$/, '') : "";
    const newTab = {
        id: tabId,
        url: url,
        title: title || (domain ? domain : "NeoSearch"),
        domain: domain,
        webview: null,
        isLoading: false
    };
    TABS.push(newTab);
    renderTabs();
    switchTab(tabId);

    if (domain) {
        navigateTab(newTab, domain);
    }
}

function closeTab(tabId) {
    const index = TABS.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tabToClose = TABS[index];
    if (tabToClose.webview) {
        tabToClose.webview.remove();
        tabToClose.webview = null;
    }

    if (TABS.length === 1) {
        // Last tab closed -> reset to clean home tab
        tabToClose.url = "";
        tabToClose.title = "NeoSearch";
        tabToClose.domain = "";
        renderTabs();
        showHomeView();
        return;
    }

    TABS.splice(index, 1);
    if (ACTIVE_TAB_ID === tabId) {
        const nextIndex = Math.min(index, TABS.length - 1);
        switchTab(TABS[nextIndex].id);
    } else {
        renderTabs();
    }
}

function switchTab(tabId) {
    ACTIVE_TAB_ID = tabId;
    renderTabs();

    const activeTab = getActiveTab();
    if (!activeTab) return;

    const searchView = document.getElementById('search-view');
    const webviewContainer = document.getElementById('webview-container');
    const omniboxInput = document.getElementById('omnibox-input');
    const protocolText = document.getElementById('protocol-text');
    const protocolChip = document.getElementById('protocol-chip');

    // Hide all webviews
    document.querySelectorAll('.tab-webview').forEach(wv => {
        wv.style.display = 'none';
    });

    if (!activeTab.domain) {
        // Home tab
        currentLoadedDomain = null;
        if (searchView) searchView.style.display = 'flex';
        if (webviewContainer) webviewContainer.style.display = 'none';
        if (omniboxInput) omniboxInput.value = "";
        if (protocolText) protocolText.textContent = "fetch://";
        if (protocolChip) protocolChip.style.color = "#38bdf8";
        updateNavButtons();
    } else {
        // Site tab
        currentLoadedDomain = activeTab.domain;
        if (searchView) searchView.style.display = 'none';
        if (webviewContainer) webviewContainer.style.display = 'block';

        if (activeTab.webview) {
            activeTab.webview.style.display = 'flex';
        } else {
            navigateTab(activeTab, activeTab.domain);
        }

        if (omniboxInput) omniboxInput.value = `fetch://${activeTab.domain}/`;
        if (protocolText) protocolText.textContent = "fetch://";
        if (protocolChip) protocolChip.style.color = "#38bdf8";
        updateNavButtons();
    }
}

function navigateTab(tab, domain) {
    domain = domain.trim().toLowerCase().replace('fetch://', '').replace(/\/$/, '');
    tab.domain = domain;
    tab.url = `fetch://${domain}/`;
    tab.title = REGISTRY[domain] ? REGISTRY[domain].name : domain;
    currentLoadedDomain = domain;

    const baseUrl = (GLOBAL_SERVER_URL || "").replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/site/${domain}/`;

    const webviewContainer = document.getElementById('webview-container');
    const searchView = document.getElementById('search-view');
    if (searchView) searchView.style.display = 'none';
    if (webviewContainer) webviewContainer.style.display = 'block';

    if (!tab.webview) {
        const wv = document.createElement('webview');
        wv.id = `webview-tab-${tab.id}`;
        wv.className = 'tab-webview';
        wv.src = targetUrl;
        wv.setAttribute('allowpopups', '');
        wv.setAttribute('webpreferences', 'allowRunningInsecureContent=true, webSecurity=false');
        wv.style.width = '100%';
        wv.style.height = '100%';
        wv.style.border = 'none';

        // Lifecycle listeners
        wv.addEventListener('did-start-loading', () => {
            tab.isLoading = true;
            showLoading();
            renderTabs();
            if (tab.id === ACTIVE_TAB_ID) updateNavButtons();
        });

        wv.addEventListener('did-stop-loading', () => {
            tab.isLoading = false;
            hideLoading();
            renderTabs();
            if (tab.id === ACTIVE_TAB_ID) updateNavButtons();
        });

        wv.addEventListener('page-title-updated', (e) => {
            if (e.title && !e.title.includes('http') && !e.title.includes('404')) {
                tab.title = e.title;
                renderTabs();
            }
        });

        wv.addEventListener('did-navigate', (e) => {
            if (tab.id === ACTIVE_TAB_ID) {
                updateNavButtons();
                const omniboxInput = document.getElementById('omnibox-input');
                if (omniboxInput) omniboxInput.value = `fetch://${tab.domain}/`;
            }
        });

        webviewContainer.appendChild(wv);
        tab.webview = wv;
    } else {
        tab.webview.src = targetUrl;
    }

    tab.webview.style.display = 'flex';
    renderTabs();
    recordHistoryItem(domain, tab.title);
}

function updateActiveTabState(domain, title) {
    const tab = getActiveTab();
    if (!tab) return;

    if (!domain) {
        tab.domain = "";
        tab.url = "";
        tab.title = "NeoSearch";
    } else {
        tab.domain = domain;
        tab.url = `fetch://${domain}/`;
        tab.title = title || domain;
        recordHistoryItem(domain, tab.title);
    }
    renderTabs();
}

function renderTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;

    container.innerHTML = '';
    TABS.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === ACTIVE_TAB_ID ? 'active' : ''} ${tab.isLoading ? 'loading' : ''}`;
        
        let iconHtml;
        if (tab.isLoading) {
            iconHtml = `<div class="tab-spinner"></div>`;
        } else if (tab.domain) {
            iconHtml = getFaviconHtml(tab.domain, tab.title);
        } else {
            iconHtml = `<span style="font-size: 13px;">⚡</span>`;
        }

        tabEl.innerHTML = `
            <div class="tab-icon">${iconHtml}</div>
            <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
            <button class="tab-close" title="Close Tab (Ctrl+W)">✕</button>
        `;

        tabEl.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) {
                e.stopPropagation();
                closeTab(tab.id);
            } else {
                switchTab(tab.id);
            }
        });

        container.appendChild(tabEl);
    });
}

function recordHistoryItem(domain, title) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (BROWSING_HISTORY.length > 0 && BROWSING_HISTORY[0].domain === domain) {
        BROWSING_HISTORY[0].time = timeStr;
    } else {
        BROWSING_HISTORY.unshift({
            domain: domain,
            title: title || domain,
            time: timeStr
        });
        if (BROWSING_HISTORY.length > 60) BROWSING_HISTORY.pop();
    }
    try {
        localStorage.setItem('neo_history', JSON.stringify(BROWSING_HISTORY));
    } catch (_) {}
    renderHistory();
}

function loadStoredHistory() {
    try {
        const stored = localStorage.getItem('neo_history');
        if (stored) BROWSING_HISTORY = JSON.parse(stored);
    } catch (_) {}
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const count = document.getElementById('history-count');
    if (!list) return;

    if (count) count.textContent = `${BROWSING_HISTORY.length} sites`;
    if (BROWSING_HISTORY.length === 0) {
        list.innerHTML = `<div class="drawer-empty">No browsing history yet. Visit any decentralized .neo site!</div>`;
        return;
    }

    list.innerHTML = '';
    BROWSING_HISTORY.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item-card';
        el.innerHTML = `
            <div class="history-left">
                <span style="font-size: 14px;">🌐</span>
                <span class="history-domain">fetch://${escapeHtml(item.domain)}/</span>
            </div>
            <span class="history-time">${escapeHtml(item.time)}</span>
        `;
        el.addEventListener('click', () => {
            loadNeoDomain(item.domain);
            const drawer = document.getElementById('history-drawer');
            if (drawer) drawer.style.display = 'none';
        });
        list.appendChild(el);
    });
}

function recordDownloadItem(name, size, status = "Completed") {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    DOWNLOADS_LIST.unshift({
        name: name,
        size: size,
        status: status,
        time: timeStr
    });
    try {
        localStorage.setItem('neo_downloads', JSON.stringify(DOWNLOADS_LIST));
    } catch (_) {}
    renderDownloads();
}

function loadStoredDownloads() {
    try {
        const stored = localStorage.getItem('neo_downloads');
        if (stored) DOWNLOADS_LIST = JSON.parse(stored);
    } catch (_) {}
    renderDownloads();
}

function renderDownloads() {
    const list = document.getElementById('downloads-list');
    const count = document.getElementById('downloads-count');
    if (!list) return;

    if (count) count.textContent = `${DOWNLOADS_LIST.length} items`;
    if (DOWNLOADS_LIST.length === 0) {
        list.innerHTML = `<div class="drawer-empty">No downloads yet. Transfer files using NeoShare or download software from app.neo.</div>`;
        return;
    }

    list.innerHTML = '';
    DOWNLOADS_LIST.forEach(item => {
        const el = document.createElement('div');
        el.className = 'download-item-card';
        el.innerHTML = `
            <div class="dl-icon">📦</div>
            <div class="dl-info">
                <div class="dl-name">${escapeHtml(item.name)}</div>
                <div class="dl-meta">${escapeHtml(item.size)} • ${escapeHtml(item.time)}</div>
            </div>
            <div class="dl-status">${escapeHtml(item.status)}</div>
        `;
        list.appendChild(el);
    });
}
