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

console.log('🎨 Generating cross-platform icons for NeoBrowser...');

if (!fs.existsSync(sourceIcon)) {
    console.error(`❌ Source icon not found at ${sourceIcon}`);
    process.exit(1);
}

// Ensure directories exist
fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

try {
    // 1. Generate master PNG (512x512) for assets and build
    const assetPng = path.join(assetsDir, 'icon.png');
    const buildPng = path.join(buildDir, 'icon.png');
    const rootPng = path.join(rootDir, 'icon.png');

    console.log('  -> Creating master 512x512 PNG...');
    execSync(`magick "${sourceIcon}" -resize 512x512 "${assetPng}"`);
    fs.copyFileSync(assetPng, buildPng);
    fs.copyFileSync(assetPng, rootPng);

    // 2. Generate multi-resolution Windows ICO (256, 128, 64, 48, 32, 16)
    const buildIco = path.join(buildDir, 'icon.ico');
    const rootIco = path.join(rootDir, 'icon.ico');
    console.log('  -> Creating multi-resolution Windows ICO...');
    execSync(`magick "${sourceIcon}" -define icon:auto-resize=256,128,64,48,32,16 "${buildIco}"`);
    fs.copyFileSync(buildIco, rootIco);

    // 3. Generate individual Linux icons for build/icons/{size}x{size}.png
    const sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512];
    console.log('  -> Creating Linux icon resolution tree...');
    for (const size of sizes) {
        const dest = path.join(iconsDir, `${size}x${size}.png`);
        execSync(`magick "${sourceIcon}" -resize ${size}x${size} "${dest}"`);
    }

    console.log('✅ All icons generated successfully:');
    console.log(`   - Windows ICO: ${buildIco}`);
    console.log(`   - Linux/Universal PNG: ${buildPng}`);
    console.log(`   - Desktop Resolution Icons: ${iconsDir}/*`);
    console.log(`   - Runtime Window Icon: ${assetPng}`);
} catch (err) {
    console.error('❌ Error generating icons:', err.message);
    process.exit(1);
}
