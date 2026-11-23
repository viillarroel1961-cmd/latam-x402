export interface X402RuntimeConfig {
  payTo: `0x${string}`;
  network: `${string}:${string}`;
  facilitatorUrl: string;
  prices: {
    bcv: string;
    bvc: string;
    crypto: string;
    nyse: string;
    ecosystem: string;
  };
}

export function buildWellKnownX402(baseUrl: string, cfg: X402RuntimeConfig) {
  const networkName = cfg.network === "eip155:8453" ? "base" : cfg.network === "eip155:84532" ? "base-sepolia" : cfg.network;
  const toDecimal = (p: string) => p.replace(/^\$/, "");
  return {
    x402Version: 2,
    name: "latam-x402",
    description:
      "Unified LatAm & Global Market Data API (Venezuela BCV FX + Binance P2P spread, Bolsa de Valores de Caracas cross-valued in VES/USD, Global Crypto spot & funding rates, NYSE & LatAm ADRs/ETFs).",
    network: cfg.network,
    networkName,
    asset: "USDC",
    facilitator: cfg.facilitatorUrl,
    payTo: cfg.payTo,
    openapi: `${baseUrl}/openapi.json`,
    llms: `${baseUrl}/llms.txt`,
    resources: [
      `${baseUrl}/api/v1/bcv`,
      `${baseUrl}/api/v1/bvc`,
      `${baseUrl}/api/v1/crypto`,
      `${baseUrl}/api/v1/nyse`,
      `${baseUrl}/api/v1/ecosystem`,
    ],
    services: [
      {
        method: "GET",
        path: "/api/v1/bcv",
        url: `${baseUrl}/api/v1/bcv`,
        description: "Venezuela BCV official USD/EUR FX, Binance P2P USDT/VES & spread history",
        amount: toDecimal(cfg.prices.bcv),
        extensions: { bazaar: { discoverable: true } },
      },
      {
        method: "GET",
        path: "/api/v1/bvc",
        url: `${baseUrl}/api/v1/bvc`,
        description: "Bolsa de Valores de Caracas (BVC) equities in VES, USD BCV & USD P2P",
        amount: toDecimal(cfg.prices.bvc),
        extensions: { bazaar: { discoverable: true } },
      },
      {
        method: "GET",
        path: "/api/v1/bvc/{ticker}",
        url: `${baseUrl}/api/v1/bvc/BVCC`,
        description: "Single Bolsa de Valores de Caracas equity quote in VES, USD BCV & USD P2P",
        amount: toDecimal(cfg.prices.bvc),
        extensions: { bazaar: { discoverable: true } },
      },
      {
        method: "GET",
        path: "/api/v1/crypto",
        url: `${baseUrl}/api/v1/crypto`,
        description: "Global crypto spot 24h prices, volume & perpetual funding rates",
        amount: toDecimal(cfg.prices.crypto),
        extensions: { bazaar: { discoverable: true } },
      },
      {
        method: "GET",
        path: "/api/v1/nyse",
        url: `${baseUrl}/api/v1/nyse`,
        description: "NYSE/NASDAQ US benchmarks & LatAm ADRs/ETFs delayed quotes",
        amount: toDecimal(cfg.prices.nyse),
        extensions: { bazaar: { discoverable: true } },
      },
      {
        method: "GET",
        path: "/api/v1/ecosystem",
        url: `${baseUrl}/api/v1/ecosystem`,
        description: "Unified cross-market snapshot (BCV + BVC + Crypto + NYSE + cross-market ratios)",
        amount: toDecimal(cfg.prices.ecosystem),
        extensions: { bazaar: { discoverable: true } },
      },
    ],
  };
}

export function buildLlmsTxt(baseUrl: string, cfg: X402RuntimeConfig) {
  return `# latam-x402

> Unified LatAm & Global Market Data API monetized via x402 v2 micropayments (USDC on ${cfg.network} via ${cfg.facilitatorUrl}). No API keys or accounts required.

## Discovery
- Root: ${baseUrl}/
- Health & freshness: ${baseUrl}/api/health
- OpenAPI 3.1: ${baseUrl}/openapi.json
- x402 manifest: ${baseUrl}/.well-known/x402.json

## Paid Endpoints (x402 v2, USDC, payTo: ${cfg.payTo})
- GET ${baseUrl}/api/v1/bcv (${cfg.prices.bcv} USDC): Venezuela BCV official USD/EUR rates, Binance P2P USDT/VES mid-price, spread %, and daily history (?days=30).
- GET ${baseUrl}/api/v1/bvc (${cfg.prices.bvc} USDC): Bolsa de Valores de Caracas (BVC) 38 issuers cross-valued in VES, USD (BCV), and USD (USDT P2P), plus daily turnover (?onlyPriced=true).
- GET ${baseUrl}/api/v1/bvc/{ticker} (${cfg.prices.bvc} USDC): Single BVC ticker quote (e.g. BVCC, BNC, BPV, BVL, MVZ.A, RST, TDV.D).
- GET ${baseUrl}/api/v1/crypto (${cfg.prices.crypto} USDC): Major crypto spot 24h prices, volume, and perpetual funding rates (?symbol=BTC).
- GET ${baseUrl}/api/v1/nyse (${cfg.prices.nyse} USDC): US benchmarks (SPY, QQQ, DIA, GLD, USO, AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA, JPM) and LatAm ADRs/ETFs (ILF, MELI, NU, PBR, VALE, EC, YPF) (?category=latam_adr&symbol=MELI).
- GET ${baseUrl}/api/v1/ecosystem (${cfg.prices.ecosystem} USDC): Single unified cross-market JSON combining BCV FX, BVC top movers in USD, Crypto benchmarks & funding, NYSE/LatAm leaders, and cross-market ratios (BTC/VES, BTC/SPY, PAXG/GLD).
`;
}

export function buildOpenApiSpec(baseUrl: string, cfg: X402RuntimeConfig) {
  return {
    openapi: "3.1.0",
    info: {
      title: "latam-x402 — Unified LatAm & Global Market Data API",
      version: "1.0.0",
      description:
        "Pay-per-call x402 API (USDC on Base via PayAI facilitator) unifying Venezuela BCV official FX + Binance P2P spread, Bolsa de Valores de Caracas (BVC) cross-valued in VES/USD, Global Crypto spot & funding rates, and NYSE/LatAm ADRs & ETFs.",
    },
    servers: [{ url: baseUrl }],
    "x-x402": {
      protocol: "x402-v2",
      network: cfg.network,
      asset: "USDC",
      facilitator: cfg.facilitatorUrl,
      payTo: cfg.payTo,
      endpoints: [
        { method: "GET", path: "/api/v1/bcv", price: cfg.prices.bcv, description: "BCV USD/EUR official FX, Binance P2P USDT/VES & spread history" },
        { method: "GET", path: "/api/v1/bvc", price: cfg.prices.bvc, description: "Bolsa de Valores de Caracas (BVC) equities in VES, USD BCV & USD P2P" },
        { method: "GET", path: "/api/v1/bvc/{ticker}", price: cfg.prices.bvc, description: "Single BVC ticker quote with VES & USD cross-valuations" },
        { method: "GET", path: "/api/v1/crypto", price: cfg.prices.crypto, description: "Global crypto spot 24h prices, volume & perpetual funding rates" },
        { method: "GET", path: "/api/v1/nyse", price: cfg.prices.nyse, description: "NYSE/NASDAQ US benchmarks & LatAm ADRs/ETFs delayed quotes" },
        { method: "GET", path: "/api/v1/ecosystem", price: cfg.prices.ecosystem, description: "Unified cross-market snapshot (BCV + BVC + Crypto + NYSE + ratios)" },
      ],
    },
    paths: {
      "/api/health": {
        get: {
          summary: "Health check and feed freshness (free)",
          responses: { "200": { description: "Service status and last sync timestamps" } },
        },
      },
      "/api/docs": {
        get: {
          summary: "OpenAPI 3.1 + x402 discovery manifest (free)",
          responses: { "200": { description: "Machine-readable API & x402 pricing schema" } },
        },
      },
      "/api/v1/bcv": {
        get: {
          summary: `Venezuela BCV FX + USDT P2P spread (${cfg.prices.bcv} USDC)`,
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 365, default: 30 },
              description: "Number of historical days to include",
            },
          ],
          responses: {
            "200": { description: "Latest BCV USD/EUR, USDT P2P mid, spread % and daily history" },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/bvc": {
        get: {
          summary: `Bolsa de Valores de Caracas equities (${cfg.prices.bvc} USDC)`,
          parameters: [
            {
              name: "onlyPriced",
              in: "query",
              required: false,
              schema: { type: "boolean", default: false },
              description: "Return only tickers with a live or cached VES quote",
            },
          ],
          responses: {
            "200": { description: "BVC catalog cross-valued in VES, USD BCV & USD P2P" },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/bvc/{ticker}": {
        get: {
          summary: `Single BVC equity quote (${cfg.prices.bvc} USDC)`,
          parameters: [
            {
              name: "ticker",
              in: "path",
              required: true,
              schema: { type: "string", example: "BVCC" },
            },
          ],
          responses: {
            "200": { description: "Single BVC ticker details in VES & USD" },
            "402": { description: "Payment Required (x402 Base USDC)" },
            "404": { description: "Ticker not found in BVC catalog" },
          },
        },
      },
      "/api/v1/crypto": {
        get: {
          summary: `Global Crypto spot + funding rates (${cfg.prices.crypto} USDC)`,
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: false,
              schema: { type: "string", example: "BTC" },
              description: "Optional filter by base symbol or pair (e.g. BTC or BTCUSDT)",
            },
          ],
          responses: {
            "200": { description: "Spot 24h prices, volume and perpetual funding rates" },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/nyse": {
        get: {
          summary: `NYSE / US & LatAm ADRs and ETFs (${cfg.prices.nyse} USDC)`,
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: false,
              schema: { type: "string", example: "MELI" },
            },
            {
              name: "category",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["etf", "latam_etf", "us_equity", "latam_adr"] },
            },
          ],
          responses: {
            "200": { description: "Delayed / end-of-day quotes for US benchmarks and LatAm ADRs" },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/ecosystem": {
        get: {
          summary: `Unified cross-market ecosystem snapshot (${cfg.prices.ecosystem} USDC)`,
          responses: {
            "200": {
              description:
                "Single JSON combining BCV FX + spread, BVC movers in USD, Crypto benchmarks & funding, NYSE/LatAm leaders and cross-market ratios",
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
    },
  };
}
