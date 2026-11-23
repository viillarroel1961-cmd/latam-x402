import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { loadMarketData } from "./data.js";
import {
  buildLlmsTxt,
  buildOpenApiSpec,
  buildWellKnownX402,
  type X402RuntimeConfig,
} from "./openapi.js";

try {
  process.loadEnvFile?.();
} catch {
  // .env opcional (en Vercel las variables vienen del entorno)
}

function normalizeAddress(raw: string | undefined): `0x${string}` {
  const val = (raw || "").trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
    return val as `0x${string}`;
  }
  return "0x000000000000000000000000000000000000dEaD";
}

function normalizeNetwork(raw: string | undefined): `${string}:${string}` {
  const val = (raw || "eip155:84532").trim();
  if (val === "base") return "eip155:8453";
  if (val === "base-sepolia") return "eip155:84532";
  if (val.includes(":")) return val as `${string}:${string}`;
  return "eip155:84532";
}

export function getRuntimeConfig(): X402RuntimeConfig {
  return {
    payTo: normalizeAddress(process.env.PAY_TO_ADDRESS),
    network: normalizeNetwork(process.env.X402_NETWORK),
    facilitatorUrl: (process.env.X402_FACILITATOR_URL || "https://facilitator.payai.network").trim(),
    prices: {
      bcv: process.env.PRICE_BCV || "$0.002",
      bvc: process.env.PRICE_BVC || "$0.005",
      crypto: process.env.PRICE_CRYPTO || "$0.002",
      cryptoSignals: process.env.PRICE_CRYPTO_SIGNALS || "$0.005",
      nyse: process.env.PRICE_NYSE || "$0.003",
      latamFx: process.env.PRICE_LATAM_FX || "$0.005",
      defiYields: process.env.PRICE_DEFI_YIELDS || "$0.005",
      predictions: process.env.PRICE_PREDICTIONS || "$0.005",
      ecosystem: process.env.PRICE_ECOSYSTEM || "$0.01",
    },
  };
}

export function createApp() {
  const app = new Hono();
  const cfg = getRuntimeConfig();

  app.use("*", cors());

  const facilitatorClient = new HTTPFacilitatorClient({
    url: cfg.facilitatorUrl,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    cfg.network,
    new ExactEvmScheme()
  );

  // Middleware x402 v2 solo para rutas pagas /api/v1/*
  app.use(
    "/api/v1/*",
    paymentMiddleware(
      {
        "GET /api/v1/bcv": {
          accepts: { scheme: "exact", price: cfg.prices.bcv, network: cfg.network, payTo: cfg.payTo },
          description: "Venezuela BCV official USD/EUR FX, Binance P2P USDT/VES & spread history",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { days: "30" },
              inputSchema: {
                properties: {
                  days: { type: "string", description: "Number of historical days to return (1-365)" },
                },
              },
              output: {
                example: { market: "BCV_FX_VE", latest: { usd_bcv: 918.77, usdt_p2p_mid: 1090.5, spread_vs_bcv_pct: 18.7 } },
              },
            }),
          },
        },
        "GET /api/v1/latam-fx": {
          accepts: { scheme: "exact", price: cfg.prices.latamFx, network: cfg.network, payTo: cfg.payTo },
          description: "LatAm FX official vs parallel vs Binance USDT P2P across 8 countries",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { country: "AR" },
              inputSchema: {
                properties: {
                  country: { type: "string", description: "Optional ISO country code (VE, AR, CO, BR, MX, CL, PE, BO)" },
                },
              },
              output: {
                example: { market: "LATAM_FX_P2P", count: 8, countries: [{ code: "AR", official_usd: 1600, usdt_p2p_mid: 1767.7, spread_vs_official_pct: 10.48 }] },
              },
            }),
          },
        },
        "GET /api/v1/bvc": {
          accepts: { scheme: "exact", price: cfg.prices.bvc, network: cfg.network, payTo: cfg.payTo },
          description: "Bolsa de Valores de Caracas (BVC) equities in VES, USD BCV & USD P2P",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { onlyPriced: "true" },
              inputSchema: {
                properties: {
                  onlyPriced: { type: "string", description: "Set 'true' to return only tickers with active quotes" },
                },
              },
              output: {
                example: { market: "BVC_CARACAS", coverage: { catalog_total: 38, live_quotes: 31 } },
              },
            }),
          },
        },
        "GET /api/v1/bvc/[ticker]": {
          accepts: { scheme: "exact", price: cfg.prices.bvc, network: cfg.network, payTo: cfg.payTo },
          description: "Single Bolsa de Valores de Caracas ticker in VES, USD BCV & USD P2P",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              pathParams: { ticker: "BVCC" },
              pathParamsSchema: {
                properties: {
                  ticker: { type: "string", description: "BVC ticker symbol (e.g. BVCC, BNC, BPV, RST)" },
                },
                required: ["ticker"],
              },
              output: {
                example: { market: "BVC_CARACAS", stock: { ticker: "BVCC", price_ves: 930, price_usd_bcv: 1.0122, price_usd_p2p: 0.854 } },
              },
            }),
          },
        },
        "GET /api/v1/crypto": {
          accepts: { scheme: "exact", price: cfg.prices.crypto, network: cfg.network, payTo: cfg.payTo },
          description: "Global crypto spot prices, 24h volume & perpetual funding rates",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { symbol: "BTC" },
              inputSchema: {
                properties: {
                  symbol: { type: "string", description: "Optional base symbol filter (e.g. BTC, ETH, SOL)" },
                },
              },
              output: {
                example: { market: "CRYPTO_GLOBAL", count: 12, assets: [{ symbol: "BTCUSDT", price_usd: 60559.67, funding_rate_pct: -0.001 }] },
              },
            }),
          },
        },
        "GET /api/v1/crypto/signals": {
          accepts: { scheme: "exact", price: cfg.prices.cryptoSignals, network: cfg.network, payTo: cfg.payTo },
          description: "Pre-computed crypto technical signals (RSI 14, EMA 20/50/200, ATR%, S/R, funding)",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { symbol: "BTC", trend: "bearish" },
              inputSchema: {
                properties: {
                  symbol: { type: "string", description: "Optional base symbol filter (e.g. BTC, ETH, SOL)" },
                  trend: { type: "string", description: "Optional trend filter (bullish, bearish, neutral)" },
                },
              },
              output: {
                example: { market: "CRYPTO_TECHNICAL_SIGNALS", signals: [{ base: "BTC", rsi_14_1d: 25.63, trend: "bearish" }] },
              },
            }),
          },
        },
        "GET /api/v1/nyse": {
          accepts: { scheme: "exact", price: cfg.prices.nyse, network: cfg.network, payTo: cfg.payTo },
          description: "NYSE/NASDAQ US benchmarks & LatAm ADRs/ETFs quotes",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { category: "latam_adr" },
              inputSchema: {
                properties: {
                  symbol: { type: "string", description: "Optional ticker symbol (e.g. SPY, NVDA, MELI, NU)" },
                  category: { type: "string", description: "Optional category (etf, latam_etf, us_equity, latam_adr)" },
                },
              },
              output: {
                example: { market: "NYSE_US_LATAM", equities: [{ symbol: "MELI", price_usd: 1355, change_pct: -9.15 }] },
              },
            }),
          },
        },
        "GET /api/v1/defi/yields": {
          accepts: { scheme: "exact", price: cfg.prices.defiYields, network: cfg.network, payTo: cfg.payTo },
          description: "Top DeFi stablecoin yields (TVL >= $1M) on Base, Solana, Arbitrum & Ethereum",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { chain: "Base", symbol: "USDC" },
              inputSchema: {
                properties: {
                  chain: { type: "string", description: "Optional chain filter (Base, Solana, Arbitrum, Ethereum)" },
                  symbol: { type: "string", description: "Optional stablecoin filter (USDC, USDT)" },
                  minTvl: { type: "string", description: "Optional minimum TVL in USD" },
                },
              },
              output: {
                example: { market: "DEFI_STABLECOIN_YIELDS", count: 60 },
              },
            }),
          },
        },
        "GET /api/v1/predictions": {
          accepts: { scheme: "exact", price: cfg.prices.predictions, network: cfg.network, payTo: cfg.payTo },
          description: "Most liquid Polymarket prediction markets with live probabilities & 24h volume",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { topic: "crypto", limit: "15" },
              inputSchema: {
                properties: {
                  topic: { type: "string", description: "Topic filter (all, crypto, macro, latam, politics, sports)" },
                  limit: { type: "string", description: "Max markets to return (1-40)" },
                },
              },
              output: {
                example: { market: "PREDICTION_MARKETS_POLYMARKET", count: 40 },
              },
            }),
          },
        },
        "GET /api/v1/ecosystem": {
          accepts: { scheme: "exact", price: cfg.prices.ecosystem, network: cfg.network, payTo: cfg.payTo },
          description: "Unified cross-market snapshot (BCV + LatAm FX + BVC + Crypto + Signals + NYSE + DeFi + Polymarket)",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              input: { sections: "all" },
              inputSchema: {
                properties: {
                  sections: { type: "string", description: "Section filter (all, fx, latam, bvc, crypto, signals, nyse, defi, predictions, ratios)" },
                },
              },
              output: {
                example: { ecosystem: "latam-x402", cross_market_metrics: { venezuela_fx_spread_pct: 18.7, btc_per_spy_ratio: 88.3 } },
              },
            }),
          },
        },
      },
      resourceServer
    )
  );

  // -------------------------------------------------------------------------
  // Rutas gratuitas (descubrimiento para humanos y agentes de IA)
  // -------------------------------------------------------------------------
  app.get("/", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json({
      name: "latam-x402",
      version: "1.1.0",
      description:
        "Unified LatAm & Global Market Data API (BCV & 8-country LatAm FX/P2P, Bolsa de Caracas, Crypto & Signals, NYSE, DeFi Yields & Polymarket) monetized via x402 USDC on Base.",
      protocol: "x402-v2",
      network: cfg.network,
      facilitator: cfg.facilitatorUrl,
      docs: `${origin}/api/docs`,
      openapi: `${origin}/openapi.json`,
      x402Manifest: `${origin}/.well-known/x402.json`,
      llms: `${origin}/llms.txt`,
      health: `${origin}/api/health`,
      pricing: cfg.prices,
    });
  });

  app.get("/api/health", async (c) => {
    const [bcv, latamFx, bvc, crypto, signals, nyse, defi, predictions, eco] = await Promise.all([
      loadMarketData<{ updated_at_utc?: string }>("bcv.json"),
      loadMarketData<{ updated_at_utc?: string }>("latam-fx.json"),
      loadMarketData<{ updated_at_utc?: string }>("bvc.json"),
      loadMarketData<{ updated_at_utc?: string }>("crypto.json"),
      loadMarketData<{ updated_at_utc?: string }>("crypto-signals.json"),
      loadMarketData<{ updated_at_utc?: string }>("nyse.json"),
      loadMarketData<{ updated_at_utc?: string }>("defi-yields.json"),
      loadMarketData<{ updated_at_utc?: string }>("predictions.json"),
      loadMarketData<{ updated_at_utc?: string }>("ecosystem.json"),
    ]);
    c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return c.json({
      status: "ok",
      service: "latam-x402",
      version: "1.1.0",
      now_utc: new Date().toISOString(),
      x402: {
        network: cfg.network,
        facilitator: cfg.facilitatorUrl,
        wallet_configured: cfg.payTo !== "0x000000000000000000000000000000000000dEaD",
      },
      feeds: {
        bcv: { source: bcv.source, updated_at_utc: bcv.data?.updated_at_utc ?? null },
        latam_fx: { source: latamFx.source, updated_at_utc: latamFx.data?.updated_at_utc ?? null },
        bvc: { source: bvc.source, updated_at_utc: bvc.data?.updated_at_utc ?? null },
        crypto: { source: crypto.source, updated_at_utc: crypto.data?.updated_at_utc ?? null },
        crypto_signals: { source: signals.source, updated_at_utc: signals.data?.updated_at_utc ?? null },
        nyse: { source: nyse.source, updated_at_utc: nyse.data?.updated_at_utc ?? null },
        defi_yields: { source: defi.source, updated_at_utc: defi.data?.updated_at_utc ?? null },
        predictions: { source: predictions.source, updated_at_utc: predictions.data?.updated_at_utc ?? null },
        ecosystem: { source: eco.source, updated_at_utc: eco.data?.updated_at_utc ?? null },
      },
    });
  });

  app.get("/api/docs", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json(buildOpenApiSpec(origin, cfg));
  });

  app.get("/api/openapi.json", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json(buildOpenApiSpec(origin, cfg));
  });

  app.get("/openapi.json", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json(buildOpenApiSpec(origin, cfg));
  });

  app.get("/.well-known/x402.json", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json(buildWellKnownX402(origin, cfg));
  });

  app.get("/.well-known/x402", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json(buildWellKnownX402(origin, cfg));
  });

  app.get("/llms.txt", (c) => {
    const origin = new URL(c.req.url).origin;
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.text(buildLlmsTxt(origin, cfg));
  });

  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0B1220"/><circle cx="32" cy="32" r="22" fill="none" stroke="#2563EB" stroke-width="4"/><text x="32" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="18" fill="#38BDF8">402</text></svg>`;

  app.get("/favicon.svg", (c) => {
    c.header("Cache-Control", "public, max-age=86400");
    c.header("Content-Type", "image/svg+xml");
    return c.body(faviconSvg);
  });

  app.get("/favicon.ico", (c) => {
    c.header("Cache-Control", "public, max-age=86400");
    c.header("Content-Type", "image/svg+xml");
    return c.body(faviconSvg);
  });

  // -------------------------------------------------------------------------
  // Rutas pagas (/api/v1/*) protegidas por x402
  // -------------------------------------------------------------------------
  app.get("/api/v1/bcv", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{ history?: unknown[] } & Record<string, unknown>>(
      "bcv.json"
    );
    if (!data) return c.json({ error: "BCV dataset not synced yet" }, 503);

    const daysRaw = Number(c.req.query("days") || "30");
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.floor(daysRaw), 1), 365) : 30;
    const history = Array.isArray(data.history) ? data.history.slice(-days) : [];
    return c.json({ ...data, history });
  });

  app.get("/api/v1/latam-fx", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      countries?: Array<{ code: string; currency: string }>;
    } & Record<string, unknown>>("latam-fx.json");
    if (!data) return c.json({ error: "LatAm FX dataset not synced yet" }, 503);

    const country = (c.req.query("country") || "").trim().toUpperCase();
    const countries = Array.isArray(data.countries)
      ? country
        ? data.countries.filter((x) => x.code === country || x.currency === country)
        : data.countries
      : [];
    return c.json({ ...data, count: countries.length, countries });
  });

  app.get("/api/v1/bvc", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      stocks?: Array<{ price_ves: number | null; ticker: string }>;
    } & Record<string, unknown>>("bvc.json");
    if (!data) return c.json({ error: "BVC dataset not synced yet" }, 503);

    const onlyPriced = c.req.query("onlyPriced") === "true";
    const stocks = Array.isArray(data.stocks)
      ? onlyPriced
        ? data.stocks.filter((s) => s.price_ves !== null)
        : data.stocks
      : [];
    return c.json({ ...data, stocks });
  });

  app.get("/api/v1/bvc/:ticker", async (c) => {
    c.header("Cache-Control", "no-store");
    const ticker = decodeURIComponent(c.req.param("ticker") || "").trim().toUpperCase();
    const { data } = await loadMarketData<{
      updated_at_utc?: string;
      fx_reference?: unknown;
      stocks?: Array<{ ticker: string }>;
    }>("bvc.json");
    if (!data) return c.json({ error: "BVC dataset not synced yet" }, 503);

    const match = (data.stocks || []).find((s) => s.ticker.toUpperCase() === ticker);
    if (!match) {
      return c.json({ error: `Ticker '${ticker}' not found in BVC catalog` }, 404);
    }
    return c.json({
      market: "BVC_CARACAS",
      updated_at_utc: data.updated_at_utc,
      fx_reference: data.fx_reference,
      stock: match,
    });
  });

  app.get("/api/v1/crypto", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      assets?: Array<{ symbol: string; base: string }>;
    } & Record<string, unknown>>("crypto.json");
    if (!data) return c.json({ error: "Crypto dataset not synced yet" }, 503);

    const sym = (c.req.query("symbol") || "").trim().toUpperCase();
    const assets = Array.isArray(data.assets)
      ? sym
        ? data.assets.filter((a) => a.base === sym || a.symbol === sym)
        : data.assets
      : [];
    return c.json({ ...data, count: assets.length, assets });
  });

  app.get("/api/v1/crypto/signals", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      signals?: Array<{ symbol: string; base: string; trend: string }>;
    } & Record<string, unknown>>("crypto-signals.json");
    if (!data) return c.json({ error: "Crypto signals dataset not synced yet" }, 503);

    const sym = (c.req.query("symbol") || "").trim().toUpperCase();
    const trend = (c.req.query("trend") || "").trim().toLowerCase();
    let signals = Array.isArray(data.signals) ? data.signals : [];
    if (sym) signals = signals.filter((s) => s.base === sym || s.symbol === sym);
    if (trend) signals = signals.filter((s) => s.trend?.toLowerCase() === trend);
    return c.json({ ...data, count: signals.length, signals });
  });

  app.get("/api/v1/nyse", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      equities?: Array<{ symbol: string; category: string }>;
    } & Record<string, unknown>>("nyse.json");
    if (!data) return c.json({ error: "NYSE dataset not synced yet" }, 503);

    const sym = (c.req.query("symbol") || "").trim().toUpperCase();
    const category = (c.req.query("category") || "").trim().toLowerCase();
    let equities = Array.isArray(data.equities) ? data.equities : [];
    if (sym) equities = equities.filter((e) => e.symbol.toUpperCase() === sym);
    if (category) equities = equities.filter((e) => e.category.toLowerCase() === category);
    return c.json({ ...data, equities });
  });

  app.get("/api/v1/defi/yields", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      pools?: Array<{ chain: string; symbol: string; tvl_usd: number }>;
    } & Record<string, unknown>>("defi-yields.json");
    if (!data) return c.json({ error: "DeFi yields dataset not synced yet" }, 503);

    const chain = (c.req.query("chain") || "").trim().toLowerCase();
    const symbol = (c.req.query("symbol") || "").trim().toUpperCase();
    const minTvlRaw = Number(c.req.query("minTvl") || "0");
    let pools = Array.isArray(data.pools) ? data.pools : [];
    if (chain) pools = pools.filter((p) => p.chain.toLowerCase() === chain);
    if (symbol) pools = pools.filter((p) => p.symbol.toUpperCase().includes(symbol));
    if (Number.isFinite(minTvlRaw) && minTvlRaw > 0) {
      pools = pools.filter((p) => p.tvl_usd >= minTvlRaw);
    }
    return c.json({ ...data, count: pools.length, pools });
  });

  app.get("/api/v1/predictions", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<{
      markets?: Array<{ topic: string }>;
    } & Record<string, unknown>>("predictions.json");
    if (!data) return c.json({ error: "Predictions dataset not synced yet" }, 503);

    const topic = (c.req.query("topic") || "all").trim().toLowerCase();
    const limitRaw = Number(c.req.query("limit") || "20");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 40) : 20;
    let markets = Array.isArray(data.markets) ? data.markets : [];
    if (topic !== "all") markets = markets.filter((m) => m.topic?.toLowerCase() === topic);
    markets = markets.slice(0, limit);
    return c.json({ ...data, count: markets.length, markets });
  });

  app.get("/api/v1/ecosystem", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<Record<string, unknown>>("ecosystem.json");
    if (!data) return c.json({ error: "Ecosystem snapshot not synced yet" }, 503);

    const section = (c.req.query("sections") || "all").trim().toLowerCase();
    const map: Record<string, string> = {
      fx: "fx_venezuela",
      latam: "latam_fx_spreads",
      bvc: "bvc_caracas",
      crypto: "crypto_benchmarks",
      signals: "crypto_signals_highlights",
      nyse: "nyse_benchmarks",
      defi: "top_base_usdc_yields",
      predictions: "top_predictions",
      ratios: "cross_market_metrics",
    };
    if (section !== "all" && map[section]) {
      return c.json({
        ecosystem: data.ecosystem,
        version: data.version,
        updated_at_utc: data.updated_at_utc,
        [map[section]]: data[map[section]],
      });
    }
    return c.json(data);
  });

  return app;
}

export const app = createApp();
