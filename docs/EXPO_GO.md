# Expo Go setup

The project uses Expo-compatible packages and does not require a custom development client for the first-run experience. From `apps/mobile`, install dependencies using `npx expo install` (which should reconcile packages to the local Expo SDK), then configure the API URL in `.env` at repository root or an `apps/mobile/.env` file:

```sh
EXPO_PUBLIC_API_BASE_URL=http://<OFFICE_LAN_IP>:8003/api/v1
npx expo start
```

Or simply run `./scripts/m3s start` from the repo root, which automatically discovers your local Wi-Fi / LAN IP, starts Docker Compose backend services, and launches Expo Metro.

Scan the Expo terminal QR (`./scripts/m3s qr`) with Expo Go while the phone and development computer share the same Wi-Fi. Start without the backend if desired and select **Use synthetic demo data**: this exercises the cached/read-only launch path. Connect to the API to sign in and refresh an authorized cache.

---

## Managing the API Address When the Network Changes

The mobile client reads `EXPO_PUBLIC_API_BASE_URL` from the repo-root `.env` or `apps/mobile/.env` at build/dev-server start time. The value must be the scanner-device-reachable host of the API machine — never `localhost` (that is the phone itself).

### 1. Primary: Local Network (LAN) IP
For physical Android device testing on the same Wi-Fi network, use the computer's LAN IPv4 (e.g. `192.168.1.122`).
- Discover via: `ip -4 route get 1.1.1.1 | awk '{print $7}'`
- Backend runs on Docker container published port: `8003`
- The `m3s` script automates this by default (`./scripts/m3s start`).
- See [docs/LAN_SETUP.md](LAN_SETUP.md) for full network configuration, troubleshooting, and container persistence details.

### 2. Optional: Tailscale IPv4
If developing remotely or across networks where direct Wi-Fi communication is unavailable:
- Check address: `tailscale ip -4` (e.g. `100.118.148.11`)
- Run `M3_USE_TAILSCALE=1 ./scripts/m3s start` to bind to the Tailscale interface.

---

## Verifying What a Bundle Actually Embeds

```sh
# Dev server (what Expo Go downloads); must show the LAN or Tailscale URL, not only the 10.0.2.2 fallback:
curl -s "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false" | grep -aoE 'http://[0-9.]+:800[0-9]/api/v1' | sort | uniq -c

# Native (Hermes) export:
npx expo export --platform android --output-dir /tmp/m3-android && strings -a /tmp/m3-android/_expo/static/js/android/*.hbc | grep -oE 'http://[0-9.]+:800[0-9]/api/v1'

# QR payload check:
zbarimg -q apps/mobile/expo-qr.png
```

`10.0.2.2:8003` in a bundle is only the Android emulator fallback in `src/api.ts`; it is used when running in an Android Virtual Device (AVD).
