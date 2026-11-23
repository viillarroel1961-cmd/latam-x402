#!/usr/bin/env node
/**
 * Sincronizador de datos unificados para latam-x402:
 *  1. BCV oficial (USD/EUR) + Binance P2P USDT/VES + brecha %
 *  2. Bolsa de Valores de Caracas (BVC) valuada en VES, USD BCV y USD P2P
 *  3. Cripto (spot 24h + funding rates via Binance publico / OKX fallback)
 *  4. NYSE / LatAm ADRs & ETFs (Yahoo Finance / Stooq fallback)
 *  5. Snapshot unificado ecosystem.json
 *
 * Sin dependencias externas (Node >= 20 con fetch nativo).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BVC_CATALOG = [
  { ticker: "ABC.A", nombre: "Banco del Caribe (A)" },
  { ticker: "ALZ.B", nombre: "Alalza Inversiones (B)" },
  { ticker: "ARC.A", nombre: "Arca Inmuebles y Valores (A)" },
  { ticker: "ARC.B", nombre: "Arca Inmuebles y Valores (B)" },
  { ticker: "BNC", nombre: "Banco Nacional de Credito" },
  { ticker: "BPV", nombre: "Banco Provincial" },
  { ticker: "BVCC", nombre: "Bolsa de Valores de Caracas" },
  { ticker: "BVL", nombre: "Banco de Venezuela" },
  { ticker: "CCP.B", nombre: "Clabe Capital (B)" },
  { ticker: "CCR", nombre: "Ceramica Carabobo" },
  { ticker: "CGQ", nombre: "Corp. Grupo Quimico" },
  { ticker: "CRM.A", nombre: "Corimon (A)" },
  { ticker: "DOM", nombre: "Dominguez & Cia" },
  { ticker: "EFE", nombre: "Productos EFE" },
  { ticker: "ENV", nombre: "Envases Venezolanos" },
  { ticker: "FFV.A", nombre: "Fivenca Fondo Capital Privado (A)" },
  { ticker: "FFV.B", nombre: "Fivenca Fondo Capital Privado (B)" },
  { ticker: "FNC", nombre: "Fabrica Nacional de Cementos" },
  { ticker: "FNV", nombre: "Fabrica Nacional de Vidrio" },
  { ticker: "GMC.B", nombre: "Grupo Mantra Corp. (B)" },
  { ticker: "GZL", nombre: "Grupo Zuliano" },
  { ticker: "ICP.B", nombre: "Inversiones Crecepymes (B)" },
  { ticker: "IMP.B", nombre: "Impulsa Venture Capital (B)" },
  { ticker: "IVC.A", nombre: "Invaca Inmuebles (A)" },
  { ticker: "IVC.B", nombre: "Invaca Inmuebles (B)" },
  { ticker: "MPA", nombre: "Manufacturas de Papel" },
  { ticker: "MTC.B", nombre: "Montesco Capital Global (B)" },
  { ticker: "MVZ.A", nombre: "Mercantil Servicios (A)" },
  { ticker: "MVZ.B", nombre: "Mercantil Servicios (B)" },
  { ticker: "PCP.B", nombre: "Fondo Petrolia (B)" },
  { ticker: "PGR", nombre: "Proagro" },
  { ticker: "PTN", nombre: "Protinal" },
  { ticker: "RFM", nombre: "Rendivalores Fondo Mutual" },
  { ticker: "RST", nombre: "Ron Santa Teresa" },
  { ticker: "RST.B", nombre: "Ron Santa Teresa (B)" },
  { ticker: "SVS", nombre: "Sivensa" },
  { ticker: "TDV.D", nombre: "CANTV (D)" },
  { ticker: "TPG", nombre: "Telares de Palo Grande" },
];

const CRYPTO_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "DOGEUSDT",
  "LINKUSDT",
  "TRXUSDT",
  "TONUSDT",
  "PAXGUSDT",
];

const NYSE_TICKERS = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "etf" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", category: "etf" },
  { symbol: "DIA", name: "SPDR Dow Jones ETF", category: "etf" },
  { symbol: "GLD", name: "SPDR Gold Shares", category: "etf" },
  { symbol: "USO", name: "United States Oil Fund", category: "etf" },
  { symbol: "ILF", name: "iShares Latin America 40 ETF", category: "latam_etf" },
  { symbol: "AAPL", name: "Apple Inc.", category: "us_equity" },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "us_equity" },
  { symbol: "NVDA", name: "NVIDIA Corp.", category: "us_equity" },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "us_equity" },
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "us_equity" },
  { symbol: "META", name: "Meta Platforms Inc.", category: "us_equity" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "us_equity" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", category: "us_equity" },
  { symbol: "MELI", name: "MercadoLibre Inc.", category: "latam_adr" },
  { symbol: "NU", name: "Nu Holdings Ltd.", category: "latam_adr" },
  { symbol: "PBR", name: "Petroleo Brasileiro (Petrobras)", category: "latam_adr" },
  { symbol: "VALE", name: "Vale S.A.", category: "latam_adr" },
  { symbol: "EC", name: "Ecopetrol S.A.", category: "latam_adr" },
  { symbol: "YPF", name: "YPF S.A.", category: "latam_adr" },
];

function readJsonSafe(filename, fallback) {
  const full = path.join(DATA_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filename, obj) {
  const full = path.join(DATA_DIR, filename);
  fs.writeFileSync(full, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function round(n, decimals = 4) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html, text/plain, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseLocaleNumber(str) {
  if (str == null) return null;
  const clean = String(str).replace(/[^\d.,-]/g, "").trim();
  if (!clean) return null;
  // Si tiene punto y coma, decide cual es decimal por la ultima aparicion
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;
  if (lastComma > lastDot) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = clean.replace(/,/g, "");
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

// ---------------------------------------------------------------------------
// 1. BCV + USDT P2P Venezuela
// ---------------------------------------------------------------------------
async function syncBcv(nowIso) {
  const prev = readJsonSafe("bcv.json", { history: [] });
  const today = nowIso.slice(0, 10);

  let usdOficial = null;
  let eurOficial = null;
  let dolarParalelo = null;
  let usdtP2pBuy = null;
  let usdtP2pSell = null;
  const sources = [];

  try {
    const dolares = await fetchJson("https://ve.dolarapi.com/v1/dolares");
    if (Array.isArray(dolares)) {
      const of = dolares.find((d) => d.fuente === "oficial");
      const par = dolares.find((d) => d.fuente === "paralelo");
      if (of?.promedio > 0) {
        usdOficial = round(Number(of.promedio), 4);
        sources.push("ve.dolarapi.com/dolares");
      }
      if (par?.promedio > 0) {
        dolarParalelo = round(Number(par.promedio), 4);
      }
    }
  } catch (err) {
    console.warn("[BCV] dolares error:", err.message);
  }

  try {
    const eur = await fetchJson("https://ve.dolarapi.com/v1/euros/oficial");
    if (eur?.promedio > 0) {
      eurOficial = round(Number(eur.promedio), 4);
      sources.push("ve.dolarapi.com/euros");
    }
  } catch (err) {
    console.warn("[BCV] euros error:", err.message);
  }

  // Binance P2P USDT/VES (top 5 anuncios)
  for (const tradeType of ["BUY", "SELL"]) {
    try {
      const p2p = await fetchJson(
        "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset: "USDT",
            fiat: "VES",
            tradeType,
            page: 1,
            rows: 10,
            payTypes: [],
            publisherType: null,
          }),
        }
      );
      const prices = (p2p?.data || [])
        .map((item) => Number(item?.adv?.price))
        .filter((p) => Number.isFinite(p) && p > 0)
        .slice(0, 5);
      if (prices.length > 0) {
        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        if (tradeType === "BUY") usdtP2pBuy = round(median, 4);
        else usdtP2pSell = round(median, 4);
      }
    } catch (err) {
      console.warn(`[BCV] Binance P2P ${tradeType} error:`, err.message);
    }
  }
  if (usdtP2pBuy || usdtP2pSell) sources.push("binance-p2p-ves");

  // Conservar valores previos si hubo caida parcial
  usdOficial = usdOficial ?? prev?.latest?.usd_bcv ?? null;
  eurOficial = eurOficial ?? prev?.latest?.eur_bcv ?? null;
  dolarParalelo = dolarParalelo ?? prev?.latest?.usd_paralelo ?? null;
  usdtP2pBuy = usdtP2pBuy ?? prev?.latest?.usdt_p2p_buy ?? null;
  usdtP2pSell = usdtP2pSell ?? prev?.latest?.usdt_p2p_sell ?? null;

  const p2pMid =
    usdtP2pBuy && usdtP2pSell
      ? round((usdtP2pBuy + usdtP2pSell) / 2, 4)
      : usdtP2pBuy ?? usdtP2pSell ?? dolarParalelo;

  const spreadPct =
    usdOficial && p2pMid ? round(((p2pMid - usdOficial) / usdOficial) * 100, 2) : null;

  const latest = {
    date: today,
    usd_bcv: usdOficial,
    eur_bcv: eurOficial,
    usd_paralelo: dolarParalelo,
    usdt_p2p_buy: usdtP2pBuy,
    usdt_p2p_sell: usdtP2pSell,
    usdt_p2p_mid: p2pMid,
    spread_vs_bcv_pct: spreadPct,
    eur_usd_implied: usdOficial && eurOficial ? round(eurOficial / usdOficial, 4) : null,
  };

  const history = Array.isArray(prev.history) ? [...prev.history] : [];
  if (usdOficial) {
    const idx = history.findIndex((h) => h.date === today);
    const point = {
      date: today,
      usd_bcv: usdOficial,
      eur_bcv: eurOficial,
      usdt_p2p_mid: p2pMid,
      spread_vs_bcv_pct: spreadPct,
    };
    if (idx >= 0) history[idx] = point;
    else history.push(point);
    history.sort((a, b) => a.date.localeCompare(b.date));
  }

  const out = {
    market: "BCV_FX_VE",
    updated_at_utc: nowIso,
    sources: sources.length ? sources : prev.sources || [],
    latest,
    history: history.slice(-365),
  };
  writeJson("bcv.json", out);
  console.log(
    `[BCV] OK usd_bcv=${latest.usd_bcv} eur_bcv=${latest.eur_bcv} usdt_p2p=${latest.usdt_p2p_mid} spread=${latest.spread_vs_bcv_pct}%`
  );
  return out;
}

// ---------------------------------------------------------------------------
// 2. Bolsa de Valores de Caracas (BVC)
// ---------------------------------------------------------------------------
function extractBvcFromHtml(html) {
  const quotes = new Map();
  let marketSummary = null;
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const knownTickers = new Set(BVC_CATALOG.map((c) => c.ticker));

  for (let i = 0; i < trMatches.length; i++) {
    const tr = trMatches[i];
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    );

    // Captura resumen general de renta variable (fila siguiente a "Operaciones | titulos negociados | monto en efectivo")
    if (
      !marketSummary &&
      cells[0]?.toLowerCase() === "operaciones" &&
      cells[1]?.toLowerCase().includes("negociados") &&
      trMatches[i + 1]
    ) {
      const nextCells = [...trMatches[i + 1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (m) => m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()
      );
      if (nextCells.length >= 3) {
        const parseIntEs = (s) => {
          const digits = String(s || "").replace(/\D/g, "");
          return digits ? Number(digits) : null;
        };
        marketSummary = {
          trades_count: parseIntEs(nextCells[0]),
          shares_traded: parseIntEs(nextCells[1]),
          turnover_ves: parseLocaleNumber(nextCells[2]),
          as_of_time: nextCells[4] || null,
        };
      }
      continue;
    }

    if (cells.length < 3) continue;
    const tickerIdx = cells.findIndex((c) => knownTickers.has(c.toUpperCase()));
    if (tickerIdx < 0) continue;

    // Formato BVC resumen-mercado: ['', ticker, price_ves, change_abs, volume, turnover_ves, time]
    const ticker = cells[tickerIdx].toUpperCase();
    const price = parseLocaleNumber(cells[tickerIdx + 1]);
    const changeAbs = parseLocaleNumber(cells[tickerIdx + 2]);
    const volume = parseLocaleNumber(cells[tickerIdx + 3]);
    const turnoverVes = parseLocaleNumber(cells[tickerIdx + 4]);
    const lastTime = cells[tickerIdx + 5] && /\d{2}:\d{2}/.test(cells[tickerIdx + 5])
      ? cells[tickerIdx + 5]
      : null;

    if (price !== null && price > 0) {
      const prevClose = changeAbs !== null ? price - changeAbs : null;
      const changePct =
        prevClose && prevClose > 0 && changeAbs !== null
          ? round((changeAbs / prevClose) * 100, 2)
          : null;
      quotes.set(ticker, {
        price_ves: round(price, 4),
        change_abs_ves: changeAbs !== null ? round(changeAbs, 4) : null,
        change_pct: changePct,
        volume_shares: volume !== null ? Math.round(volume) : null,
        turnover_ves: turnoverVes !== null ? round(turnoverVes, 2) : null,
        last_trade_time: lastTime,
      });
    }
  }
  return { quotes, marketSummary };
}

async function syncBvc(nowIso, bcvData) {
  const prev = readJsonSafe("bvc.json", { stocks: [], index: null, market_summary: null });
  const prevMap = new Map((prev.stocks || []).map((s) => [s.ticker, s]));
  const usdBcv = bcvData?.latest?.usd_bcv || null;
  const usdtP2p = bcvData?.latest?.usdt_p2p_mid || null;

  let scrapedQuotes = new Map();
  let marketSummary = prev.market_summary || null;
  let indexIbc = prev.index || null;
  const sources = [];

  const candidateUrls = [
    "https://www.bolsadecaracas.com/resumen-mercado/",
    "https://www.bolsadecaracas.com/",
  ];

  for (const url of candidateUrls) {
    try {
      const html = await fetchText(url, 15000);
      const parsed = extractBvcFromHtml(html);
      if (parsed.marketSummary && !marketSummary) {
        marketSummary = parsed.marketSummary;
      } else if (parsed.marketSummary) {
        marketSummary = parsed.marketSummary;
      }
      if (parsed.quotes.size > scrapedQuotes.size) {
        scrapedQuotes = parsed.quotes;
        sources.push(url);
      }
      if (scrapedQuotes.size >= 5) break;
    } catch (err) {
      console.warn(`[BVC] ${url} error:`, err.message);
    }
  }

  // Respaldo parcial BVCC via Yahoo Finance si no hubo tabla
  if (!scrapedQuotes.has("BVCC")) {
    try {
      const yf = await fetchJson(
        "https://query1.finance.yahoo.com/v8/finance/chart/BVCC.CR?interval=1d&range=5d",
        {},
        10000
      );
      const meta = yf?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice > 0) {
        const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
        const chg = prevClose ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100 : 0;
        scrapedQuotes.set("BVCC", {
          price_ves: round(meta.regularMarketPrice, 4),
          change_abs_ves: round(meta.regularMarketPrice - prevClose, 4),
          change_pct: round(chg, 2),
          volume_shares: null,
          turnover_ves: null,
          last_trade_time: null,
        });
        sources.push("yahoo-finance:BVCC.CR");
      }
    } catch {
      // ignorar si Yahoo no devuelve BVCC.CR
    }
  }

  const stocks = BVC_CATALOG.map((item) => {
    const live = scrapedQuotes.get(item.ticker);
    const old = prevMap.get(item.ticker);
    const priceVes = live?.price_ves ?? old?.price_ves ?? null;
    const changeAbs = live?.change_abs_ves ?? old?.change_abs_ves ?? null;
    const changePct = live?.change_pct ?? old?.change_pct ?? null;
    const volumeShares = live?.volume_shares ?? old?.volume_shares ?? null;
    const turnoverVes = live?.turnover_ves ?? old?.turnover_ves ?? null;
    const lastTradeTime = live?.last_trade_time ?? old?.last_trade_time ?? null;
    return {
      ticker: item.ticker,
      name: item.nombre,
      price_ves: priceVes,
      change_abs_ves: changeAbs,
      change_pct: changePct,
      volume_shares: volumeShares,
      turnover_ves: turnoverVes,
      turnover_usd_bcv: turnoverVes && usdBcv ? round(turnoverVes / usdBcv, 2) : null,
      price_usd_bcv: priceVes && usdBcv ? round(priceVes / usdBcv, 6) : null,
      price_usd_p2p: priceVes && usdtP2p ? round(priceVes / usdtP2p, 6) : null,
      last_trade_time: lastTradeTime,
      status: live ? "live" : old?.price_ves ? "cached" : "catalog_only",
    };
  });

  if (marketSummary && marketSummary.turnover_ves && usdBcv) {
    marketSummary = {
      ...marketSummary,
      turnover_usd_bcv: round(marketSummary.turnover_ves / usdBcv, 2),
      turnover_usd_p2p: usdtP2p ? round(marketSummary.turnover_ves / usdtP2p, 2) : null,
    };
  }

  const liveCount = stocks.filter((s) => s.status === "live").length;
  const pricedCount = stocks.filter((s) => s.price_ves !== null).length;

  const out = {
    market: "BVC_CARACAS",
    updated_at_utc: nowIso,
    sources: sources.length ? sources : prev.sources || ["catalog-bvc"],
    fx_reference: { usd_bcv: usdBcv, usdt_p2p_mid: usdtP2p },
    market_summary: marketSummary,
    index: indexIbc,
    coverage: {
      catalog_total: stocks.length,
      live_quotes: liveCount,
      priced_total: pricedCount,
    },
    stocks,
  };
  writeJson("bvc.json", out);
  console.log(`[BVC] OK live=${liveCount}/${stocks.length} priced=${pricedCount}`);
  return out;
}

// ---------------------------------------------------------------------------
// 3. Cripto (Binance publico + funding rates)
// ---------------------------------------------------------------------------
async function syncCrypto(nowIso) {
  const prev = readJsonSafe("crypto.json", { assets: [] });
  const symbolsParam = encodeURIComponent(JSON.stringify(CRYPTO_SYMBOLS));
  let tickers = [];
  let spotSource = null;

  for (const base of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try {
      const data = await fetchJson(`${base}/api/v3/ticker/24hr?symbols=${symbolsParam}`);
      if (Array.isArray(data) && data.length > 0) {
        tickers = data;
        spotSource = `${base}/api/v3/ticker/24hr`;
        break;
      }
    } catch (err) {
      console.warn(`[CRYPTO] spot ${base} error:`, err.message);
    }
  }

  const fundingMap = new Map();
  let fundingSource = null;
  try {
    const prem = await fetchJson("https://fapi.binance.com/fapi/v1/premiumIndex");
    if (Array.isArray(prem)) {
      for (const item of prem) {
        if (CRYPTO_SYMBOLS.includes(item.symbol)) {
          fundingMap.set(item.symbol, {
            funding_rate: round(Number(item.lastFundingRate), 6),
            funding_rate_pct: round(Number(item.lastFundingRate) * 100, 4),
            mark_price: round(Number(item.markPrice), 4),
          });
        }
      }
      if (fundingMap.size > 0) fundingSource = "fapi.binance.com/premiumIndex";
    }
  } catch (err) {
    console.warn("[CRYPTO] Binance funding fallback to OKX:", err.message);
    // Fallback OKX public funding para los pares principales
    for (const sym of ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"]) {
      try {
        const res = await fetchJson(
          `https://www.okx.com/api/v5/public/funding-rate?instId=${sym}-USDT-SWAP`,
          {},
          8000
        );
        const rate = Number(res?.data?.[0]?.fundingRate);
        if (Number.isFinite(rate)) {
          fundingMap.set(`${sym}USDT`, {
            funding_rate: round(rate, 6),
            funding_rate_pct: round(rate * 100, 4),
            mark_price: null,
          });
          fundingSource = "okx.com/public/funding-rate";
        }
      } catch {
        // continuar
      }
    }
  }

  const assets = tickers.length
    ? tickers.map((t) => {
        const f = fundingMap.get(t.symbol);
        return {
          symbol: t.symbol,
          base: t.symbol.replace(/USDT$/, ""),
          price_usd: round(Number(t.lastPrice), 6),
          change_24h_pct: round(Number(t.priceChangePercent), 2),
          high_24h: round(Number(t.highPrice), 6),
          low_24h: round(Number(t.lowPrice), 6),
          quote_volume_24h_usd: round(Number(t.quoteVolume), 2),
          funding_rate: f?.funding_rate ?? null,
          funding_rate_pct: f?.funding_rate_pct ?? null,
        };
      })
    : prev.assets || [];

  const out = {
    market: "CRYPTO_GLOBAL",
    updated_at_utc: nowIso,
    sources: [spotSource, fundingSource].filter(Boolean),
    count: assets.length,
    assets,
  };
  writeJson("crypto.json", out);
  console.log(`[CRYPTO] OK count=${assets.length} funding=${fundingMap.size}`);
  return out;
}

// ---------------------------------------------------------------------------
// 4. NYSE / US & LatAm Equities (Yahoo Finance + Stooq fallback)
// ---------------------------------------------------------------------------
async function fetchNyseTicker(metaInfo) {
  const { symbol, name, category } = metaInfo;
  // 1) Yahoo Finance v8 chart API (sin clave, ~15 min diferido o cierre)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=5d`;
    const json = await fetchJson(url, {}, 12000);
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (Number.isFinite(price) && price > 0) {
      const prevClose = Number(meta?.chartPreviousClose || meta?.previousClose || price);
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const vols = result?.indicators?.quote?.[0]?.volume || [];
      const lastVol = [...vols].reverse().find((v) => typeof v === "number" && v > 0) ?? null;
      return {
        symbol,
        name,
        category,
        exchange: meta?.fullExchangeName || meta?.exchangeName || "NYSE/NASDAQ",
        currency: meta?.currency || "USD",
        price_usd: round(price, 4),
        prev_close_usd: round(prevClose, 4),
        change_pct: round(changePct, 2),
        volume: lastVol,
        source: "yahoo-finance",
      };
    }
  } catch {
    // intentar Stooq
  }

  // 2) Fallback Stooq CSV
  try {
    const stooqSym = symbol.toLowerCase().replace("-", ".") + ".us";
    const csv = await fetchText(
      `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`,
      12000
    );
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length >= 2) {
      const parts = lines[1].split(",");
      const open = Number(parts[3]);
      const close = Number(parts[6]);
      const vol = Number(parts[7]);
      if (Number.isFinite(close) && close > 0) {
        const changePct = Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null;
        return {
          symbol,
          name,
          category,
          exchange: "US",
          currency: "USD",
          price_usd: round(close, 4),
          prev_close_usd: Number.isFinite(open) ? round(open, 4) : null,
          change_pct: round(changePct, 2),
          volume: Number.isFinite(vol) ? vol : null,
          source: "stooq",
        };
      }
    }
  } catch {
    // sin datos
  }
  return null;
}

async function syncNyse(nowIso) {
  const prev = readJsonSafe("nyse.json", { equities: [] });
  const prevMap = new Map((prev.equities || []).map((e) => [e.symbol, e]));

  const results = await Promise.all(NYSE_TICKERS.map((t) => fetchNyseTicker(t)));
  const equities = NYSE_TICKERS.map((meta, idx) => {
    const live = results[idx];
    if (live) return live;
    return prevMap.get(meta.symbol) || { ...meta, price_usd: null, change_pct: null, source: "unavailable" };
  });

  const liveCount = results.filter(Boolean).length;
  const out = {
    market: "NYSE_US_LATAM",
    updated_at_utc: nowIso,
    delay_notice: "Standard delayed / end-of-day quotes (~15 min)",
    coverage: { total: equities.length, live: liveCount },
    equities,
  };
  writeJson("nyse.json", out);
  console.log(`[NYSE] OK live=${liveCount}/${equities.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// 5. LatAm FX & USDT P2P Spreads (VE, AR, CO, BR, MX, CL, PE, BO)
// ---------------------------------------------------------------------------
const LATAM_COUNTRIES = [
  { code: "VE", name: "Venezuela", currency: "VES" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "PE", name: "Peru", currency: "PEN" },
  { code: "BO", name: "Bolivia", currency: "BOB" },
];

async function fetchBinanceP2pMid(fiat) {
  let buy = null;
  let sell = null;
  for (const tradeType of ["BUY", "SELL"]) {
    try {
      const p2p = await fetchJson(
        "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset: "USDT",
            fiat,
            tradeType,
            page: 1,
            rows: 10,
            payTypes: [],
            publisherType: null,
          }),
        },
        12000
      );
      const prices = (p2p?.data || [])
        .map((item) => Number(item?.adv?.price))
        .filter((p) => Number.isFinite(p) && p > 0)
        .slice(0, 5);
      if (prices.length > 0) {
        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        if (tradeType === "BUY") buy = round(median, 4);
        else sell = round(median, 4);
      }
    } catch {
      // continuar
    }
  }
  const mid = buy && sell ? round((buy + sell) / 2, 4) : buy ?? sell;
  return { buy, sell, mid };
}

async function syncLatamFx(nowIso, bcvData) {
  const prev = readJsonSafe("latam-fx.json", { countries: [] });
  const prevMap = new Map((prev.countries || []).map((c) => [c.code, c]));

  let officialRates = {};
  let arDolares = [];
  let boDolares = [];
  const sources = [];

  try {
    const er = await fetchJson("https://open.er-api.com/v6/latest/USD", {}, 12000);
    if (er?.rates) {
      officialRates = er.rates;
      sources.push("open.er-api.com");
    }
  } catch (err) {
    console.warn("[LATAM-FX] open.er-api error:", err.message);
  }

  try {
    const ar = await fetchJson("https://dolarapi.com/v1/dolares", {}, 10000);
    if (Array.isArray(ar)) {
      arDolares = ar;
      sources.push("dolarapi.com/ar");
    }
  } catch {
    // opcional
  }

  try {
    const bo = await fetchJson("https://bo.dolarapi.com/v1/dolares", {}, 10000);
    if (Array.isArray(bo)) {
      boDolares = bo;
      sources.push("bo.dolarapi.com");
    }
  } catch {
    // opcional
  }

  const p2pResults = await Promise.all(
    LATAM_COUNTRIES.map((c) =>
      c.code === "VE"
        ? Promise.resolve({
            buy: bcvData?.latest?.usdt_p2p_buy ?? null,
            sell: bcvData?.latest?.usdt_p2p_sell ?? null,
            mid: bcvData?.latest?.usdt_p2p_mid ?? null,
          })
        : fetchBinanceP2pMid(c.currency)
    )
  );
  sources.push("binance-p2p");

  const countries = LATAM_COUNTRIES.map((c, idx) => {
    const old = prevMap.get(c.code) || {};
    const p2p = p2pResults[idx];

    let official =
      c.code === "VE"
        ? bcvData?.latest?.usd_bcv ?? null
        : Number.isFinite(Number(officialRates[c.currency]))
        ? round(Number(officialRates[c.currency]), 4)
        : old.official_usd ?? null;

    let parallel = null;
    const extras = {};

    if (c.code === "VE") {
      parallel = bcvData?.latest?.usd_paralelo ?? null;
    } else if (c.code === "AR" && arDolares.length) {
      const of = arDolares.find((d) => d.casa === "oficial");
      const blue = arDolares.find((d) => d.casa === "blue");
      const mep = arDolares.find((d) => d.casa === "bolsa");
      const ccl = arDolares.find((d) => d.casa === "contadoconliqui");
      const cripto = arDolares.find((d) => d.casa === "cripto");
      if (of?.venta) official = round(Number(of.venta), 2);
      if (blue?.venta) parallel = round(Number(blue.venta), 2);
      if (mep?.venta) extras.mep_usd = round(Number(mep.venta), 2);
      if (ccl?.venta) extras.ccl_usd = round(Number(ccl.venta), 2);
      if (cripto?.venta) extras.cripto_usd = round(Number(cripto.venta), 2);
    } else if (c.code === "BO" && boDolares.length) {
      const of = boDolares.find((d) => d.casa === "oficial");
      const bin = boDolares.find((d) => d.casa === "binance");
      if (of?.venta) official = round(Number(of.venta), 4);
      if (bin?.venta) parallel = round(Number(bin.venta), 4);
    }

    const p2pMid = p2p.mid ?? old.usdt_p2p_mid ?? null;
    const spreadPct =
      official && p2pMid ? round(((p2pMid - official) / official) * 100, 2) : null;

    return {
      code: c.code,
      country: c.name,
      currency: c.currency,
      official_usd: official,
      parallel_usd: parallel ?? old.parallel_usd ?? null,
      usdt_p2p_buy: p2p.buy ?? old.usdt_p2p_buy ?? null,
      usdt_p2p_sell: p2p.sell ?? old.usdt_p2p_sell ?? null,
      usdt_p2p_mid: p2pMid,
      spread_vs_official_pct: spreadPct,
      ...extras,
    };
  });

  const out = {
    market: "LATAM_FX_P2P",
    updated_at_utc: nowIso,
    sources: [...new Set(sources)],
    count: countries.length,
    countries,
  };
  writeJson("latam-fx.json", out);
  console.log(`[LATAM-FX] OK countries=${countries.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// 6. Crypto Technical Signals (RSI 14, EMA 20/50/200, ATR%, S/R, Funding)
// ---------------------------------------------------------------------------
function calcEma(values, period) {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRsi(closes, period = 14) {
  if (!closes || closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcAtrPct(klines, period = 14) {
  if (!klines || klines.length <= period) return null;
  const trs = [];
  for (let i = 1; i < klines.length; i++) {
    const high = Number(klines[i][2]);
    const low = Number(klines[i][3]);
    const prevClose = Number(klines[i - 1][4]);
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const recent = trs.slice(-period);
  const atr = recent.reduce((a, b) => a + b, 0) / recent.length;
  const lastClose = Number(klines[klines.length - 1][4]);
  return lastClose > 0 ? (atr / lastClose) * 100 : null;
}

async function syncCryptoSignals(nowIso, cryptoData) {
  const prev = readJsonSafe("crypto-signals.json", { signals: [] });
  const prevMap = new Map((prev.signals || []).map((s) => [s.symbol, s]));
  const assetMap = new Map((cryptoData?.assets || []).map((a) => [a.symbol, a]));

  const signals = await Promise.all(
    CRYPTO_SYMBOLS.map(async (symbol) => {
      const base = symbol.replace(/USDT$/, "");
      const spot = assetMap.get(symbol);
      try {
        const [k1d, k4h] = await Promise.all([
          fetchJson(
            `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1d&limit=210`,
            {},
            12000
          ),
          fetchJson(
            `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=4h&limit=60`,
            {},
            12000
          ),
        ]);
        const closes1d = k1d.map((k) => Number(k[4]));
        const closes4h = k4h.map((k) => Number(k[4]));
        const price = closes1d[closes1d.length - 1];
        const ema20 = calcEma(closes1d, 20);
        const ema50 = calcEma(closes1d, 50);
        const ema200 = calcEma(closes1d, 200);
        const rsi1d = calcRsi(closes1d, 14);
        const rsi4h = calcRsi(closes4h, 14);
        const atrPct = calcAtrPct(k1d, 14);

        const last20 = k1d.slice(-20);
        const support20d = Math.min(...last20.map((k) => Number(k[3])));
        const resistance20d = Math.max(...last20.map((k) => Number(k[2])));

        const trend =
          ema20 && ema50
            ? price > ema20 && ema20 > ema50
              ? "bullish"
              : price < ema20 && ema20 < ema50
              ? "bearish"
              : "neutral"
            : "neutral";

        const rsiZone =
          rsi1d !== null
            ? rsi1d >= 70
              ? "overbought"
              : rsi1d <= 30
              ? "oversold"
              : "neutral"
            : "neutral";

        const fundingPct = spot?.funding_rate_pct ?? null;
        const fundingStatus =
          fundingPct !== null
            ? fundingPct >= 0.03
              ? "crowded_long"
              : fundingPct <= -0.01
              ? "crowded_short"
              : "normal"
            : "unknown";

        return {
          symbol,
          base,
          price_usd: round(price, 6),
          change_24h_pct: spot?.change_24h_pct ?? null,
          rsi_14_4h: round(rsi4h, 2),
          rsi_14_1d: round(rsi1d, 2),
          rsi_zone: rsiZone,
          ema_20_1d: round(ema20, 4),
          ema_50_1d: round(ema50, 4),
          ema_200_1d: round(ema200, 4),
          atr_14_1d_pct: round(atrPct, 2),
          support_20d: round(support20d, 4),
          resistance_20d: round(resistance20d, 4),
          trend,
          funding_rate_pct: fundingPct,
          funding_status: fundingStatus,
        };
      } catch (err) {
        console.warn(`[SIGNALS] ${symbol} error:`, err.message);
        return prevMap.get(symbol) || { symbol, base, trend: "unavailable" };
      }
    })
  );

  const out = {
    market: "CRYPTO_TECHNICAL_SIGNALS",
    updated_at_utc: nowIso,
    sources: ["data-api.binance.vision/klines", "okx/binance-funding"],
    count: signals.length,
    signals,
  };
  writeJson("crypto-signals.json", out);
  console.log(`[SIGNALS] OK count=${signals.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// 7. DeFi Stablecoin Yields (DeFiLlama public API)
// ---------------------------------------------------------------------------
async function syncDefiYields(nowIso) {
  const prev = readJsonSafe("defi-yields.json", { pools: [] });
  const targetChains = new Set(["Base", "Solana", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BSC"]);
  let pools = prev.pools || [];

  try {
    const res = await fetchJson("https://yields.llama.fi/pools", {}, 20000);
    if (Array.isArray(res?.data)) {
      pools = res.data
        .filter(
          (p) =>
            p.stablecoin === true &&
            targetChains.has(p.chain) &&
            typeof p.tvlUsd === "number" &&
            p.tvlUsd >= 1_000_000 &&
            typeof p.apy === "number" &&
            p.apy > 0.5 &&
            p.apy < 80 &&
            /USD|DAI|FRAX|USDe/i.test(String(p.symbol || ""))
        )
        .sort((a, b) => (b.apyBase ?? b.apy) - (a.apyBase ?? a.apy))
        .slice(0, 60)
        .map((p) => ({
          pool_id: p.pool,
          chain: p.chain,
          project: p.project,
          symbol: p.symbol,
          tvl_usd: Math.round(p.tvlUsd),
          apy_total: round(p.apy, 2),
          apy_base: round(p.apyBase, 2),
          apy_reward: round(p.apyReward, 2),
          apy_mean_30d: round(p.apyMean30d, 2),
          il_risk: p.ilRisk || "no",
        }));
    }
  } catch (err) {
    console.warn("[DEFI] DeFiLlama error:", err.message);
  }

  const out = {
    market: "DEFI_STABLECOIN_YIELDS",
    updated_at_utc: nowIso,
    sources: ["yields.llama.fi/pools"],
    filter_criteria: "stablecoin=true, tvlUsd>=1M, apy 0.5%-80%, major chains",
    count: pools.length,
    pools,
  };
  writeJson("defi-yields.json", out);
  console.log(`[DEFI] OK pools=${pools.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// 8. Prediction Markets (Polymarket Gamma public API)
// ---------------------------------------------------------------------------
function classifyPredictionTopic(question, slug = "") {
  const q = String(question || "").toLowerCase();
  const s = String(slug || "").toLowerCase();
  if (/(^|\b)(nfl|nba|mlb|nhl|ufc|ncaa|premier league|champions league|fifa|atp|wta|spread:|o\/u\b|vs\.)/.test(q) || /^(nfl|nba|mlb|nhl|cbb|cfb|soccer|tennis)-/.test(s)) {
    return "sports";
  }
  if (/\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|usdc|usdt|binance|coinbase|xrp|doge|defi|memecoin)\b/.test(q)) {
    return "crypto";
  }
  if (/\b(venezuela|argentina|brazil|brasil|mexico|colombia|latam|maduro|milei|lula|petro|bolivia|chile|peru)\b/.test(q)) {
    return "latam";
  }
  if (/\b(fed|fomc|interest rate|inflation|cpi|recession|gdp|tariff|oil|gold|s&p|nasdaq|treasury|rate cut|bps)\b/.test(q)) {
    return "macro";
  }
  if (/\b(trump|election|president|senate|congress|war|ukraine|russia|china|iran|israel|nato|governor|prime minister)\b/.test(q)) {
    return "politics";
  }
  return "other";
}

async function syncPredictions(nowIso) {
  const prev = readJsonSafe("predictions.json", { markets: [] });
  let markets = prev.markets || [];

  try {
    const raw = await fetchJson(
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=60",
      {},
      15000
    );
    if (Array.isArray(raw)) {
      markets = raw
        .filter((m) => m.question && Number(m.volume24hr || 0) > 1000)
        .slice(0, 40)
        .map((m) => {
          let outcomes = [];
          let prices = [];
          try {
            outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes || [];
            prices =
              typeof m.outcomePrices === "string"
                ? JSON.parse(m.outcomePrices)
                : m.outcomePrices || [];
          } catch {
            // ignorar
          }
          const probabilities = outcomes.map((label, i) => ({
            outcome: label,
            probability_pct:
              prices[i] !== undefined ? round(Number(prices[i]) * 100, 2) : null,
          }));
          return {
            id: m.id,
            question: m.question,
            topic: classifyPredictionTopic(m.question, m.slug),
            probabilities,
            volume_24h_usd: round(Number(m.volume24hr || 0), 2),
            volume_total_usd: round(Number(m.volumeNum || m.volume || 0), 2),
            liquidity_usd: round(Number(m.liquidityNum || m.liquidity || 0), 2),
            end_date: m.endDate || null,
            url: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
          };
        });
    }
  } catch (err) {
    console.warn("[PREDICTIONS] Polymarket error:", err.message);
  }

  const out = {
    market: "PREDICTION_MARKETS_POLYMARKET",
    updated_at_utc: nowIso,
    sources: ["gamma-api.polymarket.com/markets"],
    count: markets.length,
    markets,
  };
  writeJson("predictions.json", out);
  console.log(`[PREDICTIONS] OK markets=${markets.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// 9. Ecosistema Unificado (cross-market)
// ---------------------------------------------------------------------------
function buildEcosystem(nowIso, bcv, bvc, crypto, nyse, latamFx, signals, defi, predictions) {
  const usdBcv = bcv?.latest?.usd_bcv ?? null;
  const usdtP2p = bcv?.latest?.usdt_p2p_mid ?? null;

  const findCrypto = (base) => (crypto?.assets || []).find((a) => a.base === base) || null;
  const findNyse = (sym) => (nyse?.equities || []).find((e) => e.symbol === sym) || null;

  const btc = findCrypto("BTC");
  const eth = findCrypto("ETH");
  const sol = findCrypto("SOL");
  const paxg = findCrypto("PAXG");
  const spy = findNyse("SPY");
  const qqq = findNyse("QQQ");
  const gld = findNyse("GLD");
  const ilf = findNyse("ILF");
  const meli = findNyse("MELI");
  const nu = findNyse("NU");
  const pbr = findNyse("PBR");

  const pricedBvc = (bvc?.stocks || []).filter((s) => s.price_ves !== null);
  const topBvcMovers = [...pricedBvc]
    .filter((s) => typeof s.change_pct === "number")
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
    .slice(0, 8);

  const avgFundingPct = (() => {
    const rates = (crypto?.assets || [])
      .map((a) => a.funding_rate_pct)
      .filter((r) => typeof r === "number");
    if (!rates.length) return null;
    return round(rates.reduce((acc, r) => acc + r, 0) / rates.length, 4);
  })();

  const out = {
    ecosystem: "latam-x402",
    version: "1.0.0",
    updated_at_utc: nowIso,
    fx_venezuela: bcv.latest,
    bvc_caracas: {
      index: bvc.index,
      coverage: bvc.coverage,
      top_movers: topBvcMovers,
      sample_quotes: pricedBvc.slice(0, 10),
    },
    crypto_benchmarks: {
      btc,
      eth,
      sol,
      paxg,
      avg_funding_rate_pct: avgFundingPct,
    },
    nyse_benchmarks: {
      us_indices: [spy, qqq, gld].filter(Boolean),
      latam_leaders: [ilf, meli, nu, pbr].filter(Boolean),
    },
    cross_market_metrics: {
      venezuela_fx_spread_pct: bcv?.latest?.spread_vs_bcv_pct ?? null,
      btc_price_ves_bcv: btc?.price_usd && usdBcv ? round(btc.price_usd * usdBcv, 2) : null,
      btc_price_ves_p2p: btc?.price_usd && usdtP2p ? round(btc.price_usd * usdtP2p, 2) : null,
      spy_price_ves_bcv: spy?.price_usd && usdBcv ? round(spy.price_usd * usdBcv, 2) : null,
      btc_per_spy_ratio: btc?.price_usd && spy?.price_usd ? round(btc.price_usd / spy.price_usd, 2) : null,
      paxg_vs_gld_10x_spread_pct:
        paxg?.price_usd && gld?.price_usd
          ? round(((paxg.price_usd - gld.price_usd * 10) / (gld.price_usd * 10)) * 100, 2)
          : null,
    },
    latam_fx_spreads: (latamFx?.countries || []).map((c) => ({
      code: c.code,
      currency: c.currency,
      official_usd: c.official_usd,
      usdt_p2p_mid: c.usdt_p2p_mid,
      spread_vs_official_pct: c.spread_vs_official_pct,
    })),
    crypto_signals_highlights: (signals?.signals || []).slice(0, 6).map((s) => ({
      base: s.base,
      rsi_14_1d: s.rsi_14_1d,
      trend: s.trend,
      funding_status: s.funding_status,
    })),
    top_base_usdc_yields: (defi?.pools || [])
      .filter((p) => p.chain === "Base")
      .slice(0, 5),
    top_predictions: (predictions?.markets || []).slice(0, 5).map((m) => ({
      question: m.question,
      topic: m.topic,
      probabilities: m.probabilities,
      volume_24h_usd: m.volume_24h_usd,
    })),
  };

  writeJson("ecosystem.json", out);
  console.log("[ECOSYSTEM] OK unified snapshot written");
  return out;
}

async function main() {
  const nowIso = new Date().toISOString();
  console.log(`[SYNC] Starting latam-x402 data sync at ${nowIso}`);

  const bcv = await syncBcv(nowIso);
  const [bvc, crypto, nyse, latamFx, defi, predictions] = await Promise.all([
    syncBvc(nowIso, bcv),
    syncCrypto(nowIso),
    syncNyse(nowIso),
    syncLatamFx(nowIso, bcv),
    syncDefiYields(nowIso),
    syncPredictions(nowIso),
  ]);
  const signals = await syncCryptoSignals(nowIso, crypto);
  buildEcosystem(nowIso, bcv, bvc, crypto, nyse, latamFx, signals, defi, predictions);
  console.log("[SYNC] Done.");
}

main().catch((err) => {
  console.error("[SYNC] Fatal error:", err);
  process.exit(1);
});
