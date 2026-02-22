@echo off
REM FBX2VRMA Converter Setup Script for Windows
REM This script downloads the required FBX2glTF binary

echo 🚀 Setting up FBX2VRMA Converter for Windows...

set BINARY_NAME=FBX2glTF-windows-x64.exe
set DOWNLOAD_URL=https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/%BINARY_NAME%

REM Check if binary already exists
if exist "%BINARY_NAME%" (
    echo ✅ %BINARY_NAME% already exists
    echo 🧪 Testing binary...
    "%BINARY_NAME%" --version >nul 2>&1
    if %errorlevel% == 0 (
        echo ✅ Setup complete! Binary is working.
        goto :end
    ) else (
        echo ⚠️ Existing binary seems corrupted, re-downloading...
        del "%BINARY_NAME%"
    )
)

echo 📥 Downloading %BINARY_NAME%...
echo 🔗 URL: %DOWNLOAD_URL%

REM Try PowerShell download
echo 🔄 Trying PowerShell download...
powershell -Command "try { Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%BINARY_NAME%' -ErrorAction Stop; Write-Host '✅ Downloaded with PowerShell' } catch { Write-Host '❌ PowerShell download failed'; exit 1 }"

if %errorlevel% neq 0 (
    echo.
    echo ❌ Automatic download failed!
    echo.
    echo 📋 Please manually download the binary:
    echo 1. Go to: https://github.com/facebookincubator/FBX2glTF/releases
    echo 2. Click on 'v0.9.7' release
    echo 3. Download: %BINARY_NAME%
    echo 4. Place it in this directory: %CD%
    echo 5. Run this script again
    echo.
    exit /b 1
)

REM Verify download
echo 🧪 Testing binary...
"%BINARY_NAME%" --version >nul 2>&1
if %errorlevel% == 0 (
    echo.
    echo 🎉 Setup complete!
    echo ✅ %BINARY_NAME% is ready to use
    echo.
    echo 🚀 You can now run:
    echo    node fbx2vrma-converter.js -i input.fbx -o output.vrma
    echo.
) else (
    echo.
    echo ❌ Binary test failed!
    echo The downloaded file may be corrupted.
    echo Please try running this script again or download manually.
    echo.
    exit /b 1
)

:end