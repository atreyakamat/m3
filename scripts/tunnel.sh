#!/usr/bin/env bash
# Launch a public HTTPS tunnel to the local M3 API (default port 8003) so the
# installed Android APK can reach the laptop over cellular or any Wi-Fi,
# bypassing router client isolation and firewalls.
#
# Usage:
#   ./scripts/tunnel.sh [port]        default: 8003
#
# Copy the printed public URL into the mobile app's "Server Configuration"
# dialog on the sign-in screen (it is used verbatim as the API base URL).
set -euo pipefail

PORT="${1:-8003}"

# Default to the compose API port mapping used by this repo.
if [ "$PORT" = "8003" ]; then
    # Respect a custom COMPOSE_API_PORT when it is exported.
    if [ -n "${COMPOSE_API_PORT:-}" ] && [ "${COMPOSE_API_PORT}" != "8003" ]; then
        PORT="${COMPOSE_API_PORT}"
    fi
fi

TARGET="http://localhost:${PORT}"

echo "============================================================"
echo " M3 Public Tunnel -> ${TARGET}"
echo " Keep this window open. The app talks to the printed URL."
echo "============================================================"

if command -v cloudflared >/dev/null 2>&1; then
    echo "Starting Cloudflare quick tunnel..."
    exec cloudflared tunnel --url "${TARGET}"
elif command -v ngrok >/dev/null 2>&1; then
    echo "Starting ngrok tunnel..."
    exec ngrok http "${PORT}"
else
    echo "ERROR: Neither 'cloudflared' nor 'ngrok' is installed."
    echo ""
    echo "Install one of the following, then re-run this script:"
    echo ""
    echo "  Cloudflare (recommended, no account needed for quick tunnels):"
    echo "    sudo apt install -y cloudflared"
    echo "    (or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)"
    echo ""
    echo "  ngrok (requires a free account + authtoken):"
    echo "    snap install ngrok   # or: sudo apt install -y ngrok"
    echo "    ngrok config add-authtoken <token>   # from https://dashboard.ngrok.com"
    exit 1
fi
