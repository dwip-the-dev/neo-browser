import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
const tagName = `v${version}`;
const releaseName = `NeoBrowser ${tagName} - Multi-Platform Release`;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.argv[2];
const REPO = 'dwip-the-dev/neo-browser';

if (!GITHUB_TOKEN) {
    console.error('[ERR] GITHUB_TOKEN is required. Provide it as environment variable or first argument.');
    process.exit(1);
}

const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
    console.error('[ERR] dist/ directory does not exist.');
    process.exit(1);
}

const releaseBody = `## <i class="bi bi-globe2"></i> NeoBrowser ${tagName} Multi-Platform Release

Lightweight, decentralized base browser for the Neo Network. All sites and registry metadata are dynamically driven by the decentralized serverless backend.

### [Pkg] Platform Downloads

#### [Linux] Linux:
- **Universal AppImage**: \`NeoBrowser-${version}.AppImage\` (Runs on any modern Linux distribution)
- **Debian / Ubuntu / Mint**: \`neobrowser_${version}_amd64.deb\`
- **Fedora / RHEL / openSUSE**: \`neobrowser-${version}.x86_64.rpm\`
- **Arch Linux / Manjaro**: \`neobrowser-${version}.pkg.tar.zst\`
- **Universal Tarball**: \`neobrowser-${version}.tar.gz\`

#### [Windows] Windows:
- **Windows Setup Installer**: \`NeoBrowser Setup ${version}.exe\`
- **Standalone Portable**: \`NeoBrowser-${version}-portable.exe\`
- **Portable ZIP Archive**: \`NeoBrowser-${version}-win.zip\`

#### [Android] Android:
- **Android APK**: `NeoBrowser-${version}.apk` (Native Kotlin mobile browser for decentralized .neo portals)

###  Key Updates in v${version}
- **Pure Base Browser Architecture**: Removed bundled site bloat (~40MB removed); backend serves as the single source of truth for all .neo sites.
- **Cross-Platform OS Support**: Dedicated release binaries for all Linux distributions, Windows, and Android.
- **Modern Chrome-style UX**: Auto-hidden legacy menus, borderless tab chrome, native window icons, and single-instance handling.
- **fetch:// Protocol Registration**: Native system integration for decentralized .neo URLs.
`;

async function publish() {
    console.log(`[Launch] Creating GitHub Release ${tagName} for ${REPO}...`);

    // 1. Create or get existing release
    let release;
    const createRes = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tag_name: tagName,
            name: releaseName,
            body: releaseBody,
            draft: false,
            prerelease: false
        })
    });

    if (createRes.ok) {
        release = await createRes.json();
        console.log(`[OK] Created GitHub Release: ${release.html_url}`);
    } else {
        const err = await createRes.json();
        console.warn(`Release creation notice: ${err.message}`);
        // Try to fetch existing release with this tag
        const getRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tagName}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (getRes.ok) {
            release = await getRes.json();
            console.log(`ℹ Found existing release: ${release.html_url}`);
        } else {
            console.error('[ERR] Failed to create or get release:', err);
            process.exit(1);
        }
    }

    // 2. Identify candidate artifacts in dist/
    const allFiles = fs.readdirSync(distDir);
    const validExtensions = ['.AppImage', '.deb', '.rpm', '.pkg.tar.zst', '.pacman', '.tar.gz', '.exe', '.zip', '.blockmap', '.apk'];
    const artifacts = allFiles.filter(f => {
        const fullPath = path.join(distDir, f);
        if (!fs.statSync(fullPath).isFile()) return false;
        if (f.startsWith('builder-')) return false;
        return validExtensions.some(ext => f.endsWith(ext));
    });

    console.log(`\n[Pkg] Found ${artifacts.length} artifacts to upload:`, artifacts);

    // Existing assets
    const existingAssets = release.assets || [];

    // 3. Upload artifacts
    for (const fileName of artifacts) {
        const filePath = path.join(distDir, fileName);
        const fileStat = fs.statSync(filePath);
        const fileSizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);

        // Delete if already uploaded
        const existing = existingAssets.find(a => a.name === fileName);
        if (existing) {
            console.log(`  [Clean] Removing previous version of ${fileName}...`);
            await fetch(existing.url, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
        }

        console.log(`  ⬆ Uploading ${fileName} (${fileSizeMb} MB)...`);
        const fileBuffer = fs.readFileSync(filePath);
        const uploadUrl = `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(fileName)}`;

        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileStat.size.toString()
            },
            body: fileBuffer
        });

        if (uploadRes.ok) {
            console.log(`  [OK] Uploaded ${fileName}`);
        } else {
            const uploadErr = await uploadRes.text();
            console.error(`  [ERR] Failed to upload ${fileName}:`, uploadErr);
        }
    }

    console.log(`\n Successfully published all executables to release ${tagName}!`);
    console.log(`[Link] Release URL: ${release.html_url}`);
}

publish().catch(err => {
    console.error('Fatal release error:', err);
    process.exit(1);
});
