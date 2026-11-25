import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

export const DEFAULT_API_BASE = "https://latam-x402.vercel.app";

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "get_api_health",
    description:
      "Free health check for latam-x402 API. Returns live status, Base Mainnet x402 config, and UTC freshness timestamps of all 10 financial data feeds.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      title: "API Health & Feed Freshness (Free)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_bcv_fx",
    description:
      "Paid ($0.002 USDC via x402 Base). Venezuela BCV official USD/EUR rates, Binance P2P USDT/VES mid-price, real-time spread %, and daily history.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Number of historical days to include (1-365, default 30)" },
      },
    },
    annotations: {
      title: "Venezuela BCV FX & USDT P2P Spread ($0.002)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_latam_fx",
    description:
      "Paid ($0.005 USDC via x402 Base). Official FX vs parallel/MEP/CCL vs Binance USDT P2P spreads across 8 LatAm countries (VE, AR, CO, BR, MX, CL, PE, BO).",
    inputSchema: {
      type: "object",
      properties: {
        country: {
          type: "string",
          enum: ["VE", "AR", "CO", "BR", "MX", "CL", "PE", "BO"],
          description: "Optional ISO country code filter",
        },
      },
    },
    annotations: {
      title: "LatAm FX & P2P Spreads — 8 Countries ($0.005)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_bvc_equities",
    description:
      "Paid ($0.005 USDC via x402 Base). Bolsa de Valores de Caracas (BVC) 38 Venezuelan equities cross-valued in VES, USD (BCV), and USD (USDT P2P), plus daily turnover.",
    inputSchema: {
      type: "object",
      properties: {
        onlyPriced: {
          type: "boolean",
          description: "If true, return only tickers with active VES/USD quotes",
        },
      },
    },
    annotations: {
      title: "Caracas Stock Exchange (BVC) in VES & USD ($0.005)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_bvc_ticker",
    description:
      "Paid ($0.005 USDC via x402 Base). Single Bolsa de Valores de Caracas equity quote (e.g. BVCC, BNC, BPV, BVL, MVZ.A, RST, TDV.D) in VES, USD BCV, and USD P2P.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "BVC ticker symbol (e.g. BVCC, BNC, BPV, RST)" },
      },
      required: ["ticker"],
    },
    annotations: {
      title: "Single BVC Equity Quote ($0.005)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_crypto_market",
    description:
      "Paid ($0.002 USDC via x402 Base). Global crypto spot 24h prices, range, USD volume, and perpetual funding rates for 12 major assets (BTC, ETH, SOL, BNB, PAXG...).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Optional base symbol filter (e.g. BTC, ETH, SOL)" },
      },
    },
    annotations: {
      title: "Global Crypto Spot & Funding Rates ($0.002)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_crypto_signals",
    description:
      "Paid ($0.005 USDC via x402 Base). Pre-computed crypto technical indicators: RSI(14) 4h & 1d, EMA 20/50/200, ATR%, 20d support/resistance, trend, and funding extremes.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Optional base symbol filter (e.g. BTC, ETH, SOL)" },
        trend: {
          type: "string",
          enum: ["bullish", "bearish", "neutral"],
          description: "Optional EMA trend filter",
        },
      },
    },
    annotations: {
      title: "Pre-computed Crypto Technical Signals ($0.005)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_crypto_liquidity",
    description:
      "Paid ($0.008 USDC via x402 Base). Multi-exchange crypto derivatives liquidity: aggregated liquidation magnet clusters (Binance, Bybit, OKX, Hyperliquid), Open Interest, funding, top trader L/S ratios & squeeze risk signals.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Optional base symbol filter (e.g. BTC, ETH, SOL, BNB)" },
        squeezeRisk: {
          type: "string",
          enum: ["long_squeeze", "short_squeeze", "neutral"],
          description: "Optional squeeze risk regime filter",
        },
      },
    },
    annotations: {
      title: "Crypto Derivatives Liquidity & Squeeze Magnets ($0.008)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_nyse_equities",
    description:
      "Paid ($0.003 USDC via x402 Base). NYSE/NASDAQ US benchmarks (SPY, QQQ, GLD, AAPL, NVDA...) and LatAm ADRs/ETFs (ILF, MELI, NU, PBR, VALE, EC, YPF).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Optional ticker filter (e.g. SPY, MELI, NU)" },
        category: {
          type: "string",
          enum: ["etf", "latam_etf", "us_equity", "latam_adr"],
          description: "Optional category filter",
        },
      },
    },
    annotations: {
      title: "NYSE & LatAm ADRs / ETFs ($0.003)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_defi_yields",
    description:
      "Paid ($0.005 USDC via x402 Base). Top 60 DeFi stablecoin yield pools (TVL >= $1M) across Base, Solana, Arbitrum, Ethereum, Optimism, Polygon & BSC via DeFiLlama.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["Base", "Solana", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BSC"],
          description: "Optional blockchain filter",
        },
        symbol: { type: "string", description: "Optional stablecoin filter (e.g. USDC, USDT)" },
        minTvl: { type: "integer", description: "Optional minimum TVL in USD (default 1000000)" },
      },
    },
    annotations: {
      title: "DeFi Stablecoin Yields ($0.005)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_polymarket_predictions",
    description:
      "Paid ($0.005 USDC via x402 Base). Top 40 most liquid Polymarket prediction markets with live outcome probabilities, 24h USD volume, and topic filter.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["all", "crypto", "macro", "latam", "politics", "sports", "other"],
          description: "Optional topic filter (default 'all')",
        },
        limit: { type: "integer", description: "Max markets to return (1-40, default 20)" },
      },
    },
    annotations: {
      title: "Polymarket Prediction Markets ($0.005)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_unified_ecosystem",
    description:
      "Paid ($0.01 USDC via x402 Base). All-in-one cross-market JSON combining Venezuela BCV, 8-country LatAm spreads, BVC movers in USD, Crypto & signals, NYSE/LatAm leaders, Base USDC yields, Polymarket & cross-market ratios.",
    inputSchema: {
      type: "object",
      properties: {
        sections: {
          type: "string",
          enum: ["all", "fx", "latam", "bvc", "crypto", "signals", "nyse", "defi", "predictions", "ratios"],
          description: "Return full ecosystem ('all') or a specific section",
        },
      },
    },
    annotations: {
      title: "Unified Cross-Market Ecosystem ($0.01)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

function buildEndpointUrl(baseUrl: string, toolName: string, args: Record<string, unknown>): string | null {
  const base = baseUrl.replace(/\/+$/, "");
  const qs = new URLSearchParams();
  const addParam = (key: string, val: unknown) => {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      qs.set(key, String(val));
    }
  };
  const suffix = () => {
    const str = qs.toString();
    return str ? `?${str}` : "";
  };

  switch (toolName) {
    case "get_api_health":
      return `${base}/api/health`;
    case "get_bcv_fx":
      addParam("days", args.days);
      return `${base}/api/v1/bcv${suffix()}`;
    case "get_latam_fx":
      addParam("country", args.country);
      return `${base}/api/v1/latam-fx${suffix()}`;
    case "get_bvc_equities":
      if (args.onlyPriced !== undefined) addParam("onlyPriced", Boolean(args.onlyPriced));
      return `${base}/api/v1/bvc${suffix()}`;
    case "get_bvc_ticker": {
      const ticker = String(args.ticker || "BVCC").trim().toUpperCase();
      return `${base}/api/v1/bvc/${encodeURIComponent(ticker)}`;
    }
    case "get_crypto_market":
      addParam("symbol", args.symbol);
      return `${base}/api/v1/crypto${suffix()}`;
    case "get_crypto_signals":
      addParam("symbol", args.symbol);
      addParam("trend", args.trend);
      return `${base}/api/v1/crypto/signals${suffix()}`;
    case "get_crypto_liquidity":
      addParam("symbol", args.symbol);
      addParam("squeezeRisk", args.squeezeRisk);
      return `${base}/api/v1/liquidity${suffix()}`;
    case "get_nyse_equities":
      addParam("symbol", args.symbol);
      addParam("category", args.category);
      return `${base}/api/v1/nyse${suffix()}`;
    case "get_defi_yields":
      addParam("chain", args.chain);
      addParam("symbol", args.symbol);
      addParam("minTvl", args.minTvl);
      return `${base}/api/v1/defi/yields${suffix()}`;
    case "get_polymarket_predictions":
      addParam("topic", args.topic);
      addParam("limit", args.limit);
      return `${base}/api/v1/predictions${suffix()}`;
    case "get_unified_ecosystem":
      addParam("sections", args.sections);
      return `${base}/api/v1/ecosystem${suffix()}`;
    default:
      return null;
  }
}

export interface McpExecutionOptions {
  apiBaseUrl?: string;
  buyerPrivateKey?: string;
  paymentSignatureHeader?: string;
}

export async function callLatamX402Tool(
  toolName: string,
  args: Record<string, unknown>,
  opts: McpExecutionOptions = {}
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const apiBase = opts.apiBaseUrl || process.env.LATAM_X402_URL || DEFAULT_API_BASE;
  const url = buildEndpointUrl(apiBase, toolName, args || {});
  if (!url) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    };
  }

  try {
    const initialHeaders: Record<string, string> = { Accept: "application/json" };
    if (opts.paymentSignatureHeader) {
      initialHeaders["PAYMENT-SIGNATURE"] = opts.paymentSignatureHeader;
    }

    const res1 = await fetch(url, { headers: initialHeaders });
    if (res1.ok) {
      const text = await res1.text();
      return { content: [{ type: "text", text }] };
    }

    if (res1.status === 402) {
      const pk = (opts.buyerPrivateKey || process.env.EVM_PRIVATE_KEY || "").trim();
      const prRaw = res1.headers.get("payment-required");
      let decodedPr: unknown = null;
      if (prRaw) {
        try {
          decodedPr = JSON.parse(Buffer.from(prRaw, "base64").toString("utf8"));
        } catch {
          decodedPr = prRaw;
        }
      }

      if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: 402,
                  message:
                    "This endpoint requires an x402 v2 Base USDC micropayment. Configure EVM_PRIVATE_KEY in your MCP client environment (or call the HTTP endpoint directly with an x402-enabled wallet).",
                  endpoint: url,
                  paymentRequired: decodedPr,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const buyer = privateKeyToAccount(pk as `0x${string}`);
      const client = new x402Client();
      registerExactEvmScheme(client, { signer: buyer });
      const httpClient = new x402HTTPClient(client);

      const paymentRequired = httpClient.getPaymentRequiredResponse((h) => res1.headers.get(h));
      const payload = await httpClient.createPaymentPayload(paymentRequired);
      const payHeaders = httpClient.encodePaymentSignatureHeader(payload);

      const res2 = await fetch(url, { headers: { Accept: "application/json", ...payHeaders } });
      const body2 = await res2.text();
      if (!res2.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `x402 payment attempt returned HTTP ${res2.status}: ${body2}`,
            },
          ],
        };
      }
      return { content: [{ type: "text", text: body2 }] };
    }

    const errText = await res1.text();
    return {
      isError: true,
      content: [{ type: "text", text: `Upstream HTTP ${res1.status}: ${errText}` }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Failed calling ${url}: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
}

export async function handleMcpJsonRpc(
  msg: Record<string, unknown>,
  opts: McpExecutionOptions = {}
): Promise<Record<string, unknown> | null> {
  const id = msg.id ?? null;
  const method = String(msg.method || "");
  const params = (msg.params && typeof msg.params === "object"
    ? msg.params
    : {}) as Record<string, unknown>;

  // Notifications (no id) require no response
  if (method === "notifications/initialized" || method.startsWith("notifications/")) {
    return null;
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "initialize") {
    const clientVersion =
      typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-03-26";
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: clientVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: "latam-x402-mcp",
          version: "1.2.0",
        },
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
  }

  if (method === "resources/list") {
    return { jsonrpc: "2.0", id, result: { resources: [] } };
  }

  if (method === "prompts/list") {
    return { jsonrpc: "2.0", id, result: { prompts: [] } };
  }

  if (method === "tools/call") {
    const toolName = String(params.name || "");
    const toolArgs = (params.arguments && typeof params.arguments === "object"
      ? params.arguments
      : {}) as Record<string, unknown>;
    const result = await callLatamX402Tool(toolName, toolArgs, opts);
    return { jsonrpc: "2.0", id, result };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}
