#!/usr/bin/env bash
set -e

echo "=============================================="
echo "   NeoBrowser Cross-Platform Build System"
echo "=============================================="
echo ""

# Navigate to repo root
cd "$(dirname "$0")/.."

# Step 1: Ensure icons are up to date
echo "[BUILD] Step 1/3: Checking & generating cross-platform icon assets..."
npm run icons:generate

# Step 2: Build Linux targets
echo ""
echo "[LINUX] Step 2/3: Building Linux distribution formats..."
echo "    -> Targets: AppImage, deb, pacman, tar.gz"
npx electron-builder --linux AppImage deb pacman tar.gz

# Step 3: Build Windows targets
echo ""
echo "[WINDOWS] Step 3/3: Building Windows formats..."
echo "    -> Targets: NSIS Setup (.exe), Portable (.exe), Zip archive"
npx electron-builder --win nsis portable zip

echo ""
echo "=============================================="
echo "[SUCCESS] Build Completed! Generated artifacts in dist/:"
echo "=============================================="
ls -lh dist/*.AppImage dist/*.deb dist/*.pkg.tar.zst dist/*.tar.gz dist/*.exe dist/*.zip 2>/dev/null || true
echo "=============================================="
