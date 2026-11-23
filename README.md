# latam-x402

[![Glama MCP Server](https://glama.ai/mcp/servers/viillarroel1961-cmd/latam-x402/badge)](https://glama.ai/mcp/servers/viillarroel1961-cmd/latam-x402)

Unified **LatAm & Global Market Data API** monetized natively with the **[x402](https://x402.org) v2** HTTP micropayment protocol (**USDC on Base** via **PayAI** facilitator — zero API keys, zero account sign-up, instant autonomous settlement for AI agents and apps).

## Why latam-x402?
Financial data across Venezuela, LatAm equities, Crypto, and Wall Street normally lives fragmented across incompatible portals. **latam-x402** unifies and cross-values all four in clean JSON:

- **BCV & Venezuela FX (`/api/v1/bcv`)** — Official BCV USD & EUR rates, Binance P2P USDT/VES mid-price, real-time spread %, and rolling daily history.
- **Bolsa de Valores de Caracas (`/api/v1/bvc`, `/api/v1/bvc/:ticker`)** — 38 BVC issuers normalized in **VES**, **USD (BCV)**, and **USD (USDT P2P)**.
- **Global Crypto (`/api/v1/crypto`)** — Spot 24h prices, volume, and perpetual funding rates across major assets (`BTC`, `ETH`, `SOL`, `BNB`, `PAXG`, etc.).
- **NYSE & LatAm ADRs (`/api/v1/nyse`)** — Delayed / end-of-day quotes for US benchmarks (`SPY`, `QQQ`, `GLD`, `AAPL`, `NVDA`...) and LatAm leaders (`ILF`, `MELI`, `NU`, `PBR`, `VALE`, `EC`, `YPF`).
- **Unified Ecosystem (`/api/v1/ecosystem`)** — All four markets + cross-market ratios (`BTC/VES`, `BTC/SPY`, `PAXG/GLD`, Venezuela FX spread) in a single agent-ready payload.

## Pricing (Base USDC via x402)

| Endpoint | Price | Description |
|---|---|---|
| `GET /` | Free | Service overview & pricing |
| `GET /api/health` | Free | Live status & last sync UTC per feed |
| `GET /api/docs` / `/api/openapi.json` | Free | OpenAPI 3.1 + x402 discovery manifest |
| `GET /api/v1/bcv` | `$0.002` | BCV USD/EUR + USDT P2P + spread + history (`?days=30`) |
| `GET /api/v1/latam-fx` | `$0.005` | 8 LatAm countries official vs parallel/MEP/CCL vs Binance USDT P2P (`?country=AR`) |
| `GET /api/v1/crypto` | `$0.002` | Global crypto spot 24h + funding (`?symbol=BTC`) |
| `GET /api/v1/crypto/signals` | `$0.005` | Pre-computed RSI(14) 4h/1d, EMA 20/50/200, ATR%, 20d S/R, trend & funding (`?symbol=BTC`) |
| `GET /api/v1/nyse` | `$0.003` | NYSE/NASDAQ US & LatAm ADRs (`?symbol=MELI&category=latam_adr`) |
| `GET /api/v1/bvc` | `$0.005` | Bolsa de Caracas in VES, USD BCV & USD P2P (`?onlyPriced=true`) |
| `GET /api/v1/bvc/:ticker` | `$0.005` | Single BVC issuer (e.g. `BVCC`, `BNC`, `MVZ.A`, `RST`) |
| `GET /api/v1/defi/yields` | `$0.005` | Top DeFi stablecoin yields (TVL >= $1M) on Base, Solana, Arbitrum & Ethereum (`?chain=Base`) |
| `GET /api/v1/predictions` | `$0.005` | Most liquid Polymarket prediction markets (`?topic=crypto&limit=20`) |
| `GET /api/v1/ecosystem` | `$0.01` | Full unified cross-market snapshot + ratios (`?sections=all`) |

## Documentation & Examples
- Full API reference & real JSON response examples (ES): [`DOCS.md`](./DOCS.md)
- MCP Server installation (Claude Desktop, Cursor, Cline, Glama): [`llms-install.md`](./llms-install.md)
- Glama MCP Directory: `https://glama.ai/mcp/servers/viillarroel1961-cmd/latam-x402`
- Remote MCP endpoint (Streamable HTTP): `https://latam-x402.vercel.app/api/mcp`
- Machine-readable OpenAPI 3.1: `https://latam-x402.vercel.app/openapi.json`
- x402 discovery manifest: `https://latam-x402.vercel.app/.well-known/x402.json`
- LLM index: `https://latam-x402.vercel.app/llms.txt`
- Merchant page (x402scan / Poncho): `https://tryponcho.com/m/latam-x402.vercel.app`

## Local Development

```bash
npm install
npm run sync      # Fetches fresh snapshots into data/*.json
npm run typecheck # Verifies TypeScript types
npm run dev       # Starts server on http://localhost:3000
```

## Deploy to Vercel ($0)

1. Push repo to GitHub (`viillarroel1961-cmd/latam-x402`).
2. Import in Vercel and set Environment Variables:
   - `PAY_TO_ADDRESS` = your MetaMask EVM address (`0x...`)
   - `X402_NETWORK` = `eip155:84532` (Base Sepolia testnet first) → switch to `eip155:8453` (Base Mainnet) after testing
   - `X402_FACILITATOR_URL` = `https://facilitator.payai.network`
   - `DATA_REMOTE_BASE_URL` = `https://raw.githubusercontent.com/viillarroel1961-cmd/latam-x402/main/data`
   - *(Optional sales tracking hook)* `SALES_SHEET_WEBHOOK_URL`, `SALES_SHEET_KEY`, `SALES_SHEET_ID` (Google Sheets via Apps Script) and/or `SALES_WEBHOOK_URL` (Discord or JSON webhook)
3. Enable GitHub Actions workflow (`Sync Market Data`) so `data/*.json` refreshes every 2 hours automatically.
