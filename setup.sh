#!/bin/bash

# FBX2VRMA Converter Setup Script
# This script downloads the required FBX2glTF binary for your platform

set -e  # Exit on any error

echo "🚀 Setting up FBX2VRMA Converter..."

# Detect platform
OS=""
ARCH=""
BINARY_NAME=""

case "$(uname -s)" in
    Darwin*)
        OS="darwin"
        BINARY_NAME="FBX2glTF-darwin-x64"
        ARCH="$(uname -m)"
        if [ "$ARCH" = "arm64" ]; then
            echo "📱 Detected: macOS (Apple Silicon / arm64)"
            echo "   Note: Using x64 binary via Rosetta 2."
            echo "   If Rosetta 2 is not installed, run:"
            echo "   softwareupdate --install-rosetta --agree-to-license"
        else
            echo "📱 Detected: macOS (Intel / x64)"
        fi
        ;;
    Linux*)
        OS="linux"
        BINARY_NAME="FBX2glTF-linux-x64"
        echo "🐧 Detected: Linux"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        OS="windows"
        BINARY_NAME="FBX2glTF-windows-x64.exe"
        echo "🪟 Detected: Windows"
        ;;
    *)
        echo "❌ Unsupported operating system: $(uname -s)"
        echo "Please manually download FBX2glTF from:"
        echo "https://github.com/facebookincubator/FBX2glTF/releases"
        exit 1
        ;;
esac

# Check if binary already exists
if [ -f "$BINARY_NAME" ]; then
    echo "✅ $BINARY_NAME already exists"
    if [ "$OS" != "windows" ]; then
        chmod +x "$BINARY_NAME"
    fi
    echo "🧪 Testing binary..."
    if ./"$BINARY_NAME" --version > /dev/null 2>&1; then
        echo "✅ Setup complete! Binary is working."
        exit 0
    else
        echo "⚠️ Existing binary seems corrupted, re-downloading..."
        rm -f "$BINARY_NAME"
    fi
fi

# Download URLs
BASE_URL="https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7"
DOWNLOAD_URL="$BASE_URL/$BINARY_NAME"

echo "📥 Downloading $BINARY_NAME..."
echo "🔗 URL: $DOWNLOAD_URL"

# Try multiple download methods
DOWNLOAD_SUCCESS=false

# Method 1: curl
if command -v curl > /dev/null 2>&1; then
    echo "🔄 Trying curl..."
    if curl -L -f -o "$BINARY_NAME" "$DOWNLOAD_URL"; then
        DOWNLOAD_SUCCESS=true
        echo "✅ Downloaded with curl"
    else
        echo "❌ curl failed"
    fi
fi

# Method 2: wget (if curl failed)
if [ "$DOWNLOAD_SUCCESS" = false ] && command -v wget > /dev/null 2>&1; then
    echo "🔄 Trying wget..."
    if wget -O "$BINARY_NAME" "$DOWNLOAD_URL"; then
        DOWNLOAD_SUCCESS=true
        echo "✅ Downloaded with wget"
    else
        echo "❌ wget failed"
    fi
fi

# Method 3: Manual fallback
if [ "$DOWNLOAD_SUCCESS" = false ]; then
    echo ""
    echo "❌ Automatic download failed!"
    echo ""
    echo "📋 Please manually download the binary:"
    echo "1. Go to: https://github.com/facebookincubator/FBX2glTF/releases"
    echo "2. Click on 'v0.9.7' release"
    echo "3. Download: $BINARY_NAME"
    echo "4. Place it in this directory: $(pwd)"
    echo "5. Run this script again"
    echo ""
    exit 1
fi

# Make executable (Unix systems)
if [ "$OS" != "windows" ]; then
    chmod +x "$BINARY_NAME"
    echo "🔧 Made binary executable"
fi

# Verify download
echo "🧪 Testing binary..."
if ./"$BINARY_NAME" --version > /dev/null 2>&1; then
    echo ""
    echo "🎉 Setup complete!"
    echo "✅ $BINARY_NAME is ready to use"
    echo ""
    echo "🚀 You can now run:"
    echo "   node fbx2vrma-converter.js -i input.fbx -o output.vrma"
    echo ""
else
    echo ""
    echo "❌ Binary test failed!"
    echo "The downloaded file may be corrupted."
    echo "Please try running this script again or download manually."
    echo ""
    exit 1
fi