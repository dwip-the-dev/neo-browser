// NeoShare — P2P Ephemeral Transfer Runtime
const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

let activeSeed = null;
let heartbeatTimer = null;
let activeDownload = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    const tabBtnUpload = document.getElementById('tab-btn-upload');
    const tabBtnDownload = document.getElementById('tab-btn-download');
    const viewUpload = document.getElementById('view-upload');
    const viewDownload = document.getElementById('view-download');

    // Uploader DOM
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');
    const btnBrowseFile = document.getElementById('btn-browse-file');
    const dropPrompt = document.getElementById('drop-prompt');
    const seedDashboard = document.getElementById('seed-dashboard');
    const seedFilename = document.getElementById('seed-filename');
    const seedFilesize = document.getElementById('seed-filesize');
    const seedChunks = document.getElementById('seed-chunks');
    const seedHash = document.getElementById('seed-hash');
    const seedTransferId = document.getElementById('seed-transfer-id');
    const seedShareLink = document.getElementById('seed-share-link');
    const seedOnionAddr = document.getElementById('seed-onion-addr');
    const seedSpeedVal = document.getElementById('seed-speed-val');
    const seedPeersVal = document.getElementById('seed-peers-val');
    const btnCancelSeed = document.getElementById('btn-cancel-seed');
    const btnCopyId = document.getElementById('btn-copy-id');
    const btnCopyLink = document.getElementById('btn-copy-link');

    // Downloader DOM
    const downloadIdInput = document.getElementById('download-id-input');
    const btnFetchMeta = document.getElementById('btn-fetch-meta');
    const downloadErrorBox = document.getElementById('download-error-box');
    const downloadDashboard = document.getElementById('download-dashboard');
    const dlFilename = document.getElementById('dl-filename');
    const dlFilesize = document.getElementById('dl-filesize');
    const dlChunks = document.getElementById('dl-chunks');
    const dlHash = document.getElementById('dl-hash');
    const btnStartDownload = document.getElementById('btn-start-download');
    const dlPercent = document.getElementById('dl-percent');
    const dlSpeed = document.getElementById('dl-speed');
    const dlEta = document.getElementById('dl-eta');
    const dlProgressBar = document.getElementById('dl-progress-bar');
    const chunkCounter = document.getElementById('chunk-counter');
    const chunkGrid = document.getElementById('chunk-grid');
    const completedBox = document.getElementById('completed-box');
    const btnSaveFile = document.getElementById('btn-save-file');

    // Circuit DOM
    const circuitDownState = document.getElementById('circuit-down-state');
    const circuitDownloader = document.getElementById('circuit-downloader');

    // ---------------- Tab Switching ----------------
    function switchTab(mode) {
        if (mode === 'upload') {
            tabBtnUpload.classList.add('active');
            tabBtnDownload.classList.remove('active');
            viewUpload.style.display = 'block';
            viewDownload.style.display = 'none';
        } else {
            tabBtnDownload.classList.add('active');
            tabBtnUpload.classList.remove('active');
            viewDownload.style.display = 'block';
            viewUpload.style.display = 'none';
        }
    }

    tabBtnUpload.addEventListener('click', () => switchTab('upload'));
    tabBtnDownload.addEventListener('click', () => switchTab('download'));

    // ---------------- URL Query/Hash Parsing ----------------
    const urlParams = new URLSearchParams(window.location.search);
    const idFromQuery = urlParams.get('id') || (window.location.hash ? window.location.hash.replace('#', '') : null);
    if (idFromQuery) {
        switchTab('download');
        downloadIdInput.value = idFromQuery.toUpperCase().trim();
        setTimeout(() => locatePeer(idFromQuery.toUpperCase().trim()), 300);
    }

    // ---------------- Helper: Format File Size ----------------
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ---------------- Helper: Compute SHA-256 ----------------
    async function computeSHA256(buffer) {
        const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ---------------- UPLOADER LOGIC ----------------
    btnBrowseFile.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag and Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    async function handleFileSelection(file) {
        dropPrompt.style.display = 'none';
        seedDashboard.style.display = 'block';

        seedFilename.textContent = file.name;
        seedFilesize.textContent = formatBytes(file.size);
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        seedChunks.textContent = `${totalChunks} Chunks (64KB)`;
        seedHash.textContent = 'SHA-256: calculating...';

        // Read file into memory buffer
        const arrayBuf = await file.arrayBuffer();
        const hash = await computeSHA256(arrayBuf);
        seedHash.textContent = `SHA-256: ${hash.substring(0, 16)}...`;

        // Register with Signaling Coordinator
        try {
            const resp = await fetch('/api/p2p/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    size: file.size,
                    mime: file.type || 'application/octet-stream',
                    sha256: hash,
                    total_chunks: totalChunks
                })
            });
            const data = await resp.json();
            if (data.status === 'ok') {
                activeSeed = {
                    id: data.id,
                    file: file,
                    buffer: arrayBuf,
                    totalChunks: totalChunks,
                    chunks: [],
                    hash: hash,
                    uploadedBytes: 0,
                    lastBytes: 0
                };

                // Split into memory chunks
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    activeSeed.chunks.push(arrayBuf.slice(start, end));
                }

                seedTransferId.textContent = data.id;
                const link = `fetch://share.neo/?id=${data.id}`;
                seedShareLink.value = link;
                seedOnionAddr.textContent = data.onion_address || `${data.id.toLowerCase()}.neo-drop.onion`;

                // Start Heartbeat & Chunk Servicing
                startSeedingLoop(data.id);
            }
        } catch (err) {
            console.error('Registration error:', err);
            alert('Failed to initialize ephemeral P2P session on network.');
        }
    }

    function startSeedingLoop(id) {
        // Heartbeat pulse every 4 seconds
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(async () => {
            if (!activeSeed) return;
            try {
                const resp = await fetch('/api/p2p/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
                const res = await resp.json();
                if (!res.active) {
                    stopSeeding();
                }
            } catch (e) {
                console.warn('Heartbeat missed:', e);
            }

            // Calculate speed
            const diff = activeSeed.uploadedBytes - activeSeed.lastBytes;
            activeSeed.lastBytes = activeSeed.uploadedBytes;
            const speedKb = (diff / 4 / 1024).toFixed(1);
            if (seedSpeedVal) seedSpeedVal.textContent = `${speedKb} KB/s`;
        }, 4000);

        // Periodically push chunks if downloader requests via signal
        startChunkPusher(id);
    }

    // Push chunks to memory queue on demand
    let pusherActive = true;
    async function startChunkPusher(id) {
        pusherActive = true;
        // In local p2p relay mode, pre-stage chunks sequentially when requested
        for (let i = 0; i < activeSeed.totalChunks; i++) {
            if (!pusherActive || !activeSeed) break;
            const chunkBuf = activeSeed.chunks[i];
            const base64Chunk = arrayBufferToBase64(chunkBuf);
            try {
                await fetch('/api/p2p/chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,
                        index: i,
                        data: base64Chunk
                    })
                });
                activeSeed.uploadedBytes += chunkBuf.byteLength;
            } catch (err) {
                console.warn('Chunk push error:', err);
            }
            // Small throttle so we stream smoothly
            await new Promise(r => setTimeout(r, 60));
        }
    }

    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function stopSeeding() {
        pusherActive = false;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (activeSeed && activeSeed.id) {
            fetch('/api/p2p/unregister', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: activeSeed.id })
            }).catch(() => {});
        }
        activeSeed = null;
        dropPrompt.style.display = 'block';
        seedDashboard.style.display = 'none';
        fileInput.value = '';
    }

    btnCancelSeed.addEventListener('click', stopSeeding);

    // Copy Handlers
    btnCopyId.addEventListener('click', () => {
        if (activeSeed && activeSeed.id) {
            navigator.clipboard.writeText(activeSeed.id);
            btnCopyId.textContent = 'Copied!';
            setTimeout(() => btnCopyId.textContent = 'Copy ID', 1800);
        }
    });

    btnCopyLink.addEventListener('click', () => {
        if (seedShareLink.value) {
            navigator.clipboard.writeText(seedShareLink.value);
            btnCopyLink.textContent = 'Copied!';
            setTimeout(() => btnCopyLink.textContent = 'Copy Link', 1800);
        }
    });

    // Cleanup on tab close
    window.addEventListener('beforeunload', () => {
        if (activeSeed && activeSeed.id) {
            navigator.sendBeacon('/api/p2p/unregister', JSON.stringify({ id: activeSeed.id }));
        }
    });

    // ---------------- DOWNLOADER LOGIC ----------------
    btnFetchMeta.addEventListener('click', () => {
        const id = (downloadIdInput.value || '').trim().toUpperCase();
        if (!id) {
            alert('Please enter a Transfer ID.');
            return;
        }
        locatePeer(id);
    });

    downloadIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnFetchMeta.click();
    });

    async function locatePeer(id) {
        downloadErrorBox.style.display = 'none';
        downloadDashboard.style.display = 'none';
        completedBox.style.display = 'none';

        try {
            const resp = await fetch(`/api/p2p/session/${id}`);
            const data = await resp.json();

            if (resp.status === 404 || data.status === 'error') {
                downloadErrorBox.style.display = 'flex';
                circuitDownState.textContent = 'Vanished / Offline';
                circuitDownloader.classList.remove('active');
                return;
            }

            // Uploader found & online!
            const sess = data.session;
            activeDownload = {
                id: sess.id,
                filename: sess.filename,
                size: sess.size,
                mime: sess.mime,
                sha256: sess.sha256,
                totalChunks: sess.total_chunks,
                receivedChunks: new Array(sess.total_chunks),
                receivedCount: 0,
                blobUrl: null
            };

            dlFilename.textContent = sess.filename;
            dlFilesize.textContent = formatBytes(sess.size);
            dlChunks.textContent = `${sess.total_chunks} Chunks`;
            dlHash.textContent = `SHA-256: ${sess.sha256.substring(0, 16)}...`;

            circuitDownState.textContent = 'Connected (Seed Active)';
            circuitDownloader.classList.add('active');

            // Render BitTorrent Piece Map
            renderChunkMap(sess.total_chunks);
            downloadDashboard.style.display = 'block';

        } catch (err) {
            console.error('Peer discovery error:', err);
            downloadErrorBox.style.display = 'flex';
        }
    }

    function renderChunkMap(total) {
        chunkGrid.innerHTML = '';
        chunkCounter.textContent = `0 / ${total} Chunks Verified`;
        // Create up to 120 visual blocks representing pieces
        const visualTotal = Math.min(120, total);
        for (let i = 0; i < visualTotal; i++) {
            const block = document.createElement('div');
            block.className = 'chunk-block';
            block.id = `chunk-block-${i}`;
            chunkGrid.appendChild(block);
        }
    }

    // Start P2P Assembly Download
    btnStartDownload.addEventListener('click', async () => {
        if (!activeDownload) return;
        btnStartDownload.disabled = true;
        btnStartDownload.textContent = 'Streaming from Peer...';

        const startTime = Date.now();
        let downloadedBytes = 0;

        for (let i = 0; i < activeDownload.totalChunks; i++) {
            let chunkData = null;
            let retries = 0;

            // Mark visual chunk fetching
            const visualIdx = Math.floor((i / activeDownload.totalChunks) * Math.min(120, activeDownload.totalChunks));
            const blockEl = document.getElementById(`chunk-block-${visualIdx}`);
            if (blockEl) blockEl.classList.add('fetching');

            while (!chunkData && retries < 40) {
                try {
                    const res = await fetch(`/api/p2p/chunk/${activeDownload.id}/${i}`);
                    if (res.status === 200) {
                        const json = await res.json();
                        chunkData = base64ToArrayBuffer(json.data);
                    } else if (res.status === 404) {
                        // Uploader vanished mid-transfer
                        alert('Uploader went offline or disconnected. Ephemeral stream terminated.');
                        downloadErrorBox.style.display = 'flex';
                        downloadDashboard.style.display = 'none';
                        return;
                    } else {
                        // Waiting for chunk to be pushed
                        await new Promise(r => setTimeout(r, 200));
                        retries++;
                    }
                } catch (e) {
                    await new Promise(r => setTimeout(r, 200));
                    retries++;
                }
            }

            if (!chunkData) {
                alert('Transfer timed out: peer disconnected.');
                return;
            }

            activeDownload.receivedChunks[i] = chunkData;
            activeDownload.receivedCount++;
            downloadedBytes += chunkData.byteLength;

            // Visual chunk confirmed
            if (blockEl) {
                blockEl.classList.remove('fetching');
                blockEl.classList.add('verified');
            }

            // Update Progress & Speed
            const pct = Math.floor((activeDownload.receivedCount / activeDownload.totalChunks) * 100);
            dlProgressBar.style.width = `${pct}%`;
            dlPercent.textContent = `${pct}%`;
            chunkCounter.textContent = `${activeDownload.receivedCount} / ${activeDownload.totalChunks} Chunks Verified`;

            const elapsedSec = (Date.now() - startTime) / 1000;
            const speedKb = elapsedSec > 0 ? (downloadedBytes / elapsedSec / 1024).toFixed(1) : '0.0';
            dlSpeed.textContent = `${speedKb} KB/s`;

            const remainingBytes = activeDownload.size - downloadedBytes;
            const etaSec = speedKb > 0 ? Math.ceil(remainingBytes / (speedKb * 1024)) : 0;
            dlEta.textContent = `ETA: ${etaSec}s`;
        }

        // All chunks received! Assemble Blob
        const finalBlob = new Blob(activeDownload.receivedChunks, { type: activeDownload.mime });
        const blobBuf = await finalBlob.arrayBuffer();
        const finalHash = await computeSHA256(blobBuf);

        if (finalHash.toLowerCase() === activeDownload.sha256.toLowerCase()) {
            activeDownload.blobUrl = URL.createObjectURL(finalBlob);
            completedBox.style.display = 'flex';
            btnStartDownload.style.display = 'none';
        } else {
            alert('Integrity check failed: Checksum mismatch. Download discarded.');
        }
    });

    // Save File Button
    btnSaveFile.addEventListener('click', () => {
        if (activeDownload && activeDownload.blobUrl) {
            const a = document.createElement('a');
            a.href = activeDownload.blobUrl;
            a.download = activeDownload.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });
});
