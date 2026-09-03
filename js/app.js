// ==================== APP INITIALIZATION & EVENT BINDINGS ====================
window.addEventListener('DOMContentLoaded', async () => {
    initRegistry();
    renderDiscoverGrid();

    try {
        const loadedUrl = await ipcRenderer.invoke('get-server-url');
        if (loadedUrl) GLOBAL_SERVER_URL = loadedUrl;
        await syncRegistryFromServer();
    } catch (err) {
        console.warn("Could not get server URL via IPC:", err);
    }

    await checkServerStatus();
    setInterval(checkServerStatus, 20000);

    // Category filter pills
    document.querySelectorAll('.cat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedCategory = pill.getAttribute('data-cat') || 'all';
            discoverPage = 1;
            renderDiscoverGrid();
        });
    });

    // Load More pagination
    const btnLoadMore = document.getElementById('btn-discover-load-more');
    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            discoverPage++;
            renderDiscoverGrid();
        });
    }

    // Elements
    const heroSearchInput = document.getElementById('hero-search-input');
    const heroClearBtn = document.getElementById('hero-clear-btn');
    const btnDoSearch = document.getElementById('btn-do-search');
    const btnLucky = document.getElementById('btn-lucky');
    const btnSearchGoogle = document.getElementById('btn-search-google');
    const btnBackToHome = document.getElementById('btn-back-to-home');
    const googleSerpBox = document.getElementById('google-serp-box');

    const omniboxInput = document.getElementById('omnibox-input');
    const omniboxDropdown = document.getElementById('omnibox-dropdown');
    const btnClearOmnibox = document.getElementById('btn-clear-omnibox');
    const btnGoOmnibox = document.getElementById('btn-go-omnibox');
    const btnBack = document.getElementById('btn-back');
    const btnForward = document.getElementById('btn-forward');
    const btnReload = document.getElementById('btn-reload');
    const btnHome = document.getElementById('btn-home');
    const brandBtn = document.getElementById('brand-btn');
    const btnGoogleWeb = document.getElementById('btn-google-web');
    const btnP2pShare = document.getElementById('btn-p2p-share');

    const webview = document.getElementById('webview');
    const webviewContainer = document.getElementById('webview-container');
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    const btnRetrySite = document.getElementById('btn-retry-site');
    const btnReturnHome = document.getElementById('btn-return-home');

    // Hero search events
    if (heroSearchInput) {
        heroSearchInput.addEventListener('input', () => {
            if (heroClearBtn) heroClearBtn.style.display = heroSearchInput.value ? 'block' : 'none';
        });
        heroSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch(heroSearchInput.value);
        });
    }
    if (heroClearBtn) {
        heroClearBtn.addEventListener('click', () => {
            heroSearchInput.value = '';
            heroClearBtn.style.display = 'none';
            heroSearchInput.focus();
        });
    }
    if (btnDoSearch) {
        btnDoSearch.addEventListener('click', () => performSearch(heroSearchInput.value));
    }

    // Lucky button
    if (btnLucky) {
        btnLucky.addEventListener('click', () => {
            const entries = Object.keys(REGISTRY);
            if (entries.length > 0) {
                const randomDomain = entries[Math.floor(Math.random() * entries.length)];
                loadNeoDomain(randomDomain);
            }
        });
    }

    // Google search buttons
    if (btnSearchGoogle) {
        btnSearchGoogle.addEventListener('click', () => {
            const query = (heroSearchInput ? heroSearchInput.value : "").trim();
            if (query) {
                loadWebUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            } else {
                ipcRenderer.send('open-neogoogle');
            }
        });
    }

    if (googleSerpBox) {
        googleSerpBox.addEventListener('click', () => {
            if (activeQuery) {
                ipcRenderer.send('open-external-browser', `https://www.google.com/search?q=${encodeURIComponent(activeQuery)}`);
            } else {
                ipcRenderer.send('open-neogoogle');
            }
        });
    }

    if (btnGoogleWeb) {
        btnGoogleWeb.addEventListener('click', () => ipcRenderer.send('open-neogoogle'));
    }

    // Back to discover from SERP
    if (btnBackToHome) {
        btnBackToHome.addEventListener('click', () => showHomeView());
    }

    // Shuffle 4 featured sites
    const btnShuffle = document.getElementById('btn-shuffle-featured');
    if (btnShuffle) {
        btnShuffle.addEventListener('click', () => {
            isShowingAll = false;
            currentFeatured4 = pick4RandomSites();
            renderDiscoverGrid();
        });
    }

    // Toggle view all sites
    const btnToggleAll = document.getElementById('btn-toggle-all');
    if (btnToggleAll) {
        btnToggleAll.addEventListener('click', () => {
            isShowingAll = !isShowingAll;
            discoverPage = 1;
            renderDiscoverGrid();
        });
    }

    // Omnibox events
    if (omniboxInput) {
        omniboxInput.addEventListener('input', () => {
            if (btnClearOmnibox) btnClearOmnibox.style.display = omniboxInput.value ? 'flex' : 'none';
            updateAutocomplete(omniboxInput);
        });

        omniboxInput.addEventListener('focus', () => {
            if (omniboxInput.value.trim()) updateAutocomplete(omniboxInput);
        });

        omniboxInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (omniboxDropdown) omniboxDropdown.style.display = 'none';
                performSearch(omniboxInput.value);
            }
        });
    }

    if (btnClearOmnibox) {
        btnClearOmnibox.addEventListener('click', () => {
            omniboxInput.value = '';
            if (omniboxDropdown) omniboxDropdown.style.display = 'none';
            omniboxInput.focus();
        });
    }

    if (btnGoOmnibox) {
        btnGoOmnibox.addEventListener('click', () => {
            if (omniboxDropdown) omniboxDropdown.style.display = 'none';
            performSearch(omniboxInput.value);
        });
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.omnibox-container') && omniboxDropdown) {
            omniboxDropdown.style.display = 'none';
        }
    });

    // Navigation buttons
    if (btnBack) btnBack.addEventListener('click', () => { if (webview.canGoBack()) webview.goBack(); });
    if (btnForward) btnForward.addEventListener('click', () => { if (webview.canGoForward()) webview.goForward(); });
    if (btnReload) {
        btnReload.addEventListener('click', () => {
            if (webviewContainer.style.display === 'block') webview.reload();
            else { checkServerStatus(); renderDiscoverGrid(); }
        });
    }
    if (btnHome) btnHome.addEventListener('click', () => showHomeView());
    if (brandBtn) brandBtn.addEventListener('click', () => showHomeView());
    if (btnP2pShare) btnP2pShare.addEventListener('click', () => loadNeoDomain('share.neo'));

    // Webview Lifecycle Events
    if (webview) {
        webview.addEventListener('did-start-loading', () => { showLoading(); updateNavButtons(); });
        webview.addEventListener('did-stop-loading', () => { hideLoading(); updateNavButtons(); });
        webview.addEventListener('did-navigate', (e) => {
            updateNavButtons();
            const protocolText = document.getElementById('protocol-text');
            if (currentLoadedDomain) {
                omniboxInput.value = `fetch://${currentLoadedDomain}`;
                if (protocolText) protocolText.textContent = "fetch://";
            } else if (e.url) {
                omniboxInput.value = e.url;
            }
        });

        webview.addEventListener('did-fail-load', (e) => {
            hideLoading();
            if (e.errorCode !== -3) {
                if (errorMessage) errorMessage.textContent = `Could not load site (${e.errorDescription || 'Connection Error'}).`;
                if (errorOverlay) errorOverlay.style.display = 'flex';
            }
        });
    }

    if (btnRetrySite) {
        btnRetrySite.addEventListener('click', () => {
            if (errorOverlay) errorOverlay.style.display = 'none';
            showLoading();
            webview.reload();
        });
    }
    if (btnReturnHome) {
        btnReturnHome.addEventListener('click', () => showHomeView());
    }

    // Footer Navigation & External Link Handlers
    document.addEventListener('click', (e) => {
        const domainLink = e.target.closest('.footer-link[data-domain]');
        if (domainLink) {
            e.preventDefault();
            loadNeoDomain(domainLink.dataset.domain);
            return;
        }
        const externalLink = e.target.closest('.external-link[data-url]');
        if (externalLink) {
            e.preventDefault();
            ipcRenderer.send('open-external-browser', externalLink.dataset.url);
            return;
        }
    });

    // Global Shortcuts
    document.addEventListener('keydown', (e) => {
        const searchView = document.getElementById('search-view');
        if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
            e.preventDefault();
            if (searchView && searchView.style.display !== 'none') {
                heroSearchInput.focus();
                heroSearchInput.select();
            } else {
                omniboxInput.focus();
                omniboxInput.select();
            }
        }
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            omniboxInput.focus();
            omniboxInput.select();
        }
        if (e.altKey && e.key === 'ArrowLeft' && webview.canGoBack()) webview.goBack();
        if (e.altKey && e.key === 'ArrowRight' && webview.canGoForward()) webview.goForward();
    });
});
