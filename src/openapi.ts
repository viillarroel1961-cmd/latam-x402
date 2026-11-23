export interface X402RuntimeConfig {
  payTo: `0x${string}`;
  network: `${string}:${string}`;
  facilitatorUrl: string;
  prices: {
    bcv: string;
    bvc: string;
    crypto: string;
    cryptoSignals: string;
    nyse: string;
    latamFx: string;
    defiYields: string;
    predictions: string;
    ecosystem: string;
  };
}

export function buildWellKnownX402(baseUrl: string, cfg: X402RuntimeConfig) {
  const networkName =
    cfg.network === "eip155:8453"
      ? "base"
      : cfg.network === "eip155:84532"
      ? "base-sepolia"
      : cfg.network;
  const toDecimal = (p: string) => p.replace(/^\$/, "");

  const services = [
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
      path: "/api/v1/latam-fx",
      url: `${baseUrl}/api/v1/latam-fx`,
      description:
        "LatAm FX & Binance USDT P2P spreads across 8 countries (VE, AR, CO, BR, MX, CL, PE, BO)",
      amount: toDecimal(cfg.prices.latamFx),
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
      path: "/api/v1/crypto/signals",
      url: `${baseUrl}/api/v1/crypto/signals`,
      description:
        "Pre-computed crypto technicals: RSI(14) 4h/1d, EMA 20/50/200, ATR%, 20d S/R, trend & funding extremes",
      amount: toDecimal(cfg.prices.cryptoSignals),
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
      path: "/api/v1/defi/yields",
      url: `${baseUrl}/api/v1/defi/yields`,
      description:
        "Top DeFi stablecoin yields (USDC/USDT/DAI, TVL >= $1M) across Base, Solana, Arbitrum & Ethereum",
      amount: toDecimal(cfg.prices.defiYields),
      extensions: { bazaar: { discoverable: true } },
    },
    {
      method: "GET",
      path: "/api/v1/predictions",
      url: `${baseUrl}/api/v1/predictions`,
      description:
        "Most liquid Polymarket prediction markets with live probabilities, 24h volume & topic filters",
      amount: toDecimal(cfg.prices.predictions),
      extensions: { bazaar: { discoverable: true } },
    },
    {
      method: "GET",
      path: "/api/v1/ecosystem",
      url: `${baseUrl}/api/v1/ecosystem`,
      description:
        "Unified cross-market snapshot (BCV + LatAm FX + BVC + Crypto + Signals + NYSE + DeFi Yields + Polymarket)",
      amount: toDecimal(cfg.prices.ecosystem),
      extensions: { bazaar: { discoverable: true } },
    },
  ];

  return {
    x402Version: 2,
    name: "latam-x402",
    description:
      "Unified LatAm & Global Market Data API (BCV & 8-country LatAm FX/P2P spreads, Bolsa de Caracas in VES/USD, Crypto spot & pre-computed technical signals, NYSE & LatAm ADRs, DeFi stablecoin yields & Polymarket predictions).",
    network: cfg.network,
    networkName,
    asset: "USDC",
    facilitator: cfg.facilitatorUrl,
    payTo: cfg.payTo,
    openapi: `${baseUrl}/openapi.json`,
    llms: `${baseUrl}/llms.txt`,
    resources: services.map((s) => s.url),
    services,
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
- GET ${baseUrl}/api/v1/latam-fx (${cfg.prices.latamFx} USDC): Official FX vs parallel/MEP/CCL vs Binance USDT P2P & spreads for VE, AR, CO, BR, MX, CL, PE, BO (?country=AR).
- GET ${baseUrl}/api/v1/bvc (${cfg.prices.bvc} USDC): Bolsa de Valores de Caracas (BVC) 38 issuers cross-valued in VES, USD (BCV), and USD (USDT P2P) (?onlyPriced=true).
- GET ${baseUrl}/api/v1/bvc/{ticker} (${cfg.prices.bvc} USDC): Single BVC ticker quote (e.g. BVCC, BNC, BPV, BVL, MVZ.A, RST, TDV.D).
- GET ${baseUrl}/api/v1/crypto (${cfg.prices.crypto} USDC): Major crypto spot 24h prices, volume, and perpetual funding rates (?symbol=BTC).
- GET ${baseUrl}/api/v1/crypto/signals (${cfg.prices.cryptoSignals} USDC): Pre-computed RSI(14) 4h/1d, EMA 20/50/200, ATR%, 20d support/resistance, trend & funding extremes (?symbol=BTC&trend=bullish).
- GET ${baseUrl}/api/v1/nyse (${cfg.prices.nyse} USDC): US benchmarks (SPY, QQQ, DIA, GLD, USO, AAPL, MSFT, NVDA...) and LatAm ADRs/ETFs (ILF, MELI, NU, PBR, VALE, EC, YPF) (?category=latam_adr&symbol=MELI).
- GET ${baseUrl}/api/v1/defi/yields (${cfg.prices.defiYields} USDC): Top DeFi stablecoin yields (TVL >= $1M) filtered by chain & symbol (?chain=Base&symbol=USDC&minTvl=5000000).
- GET ${baseUrl}/api/v1/predictions (${cfg.prices.predictions} USDC): Top liquid Polymarket prediction markets with probabilities & 24h volume (?topic=crypto&limit=15).
- GET ${baseUrl}/api/v1/ecosystem (${cfg.prices.ecosystem} USDC): Single unified cross-market JSON combining all feeds + ratios (?sections=all|fx|latam|bvc|crypto|signals|nyse|defi|predictions|ratios).
`;
}

export function buildOpenApiSpec(baseUrl: string, cfg: X402RuntimeConfig) {
  const jsonObjectSchema = { type: "object", additionalProperties: true };
  return {
    openapi: "3.1.0",
    info: {
      title: "latam-x402 — Unified LatAm & Global Market Data API",
      version: "1.1.0",
      description:
        "Pay-per-call x402 API (USDC on Base via PayAI facilitator) unifying Venezuela BCV + 8-country LatAm FX/P2P spreads, Bolsa de Valores de Caracas (BVC) cross-valued in VES/USD, Global Crypto spot & technical signals, NYSE/LatAm ADRs, DeFi stablecoin yields & Polymarket predictions.",
      contact: {
        name: "latam-x402",
        email: "viillarroel1961@gmail.com",
        url: "https://github.com/viillarroel1961-cmd/latam-x402",
      },
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
        { method: "GET", path: "/api/v1/latam-fx", price: cfg.prices.latamFx, description: "LatAm FX & USDT P2P spreads across 8 countries (VE, AR, CO, BR, MX, CL, PE, BO)" },
        { method: "GET", path: "/api/v1/bvc", price: cfg.prices.bvc, description: "Bolsa de Valores de Caracas (BVC) equities in VES, USD BCV & USD P2P" },
        { method: "GET", path: "/api/v1/bvc/{ticker}", price: cfg.prices.bvc, description: "Single BVC ticker quote with VES & USD cross-valuations" },
        { method: "GET", path: "/api/v1/crypto", price: cfg.prices.crypto, description: "Global crypto spot 24h prices, volume & perpetual funding rates" },
        { method: "GET", path: "/api/v1/crypto/signals", price: cfg.prices.cryptoSignals, description: "Pre-computed crypto technicals (RSI 14, EMA 20/50/200, ATR%, S/R, funding)" },
        { method: "GET", path: "/api/v1/nyse", price: cfg.prices.nyse, description: "NYSE/NASDAQ US benchmarks & LatAm ADRs/ETFs delayed quotes" },
        { method: "GET", path: "/api/v1/defi/yields", price: cfg.prices.defiYields, description: "Top DeFi stablecoin yields (TVL >= $1M) on Base, Solana, Arbitrum & Ethereum" },
        { method: "GET", path: "/api/v1/predictions", price: cfg.prices.predictions, description: "Most liquid Polymarket prediction markets with probabilities & 24h volume" },
        { method: "GET", path: "/api/v1/ecosystem", price: cfg.prices.ecosystem, description: "Unified cross-market snapshot combining all feeds + cross-market ratios" },
      ],
    },
    paths: {
      "/api/health": {
        get: {
          summary: "Health check and feed freshness (free)",
          security: [],
          responses: {
            "200": {
              description: "Service status and last sync timestamps",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
          },
        },
      },
      "/api/docs": {
        get: {
          summary: "OpenAPI 3.1 + x402 discovery manifest (free)",
          security: [],
          responses: {
            "200": {
              description: "Machine-readable API & x402 pricing schema",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
          },
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
            "200": {
              description: "Latest BCV USD/EUR, USDT P2P mid, spread % and daily history",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/latam-fx": {
        get: {
          summary: `LatAm FX official vs parallel vs Binance USDT P2P (${cfg.prices.latamFx} USDC)`,
          parameters: [
            {
              name: "country",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["VE", "AR", "CO", "BR", "MX", "CL", "PE", "BO"] },
              description: "Optional ISO country code filter (e.g. VE, AR, CO, BR, MX, CL, PE, BO)",
            },
          ],
          responses: {
            "200": {
              description: "Official FX, parallel/MEP/CCL rates, Binance USDT P2P buy/sell/mid & spread %",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
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
            "200": {
              description: "BVC catalog cross-valued in VES, USD BCV & USD P2P",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
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
              schema: { type: "string", default: "BVCC", example: "BVCC" },
              description: "Bolsa de Valores de Caracas ticker symbol (e.g. BVCC, BNC, BPV, RST)",
            },
          ],
          responses: {
            "200": {
              description: "Single BVC ticker details in VES & USD",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
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
            "200": {
              description: "Spot 24h prices, volume and perpetual funding rates",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/crypto/signals": {
        get: {
          summary: `Pre-computed Crypto technical signals (${cfg.prices.cryptoSignals} USDC)`,
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: false,
              schema: { type: "string", example: "BTC" },
              description: "Optional filter by base symbol (e.g. BTC, ETH, SOL)",
            },
            {
              name: "trend",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["bullish", "bearish", "neutral"] },
              description: "Optional filter by EMA trend state",
            },
          ],
          responses: {
            "200": {
              description: "RSI(14) 4h & 1d, EMA 20/50/200, ATR%, 20d S/R, trend & funding status",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
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
              description: "Optional ticker filter (e.g. SPY, NVDA, MELI, NU, PBR)",
            },
            {
              name: "category",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["etf", "latam_etf", "us_equity", "latam_adr"] },
              description: "Optional asset category filter",
            },
          ],
          responses: {
            "200": {
              description: "Delayed / end-of-day quotes for US benchmarks and LatAm ADRs",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/defi/yields": {
        get: {
          summary: `Top DeFi stablecoin yields (${cfg.prices.defiYields} USDC)`,
          parameters: [
            {
              name: "chain",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["Base", "Solana", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BSC"],
              },
              description: "Optional blockchain filter (e.g. Base, Solana, Arbitrum)",
            },
            {
              name: "symbol",
              in: "query",
              required: false,
              schema: { type: "string", example: "USDC" },
              description: "Optional stablecoin symbol substring filter (e.g. USDC, USDT)",
            },
            {
              name: "minTvl",
              in: "query",
              required: false,
              schema: { type: "integer", default: 1000000 },
              description: "Minimum pool TVL in USD",
            },
          ],
          responses: {
            "200": {
              description: "Top stablecoin yield pools sorted by base APY (via DeFiLlama)",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/predictions": {
        get: {
          summary: `Top Polymarket prediction markets (${cfg.prices.predictions} USDC)`,
          parameters: [
            {
              name: "topic",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["all", "crypto", "macro", "latam", "politics", "sports", "other"], default: "all" },
              description: "Optional market topic filter",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 40, default: 20 },
              description: "Maximum number of markets to return",
            },
          ],
          responses: {
            "200": {
              description: "Active liquid Polymarket markets with outcome probabilities and 24h volume",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
      "/api/v1/ecosystem": {
        get: {
          summary: `Unified cross-market ecosystem snapshot (${cfg.prices.ecosystem} USDC)`,
          parameters: [
            {
              name: "sections",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["all", "fx", "latam", "bvc", "crypto", "signals", "nyse", "defi", "predictions", "ratios"],
                default: "all",
              },
              description: "Return full ecosystem ('all') or focus on a specific cross-market section",
            },
          ],
          responses: {
            "200": {
              description:
                "Single JSON combining BCV FX, 8-country LatAm spreads, BVC movers in USD, Crypto & signals, NYSE/LatAm leaders, Base USDC yields, Polymarket & ratios",
              content: { "application/json": { schema: jsonObjectSchema } },
            },
            "402": { description: "Payment Required (x402 Base USDC)" },
          },
        },
      },
    },
  };
}
