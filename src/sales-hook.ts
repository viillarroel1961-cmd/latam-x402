import type { MiddlewareHandler } from "hono";
import type { X402RuntimeConfig } from "./openapi.js";

export interface SaleEvent {
  timestamp_utc: string;
  timestamp_vet: string;
  endpoint: string;
  query: string;
  price_usd: string;
  amount_usdc: number;
  network: string;
  tx_hash: string;
  buyer: string;
  status: number;
  latency_ms: number;
  country: string;
  user_agent: string;
}

interface DecodedSettleResponse {
  success?: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  amount?: string;
}

interface DecodedPaymentPayload {
  payload?: {
    authorization?: {
      from?: string;
      value?: string;
    };
  };
}

function decodeBase64Json<T>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  try {
    const normalized = raw.trim().replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function resolveRoutePrice(path: string, cfg: X402RuntimeConfig): string {
  if (path === "/api/v1/bcv") return cfg.prices.bcv;
  if (path === "/api/v1/latam-fx") return cfg.prices.latamFx;
  if (path === "/api/v1/bvc" || path.startsWith("/api/v1/bvc/")) return cfg.prices.bvc;
  if (path === "/api/v1/crypto") return cfg.prices.crypto;
  if (path === "/api/v1/crypto/signals") return cfg.prices.cryptoSignals;
  if (path === "/api/v1/nyse") return cfg.prices.nyse;
  if (path === "/api/v1/defi/yields") return cfg.prices.defiYields;
  if (path === "/api/v1/predictions") return cfg.prices.predictions;
  if (path === "/api/v1/ecosystem") return cfg.prices.ecosystem;
  return "$0";
}

function parseUsdPrice(priceStr: string): number {
  const n = Number(priceStr.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatVetTimestamp(date: Date): string {
  const vet = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  return vet.toISOString().replace("T", " ").slice(0, 19);
}

export function isSalesHookConfigured(): {
  google_sheets: boolean;
  webhook: boolean;
} {
  const google_sheets = Boolean(
    process.env.SALES_SHEET_WEBHOOK_URL?.trim() &&
      process.env.SALES_SHEET_KEY?.trim() &&
      process.env.SALES_SHEET_ID?.trim()
  );
  const webhook = Boolean(process.env.SALES_WEBHOOK_URL?.trim());
  return { google_sheets, webhook };
}

export async function dispatchSaleEvent(sale: SaleEvent): Promise<void> {
  // Structured log always available in Vercel runtime logs
  console.log(JSON.stringify({ event: "x402_sale", ...sale }));

  const tasks: Promise<void>[] = [];

  // Sink 1: Google Sheets via Apps Script bridge
  const sheetUrl = process.env.SALES_SHEET_WEBHOOK_URL?.trim();
  const sheetKey = process.env.SALES_SHEET_KEY?.trim();
  const sheetId = process.env.SALES_SHEET_ID?.trim();
  const sheetName = process.env.SALES_SHEET_NAME?.trim();

  if (sheetUrl && sheetKey && sheetId) {
    tasks.push(
      fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(8500),
        body: JSON.stringify({
          action: "sheet-append",
          key: sheetKey,
          sheetId,
          ...(sheetName ? { sheetName } : {}),
          values: [
            [
              sale.timestamp_utc,
              sale.timestamp_vet,
              sale.endpoint,
              sale.query,
              sale.price_usd.startsWith("$") ? `'${sale.price_usd}` : sale.price_usd,
              sale.amount_usdc,
              sale.network,
              sale.tx_hash,
              sale.buyer,
              sale.status,
              sale.latency_ms,
              sale.country,
              sale.user_agent,
            ],
          ],
        }),
      })
        .then(async (res) => {
          const bodyText = await res.text().catch(() => "");
          if (!res.ok) {
            console.error(`sales-hook sheet HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
          } else if (bodyText.includes('"error"')) {
            console.error(`sales-hook sheet bridge error: ${bodyText.slice(0, 200)}`);
          }
        })
        .catch((err) => {
          console.error("sales-hook sheet error:", err instanceof Error ? err.message : String(err));
        })
    );
  }

  // Sink 2: Optional generic JSON or Discord webhook
  const webhookUrl = process.env.SALES_WEBHOOK_URL?.trim();
  const webhookToken = process.env.SALES_WEBHOOK_TOKEN?.trim();

  if (webhookUrl) {
    const isDiscord = webhookUrl.includes("discord.com/api/webhooks");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhookToken && !isDiscord) {
      headers.Authorization = `Bearer ${webhookToken}`;
    }

    const body = isDiscord
      ? {
          content: `**latam-x402 venta** | \`${sale.endpoint}${sale.query}\` | **${sale.price_usd} USDC** | buyer \`${sale.buyer || "unknown"}\` | tx \`${sale.tx_hash || "n/a"}\``,
        }
      : { event: "x402_sale", ...sale };

    tasks.push(
      fetch(webhookUrl, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (!res.ok) {
            console.error(`sales-hook webhook HTTP ${res.status}`);
          }
        })
        .catch((err) => {
          console.error("sales-hook webhook error:", err instanceof Error ? err.message : String(err));
        })
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

/**
 * Middleware que debe registrarse ANTES de paymentMiddleware en `/api/v1/*`.
 * Registra únicamente llamadas pagas liquidadas (HTTP 2xx + cabecera PAYMENT-RESPONSE).
 */
export function createSalesTrackingMiddleware(cfg: X402RuntimeConfig): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = Date.now();
    await next();

    const status = c.res.status;
    if (status < 200 || status >= 300) {
      return;
    }

    const settleHeader =
      c.res.headers.get("payment-response") || c.res.headers.get("x-payment-response");
    if (!settleHeader) {
      return;
    }

    const settled = decodeBase64Json<DecodedSettleResponse>(settleHeader);
    if (settled && settled.success === false) {
      return;
    }

    const paymentHeader =
      c.req.header("payment-signature") || c.req.header("x-payment");
    const paymentPayload = decodeBase64Json<DecodedPaymentPayload>(paymentHeader);

    const now = new Date();
    const url = new URL(c.req.url);
    const endpoint = c.req.path;
    const priceUsd = resolveRoutePrice(endpoint, cfg);

    const rawAtomic = settled?.amount || paymentPayload?.payload?.authorization?.value;
    const atomicNum = rawAtomic ? Number(rawAtomic) : NaN;
    const amountUsdc =
      Number.isFinite(atomicNum) && atomicNum > 0
        ? Number((atomicNum / 1e6).toFixed(6))
        : parseUsdPrice(priceUsd);

    const sale: SaleEvent = {
      timestamp_utc: now.toISOString(),
      timestamp_vet: formatVetTimestamp(now),
      endpoint,
      query: url.search || "",
      price_usd: priceUsd,
      amount_usdc: amountUsdc,
      network: settled?.network || cfg.network,
      tx_hash: settled?.transaction || "",
      buyer: settled?.payer || paymentPayload?.payload?.authorization?.from || "",
      status,
      latency_ms: Date.now() - startedAt,
      country: c.req.header("x-vercel-ip-country") || "",
      user_agent: (c.req.header("user-agent") || "").slice(0, 160),
    };

    try {
      await dispatchSaleEvent(sale);
    } catch (err) {
      console.error("sales-hook dispatch error:", err instanceof Error ? err.message : String(err));
    }
  };
}
