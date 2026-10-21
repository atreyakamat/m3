# Expo Go setup

The project uses Expo-compatible packages and does not require a custom development client for the first-run experience. From `apps/mobile`, install dependencies using `npx expo install` (which should reconcile packages to the local Expo SDK), then set a reachable API in `.env` at repository root or an `apps/mobile/.env` file:

```sh
EXPO_PUBLIC_API_BASE_URL=http://OFFICE_LAN_IP:8000/api/v1
npx expo start
```

Scan the Expo terminal QR with Expo Go while the phone and development computer share the same Wi-Fi. Start without the backend if desired and select **Use synthetic demo data**: this exercises the cached/read-only launch path. Connect to the API to sign in and refresh an authorized cache. Expo Go compatibility was selected from Expo SDK 53 package versions in `package.json`; actual device startup remains a required local verification because this environment has no emulator or physical device.

## Managing the API address when the network changes

The mobile client reads `EXPO_PUBLIC_API_BASE_URL` from the repo-root `.env` or `apps/mobile/.env` at build/dev-server start time. The value must be the scanner-device-reachable host of the API machine — never `localhost` (that is the phone itself).

Preferred: the host's **Tailscale IPv4**, because it stays reachable from the phone and laptop on any network (Wi-Fi, hotspot, remote) while the tailnet is up, and survives router/DHCP changes. Current: `100.118.148.11`.

Env files that carry the address (keep them in sync; each tool reads only its own): `.env` (repo root, Compose/API), `services/api/.env` (API, CORS origins), `apps/mobile/.env` (Expo reads this one and `EXPO_PUBLIC_*` from the shell), `apps/web/.env` (Vite reads this one). `.env` files are gitignored. A value exported in the shell, or set by `m3s start` (which exports `EXPO_PUBLIC_API_BASE_URL` from the detected Tailscale/LAN IP), overrides the file for that process.

Update procedure (run on the API host):

```sh
tailscale ip -4                 # -> 100.x.y.z  (address can change on re-install; re-check before use)
curl -m 5 http://100.x.y.z:8001/health     # must return 200 before shipping config
# edit root .env, services/api/.env, apps/mobile/.env and apps/web/.env: replace the old 100.x.y.z with the new value in
# EXPO_PUBLIC_API_BASE_URL, API_BASE_URL, VITE_API_BASE_URL and API_CORS_ORIGINS
```

Then:

- **Web/static bundle**: `rm -rf apps/mobile/dist && npx expo export --platform web` and verify the embedded URL with `grep -o 'const e="http[^"]*api/v1' apps/mobile/dist/_expo/static/js/web/entry-*.js`.
  Cache pitfall (observed 2026-10-20): Metro's global transform cache at `/tmp/metro-cache` does not rebake `process.env.EXPO_PUBLIC_API_BASE_URL`. If the exported bundle still contains a stale address, run `rm -rf /tmp/metro-cache` and export again.
- **Dev server / QR**: restart the Expo dev process with `REACT_NATIVE_PACKAGER_HOSTNAME=100.x.y.z npx expo start --host lan` so the QR carries an address the phone can reach. A running dev server does not reload `.env`; always restart it after editing env files.
- **Native (Expo Go / production)**: for a production build the address is baked in at build time; re-run the build after changing `.env`.

Fallback: the host's current LAN IP (`ip -4 addr show`, e.g. `192.168.1.29`) works only while phone and host share the same Wi-Fi; it must be re-set whenever the office network or DHCP lease changes. Do not leave addresses from previous networks (e.g. `192.168.1.122`, the decommissioned host) in `.env`.

No custom native QR, MMKV, SMS, or GPS module is required. QR/GPS/SMS are deferred.

## Verifying what a bundle actually embeds

```sh
# Dev server (what Expo Go downloads); must show the Tailscale URL, not the 10.0.2.2 fallback only:
curl -s "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false" | grep -aoE 'http://[0-9.]+:800[0-9]/api/v1' | sort | uniq -c
# Native (Hermes) export:
npx expo export --platform android --output-dir /tmp/m3-android && strings -a /tmp/m3-android/_expo/static/js/android/*.hbc | grep -oE 'http://[0-9.]+:800[0-9]/api/v1'
# QR payload:
qrencode -o apps/mobile/expo-qr.png -s 10 "exp://$(tailscale ip -4):8081" && zbarimg -q apps/mobile/expo-qr.png
```

`10.0.2.2:8000` in a bundle is only the emulator fallback literal in `src/api.ts`; it is used when `EXPO_PUBLIC_API_BASE_URL` is unset.
