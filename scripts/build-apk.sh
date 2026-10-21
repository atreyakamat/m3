#!/usr/bin/env bash
set -e

# Task 2: build a size-optimized arm64-v8a APK (<25 MB).
# - EAS profile "preview" carries the dedicated Gradle command:
#     :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
#     (single CPU architecture instead of all four)
# - The committed android/ project enables ProGuard/R8 shrinking
#   (enableProguardInReleaseBuilds=true in android/app/build.gradle).

# Detect LAN IP
LAN_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7}' | tr -d '[:space:]')
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '[:space:]')
fi
if [ -z "$LAN_IP" ]; then
    LAN_IP="192.168.1.116"
fi

echo "=========================================================="
echo " M3 Android APK Builder (arm64-v8a, size-optimized)"
echo " Target API LAN IP: http://${LAN_IP}:8003/api/v1"
echo "=========================================================="

cd "$(dirname "$0")/../apps/mobile"

# Native android project: generate once if missing (Task 2 step 3).
if [ ! -f "android/app/build.gradle" ]; then
    echo "android/ project missing — generating with Expo prebuild..."
    npx expo prebuild --platform android
    echo "Applying size-optimization flags to android/gradle.properties..."
    python3 - "$(pwd)/android/gradle.properties" <<'PYEOF'
import sys
path = sys.argv[1]
with open(path) as fh:
    src = fh.read()
src = src.replace(
    "reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64",
    "reactNativeArchitectures=arm64-v8a",
)
for flag in ("android.enableMinifyInReleaseBuilds", "android.enableShrinkResourcesInReleaseBuilds"):
    src = src.replace(f"{flag}=false", f"{flag}=true")
with open(path, "w") as fh:
    fh.write(src)
print("gradle.properties flags updated (single ABI + R8 shrinking)")
PYEOF
fi

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "eas-cli not found globally. Checking npx eas-cli..."
    EAS_CMD="npx eas-cli"
else
    EAS_CMD="eas"
fi

export EXPO_PUBLIC_API_BASE_URL="http://${LAN_IP}:8003/api/v1"

echo "Building standalone APK using EAS Build..."
echo "Note: If not logged into Expo, EAS will prompt you to log in."
$EAS_CMD build --platform android --profile preview --non-interactive || {
    echo "If EAS interactive prompt is needed, run:"
    echo "cd apps/mobile && npx eas-cli login && npx eas-cli build -p android --profile preview"
}
