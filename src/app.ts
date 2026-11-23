import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
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
      nyse: process.env.PRICE_NYSE || "$0.003",
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
          accepts: {
            scheme: "exact",
            price: cfg.prices.bcv,
            network: cfg.network,
            payTo: cfg.payTo,
          },
          description: "Venezuela BCV official USD/EUR FX, Binance P2P USDT/VES & spread history",
          mimeType: "application/json",
        },
        "GET /api/v1/bvc": {
          accepts: {
            scheme: "exact",
            price: cfg.prices.bvc,
            network: cfg.network,
            payTo: cfg.payTo,
          },
          description: "Bolsa de Valores de Caracas (BVC) equities in VES, USD BCV & USD P2P",
          mimeType: "application/json",
        },
        "GET /api/v1/bvc/[ticker]": {
          accepts: {
            scheme: "exact",
            price: cfg.prices.bvc,
            network: cfg.network,
            payTo: cfg.payTo,
          },
          description: "Single Bolsa de Valores de Caracas ticker in VES, USD BCV & USD P2P",
          mimeType: "application/json",
        },
        "GET /api/v1/crypto": {
          accepts: {
            scheme: "exact",
            price: cfg.prices.crypto,
            network: cfg.network,
            payTo: cfg.payTo,
          },
          description: "Global crypto spot prices, 24h volume & perpetual funding rates",
          mimeType: "application/json",
        },
        "GET /api/v1/nyse": {
          accepts: {
            scheme: "exact",
            price: cfg.prices.nyse,
            network: cfg.network,
            payTo: cfg.payTo,
          },
          description: "NYSE/NASDAQ US benchmarks & LatAm ADRs/ETFs quotes",
          mimeType: "application/json",
        },
        "GET /api/v1/ecosystem": {
          accepts: {
            scheme: "exact",
            price: cfg.prices.ecosystem,
            network: cfg.network,
            payTo: cfg.payTo,
          },
          description: "Unified cross-market snapshot (BCV + BVC + Crypto + NYSE + ratios)",
          mimeType: "application/json",
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
      version: "1.0.0",
      description:
        "Unified LatAm & Global Market Data API (BCV FX, Bolsa de Caracas, Crypto & NYSE) monetized via x402 USDC on Base.",
      protocol: "x402-v2",
      network: cfg.network,
      facilitator: cfg.facilitatorUrl,
      docs: `${origin}/api/docs`,
      health: `${origin}/api/health`,
      pricing: cfg.prices,
    });
  });

  app.get("/api/health", async (c) => {
    const [bcv, bvc, crypto, nyse, eco] = await Promise.all([
      loadMarketData<{ updated_at_utc?: string }>("bcv.json"),
      loadMarketData<{ updated_at_utc?: string }>("bvc.json"),
      loadMarketData<{ updated_at_utc?: string }>("crypto.json"),
      loadMarketData<{ updated_at_utc?: string }>("nyse.json"),
      loadMarketData<{ updated_at_utc?: string }>("ecosystem.json"),
    ]);
    c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return c.json({
      status: "ok",
      service: "latam-x402",
      now_utc: new Date().toISOString(),
      x402: {
        network: cfg.network,
        facilitator: cfg.facilitatorUrl,
        wallet_configured: cfg.payTo !== "0x000000000000000000000000000000000000dEaD",
      },
      feeds: {
        bcv: { source: bcv.source, updated_at_utc: bcv.data?.updated_at_utc ?? null },
        bvc: { source: bvc.source, updated_at_utc: bvc.data?.updated_at_utc ?? null },
        crypto: { source: crypto.source, updated_at_utc: crypto.data?.updated_at_utc ?? null },
        nyse: { source: nyse.source, updated_at_utc: nyse.data?.updated_at_utc ?? null },
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

  app.get("/api/v1/ecosystem", async (c) => {
    c.header("Cache-Control", "no-store");
    const { data } = await loadMarketData<Record<string, unknown>>("ecosystem.json");
    if (!data) return c.json({ error: "Ecosystem snapshot not synced yet" }, 503);

    const section = (c.req.query("sections") || "all").trim().toLowerCase();
    const map: Record<string, string> = {
      fx: "fx_venezuela",
      bvc: "bvc_caracas",
      crypto: "crypto_benchmarks",
      nyse: "nyse_benchmarks",
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
