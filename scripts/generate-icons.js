import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceIcon = path.join(rootDir, 'icon.jpg');
const assetsDir = path.join(rootDir, 'assets');
const buildDir = path.join(rootDir, 'build');
const iconsDir = path.join(buildDir, 'icons');

console.log('[INFO] Generating cross-platform icons for NeoBrowser...');

if (!fs.existsSync(sourceIcon)) {
    console.error(`[ERR] Source icon not found at ${sourceIcon}`);
    process.exit(1);
}

// Ensure directories exist
fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

// Detect ImageMagick command (magick for IM7, convert for IM6)
let tool = null;
try {
    execSync('magick -version', { stdio: 'ignore' });
    tool = 'magick';
} catch {
    try {
        execSync('convert -version', { stdio: 'ignore' });
        tool = 'convert';
    } catch {
        tool = null;
    }
}

const buildIco = path.join(buildDir, 'icon.ico');
const buildPng = path.join(buildDir, 'icon.png');
const assetPng = path.join(assetsDir, 'icon.png');
const rootPng = path.join(rootDir, 'icon.png');
const rootIco = path.join(rootDir, 'icon.ico');

if (!tool) {
    if (fs.existsSync(buildIco) && fs.existsSync(buildPng)) {
        console.log('[WARN] ImageMagick not detected, but pre-built icons already exist. Skipping regeneration.');
        process.exit(0);
    }
    console.error('[ERR] Neither magick nor convert is available, and pre-built icons are missing.');
    process.exit(1);
}

try {
    console.log(`[INFO] Using ImageMagick CLI tool: ${tool}`);

    // 1. Generate master PNG (512x512) for assets and build
    console.log('  -> Creating master 512x512 PNG...');
    execSync(`${tool} "${sourceIcon}" -resize 512x512 "${assetPng}"`);
    fs.copyFileSync(assetPng, buildPng);
    fs.copyFileSync(assetPng, rootPng);

    // 2. Generate multi-resolution Windows ICO (256, 128, 64, 48, 32, 16)
    console.log('  -> Creating multi-resolution Windows ICO...');
    execSync(`${tool} "${sourceIcon}" -define icon:auto-resize=256,128,64,48,32,16 "${buildIco}"`);
    fs.copyFileSync(buildIco, rootIco);

    // 3. Generate individual Linux icons for build/icons/{size}x{size}.png
    const sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512];
    console.log('  -> Creating Linux icon resolution tree...');
    for (const size of sizes) {
        const dest = path.join(iconsDir, `${size}x${size}.png`);
        execSync(`${tool} "${sourceIcon}" -resize ${size}x${size} "${dest}"`);
    }

    console.log('[OK] All icons generated successfully:');
    console.log(`   - Windows ICO: ${buildIco}`);
    console.log(`   - Linux/Universal PNG: ${buildPng}`);
    console.log(`   - Desktop Resolution Icons: ${iconsDir}/*`);
    console.log(`   - Runtime Window Icon: ${assetPng}`);
} catch (err) {
    console.error('[ERR] Error generating icons:', err.message);
    process.exit(1);
}
