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
