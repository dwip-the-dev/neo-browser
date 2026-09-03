/**
 * NeoBrowser Tabs, Bookmarks, History & Downloads Management
 */

let TABS = [];
let ACTIVE_TAB_ID = null;
let NEXT_TAB_ID = 1;

let BROWSING_HISTORY = [];
let DOWNLOADS_LIST = [];

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

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
            e.preventDefault();
            createTab("", "NeoSearch");
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
            e.preventDefault();
            if (ACTIVE_TAB_ID) closeTab(ACTIVE_TAB_ID);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
            e.preventDefault();
            if (dlDrawer) dlDrawer.style.display = dlDrawer.style.display === 'flex' ? 'none' : 'flex';
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
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
    const newTab = {
        id: tabId,
        url: url,
        title: title,
        domain: url ? url.replace('fetch://', '').replace('/', '') : ""
    };
    TABS.push(newTab);
    renderTabs();
    switchTab(tabId);
}

function closeTab(tabId) {
    if (TABS.length === 1) {
        // Last tab: reset to home
        TABS[0].url = "";
        TABS[0].title = "NeoSearch";
        TABS[0].domain = "";
        renderTabs();
        showHomeView();
        return;
    }

    const index = TABS.findIndex(t => t.id === tabId);
    if (index === -1) return;

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

    const tab = TABS.find(t => t.id === tabId);
    if (!tab) return;

    if (!tab.url) {
        showHomeView();
    } else {
        loadNeoDomain(tab.domain);
    }
}

function updateActiveTabState(domain, title) {
    if (!ACTIVE_TAB_ID) return;
    const tab = TABS.find(t => t.id === ACTIVE_TAB_ID);
    if (!tab) return;

    tab.domain = domain;
    tab.url = domain ? `fetch://${domain}/` : "";
    tab.title = title || domain || "NeoSearch";

    renderTabs();

    if (domain) {
        recordHistoryItem(domain, title);
    }
}

function renderTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;

    container.innerHTML = '';
    TABS.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === ACTIVE_TAB_ID ? 'active' : ''}`;
        
        const iconHtml = tab.domain ? getFaviconHtml(tab.domain, tab.title) : `<span style="font-size: 13px;">⚡</span>`;

        tabEl.innerHTML = `
            <div class="tab-icon">${iconHtml}</div>
            <span class="tab-title">${escapeHtml(tab.title)}</span>
            <button class="tab-close" title="Close tab (Ctrl+W)">✕</button>
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
    // avoid duplicate consecutive
    if (BROWSING_HISTORY.length > 0 && BROWSING_HISTORY[0].domain === domain) {
        BROWSING_HISTORY[0].time = timeStr;
    } else {
        BROWSING_HISTORY.unshift({
            domain: domain,
            title: title || domain,
            time: timeStr
        });
        if (BROWSING_HISTORY.length > 50) BROWSING_HISTORY.pop();
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
