# TradeBuddy (Node Backend + React UI)

TradeBuddy now runs as a Node.js stack end to end:

- Express backend for FYERS auth, quotes, history, orders, watchlists, analytics, and live websocket streaming
- React + Vite frontend on `http://localhost:5100`
- Node-based scanner service on `http://localhost:8001`
- Main Node backend server on `http://localhost:5000`

## Prerequisites

```text
Node.js 22.x
npm 10+
```

## Environment

Create `.env` from `.env.example` and fill these values:

```text
FYERS_CLIENT_ID=...
FYERS_SECRET_KEY=...
FYERS_REDIRECT_URI=http://localhost:5000/api/auth/callback
FYERS_USER_ID=...
FYERS_TOTP_KEY=...
FYERS_PIN=OPTIONAL_FALLBACK_PIN
FYERS_TOKEN_FILE=.tokens/fyers_token.json
FYERS_ORDER_STATIC_IP=YOUR_WHITELISTED_STATIC_IP
FYERS_ENFORCE_STATIC_IP_CHECK=true
PUBLIC_IP_CHECK_URL=https://api.ipify.org
FYERS_PAPER_TRADE_MODE=true
FRONTEND_URL=http://localhost:5100
```

Notes:

- `FYERS_PIN` is optional for non-interactive flows. The UI login asks the user for the 4-digit broker PIN.
- `FYERS_REDIRECT_URI` must match the FYERS app configuration exactly.
- If you do not have a fixed outbound IP for live orders, set `FYERS_ENFORCE_STATIC_IP_CHECK=false` or keep paper trading enabled.

## Install

```powershell
npm install
```

## Local Development

Run the full stack:

```powershell
npm run dev
```

This starts:

- backend API on `http://localhost:5000`
- scanner API on `http://localhost:8001`
- frontend UI on `http://localhost:5100`

Individual services:

```powershell
npm run dev:backend
npm run dev:scanner
npm run dev:frontend
```

## Runtime URLs

- Frontend: `http://localhost:5100`
- Backend health: `http://localhost:5000/api/health`
- Scanner health: `http://localhost:8001/api/health`

The Vite frontend proxies:

- `/api` -> `http://localhost:5000`
- `/scanner-api` -> `http://localhost:8001`

## Login Flow

1. Open the frontend.
2. Click **Login with FYERS**.
3. Enter the 4-digit broker PIN when prompted.
4. The backend attempts TOTP login automatically.
5. If FYERS requires browser auth, the app redirects to the FYERS login page.
6. After callback, the backend stores the token and returns to the UI.

## Frontend Build

Build the frontend bundle when you need a production UI artifact:

```powershell
npm run build
```

## Features

- FYERS login with TOTP + PIN fallback flow
- portfolio dashboard with holdings, positions, funds, orders, and trades
- websocket quote streaming on `/api/live`
- watchlist CRUD and smart/predefined watchlist catalog
- symbol search, quotes, history, and technical analytics
- direct screener datasets from the Node scanner service
- guarded order placement with paper-trade and static-IP controls

## Notes

- The supported runtime and server code are Node-only.
- Local app state is stored under `.tokens`, `.cache`, and `.data`.
- Keep `.env` and token files private.
