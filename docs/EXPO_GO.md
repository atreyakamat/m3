# Expo Go setup

The project uses Expo-compatible packages and does not require a custom development client for the first-run experience. From `apps/mobile`, install dependencies using `npx expo install` (which should reconcile packages to the local Expo SDK), then set a reachable API in `.env` at repository root or an `apps/mobile/.env` file:

```sh
EXPO_PUBLIC_API_BASE_URL=http://OFFICE_LAN_IP:8000/api/v1
npx expo start
```

Scan the Expo terminal QR with Expo Go while the phone and development computer share the same Wi-Fi. Start without the backend if desired and select **Use synthetic demo data**: this exercises the cached/read-only launch path. Connect to the API to sign in and refresh an authorized cache. Expo Go compatibility was selected from Expo SDK 53 package versions in `package.json`; actual device startup remains a required local verification because this environment has no emulator or physical device.

No custom native QR, MMKV, SMS, or GPS module is required. QR/GPS/SMS are deferred.
