# Office LAN setup

1. Give the office host a reserved IP address or stable internal DNS name and keep it powered on.
2. Copy `.env.example` to `.env`, replace every `CHANGE_ME` value, and replace `OFFICE_LAN_IP` in client values with the host LAN address.
3. Allow inbound TCP 8000 and the web-console development port only from the approved office subnet. Do not open port 5432.
4. Run `docker compose up -d --build`; verify `curl http://HOST:8000/health` from another LAN computer.
5. Configure `EXPO_PUBLIC_API_BASE_URL=http://HOST:8000/api/v1` before launching Expo. On a physical Android device, `localhost` is the phone itself, not the office computer.

For the synthetic local prototype, HTTP can be used only on the isolated office network. Before real records, install approved TLS/reverse proxy certificates, constrain CORS to the office console origin, and validate the phone firewall/Wi-Fi path. The Vite console is started with `npm run dev -- --host 0.0.0.0`; do not expose it outside the approved LAN.
