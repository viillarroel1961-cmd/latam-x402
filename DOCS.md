# Documentación de la API `latam-x402`

**Base URL:** `https://latam-x402.vercel.app`  
**Página de comercio (x402scan / Poncho):** `https://tryponcho.com/m/latam-x402.vercel.app`  
**Protocolo de cobro:** `x402 v2` (HTTP `402 Payment Required`)  
**Red y moneda:** Base Mainnet (`eip155:8453`) · **USDC** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)  
**Facilitador:** PayAI (`https://facilitator.payai.network`)  
**Actualización de datos:** Automática cada **2 horas** (GitHub Actions → `remote-live` sin intervención manual).

---

## 1. Cómo funciona una consulta pagada (`x402 v2`)

No usa API keys, registro ni suscripciones mensuales. El flujo entre un agente de IA (o cliente) y la API es automático en 3 pasos:

1. El cliente hace `GET https://latam-x402.vercel.app/api/v1/bcv`.
2. La API responde **`HTTP 402 Payment Required`** con la cabecera `PAYMENT-REQUIRED` (en base64) indicando el monto exacto en USDC, la red (`eip155:8453`) y la wallet receptora (`0x2A4d6c205c9a8fe7E9596d5162ad33C69D6b6f58`).
3. El cliente firma una autorización EIP-3009 sin gas y repite la petición enviando la cabecera `PAYMENT-SIGNATURE`. PayAI verifica y liquida el USDC on-chain en segundos, y la API devuelve **`HTTP 200 OK`** con el JSON y el comprobante en la cabecera `PAYMENT-RESPONSE`.

---

## 2. Catálogo completo de endpoints

### A. Endpoints gratuitos (descubrimiento y estado)

| Método | Ruta | Qué devuelve |
|---|---|---|
| `GET` | `/` | Resumen de la API, red activa, facilitador y tabla de precios |
| `GET` | `/api/health` | Estado del servicio y última fecha UTC de actualización por mercado |
| `GET` | `/api/docs` / `/openapi.json` | Especificación OpenAPI 3.1 completa + bloque `x-x402` |
| `GET` | `/.well-known/x402.json` | Manifiesto estándar `x402` para directorios y crawlers de agentes |
| `GET` | `/llms.txt` | Índice en texto plano legible por LLMs y agentes de IA |

### B. Endpoints pagos (`x402 v2` — Base USDC)

| Método | Ruta | Precio | Parámetros opcionales | Qué entrega |
|---|---|---:|---|---|
| `GET` | `/api/v1/bcv` | **`$0.002`** | `?days=30` (`1`–`365`) | Tasa oficial BCV USD y EUR, Binance P2P USDT/VES (compra/venta/medio), brecha `%`, EUR/USD implícito e histórico diario |
| `GET` | `/api/v1/crypto` | **`$0.002`** | `?symbol=BTC` | 12 criptos principales: precio spot USD, cambio 24h `%`, máx/mín 24h, volumen 24h USD y **funding rate** perpetuo |
| `GET` | `/api/v1/nyse` | **`$0.003`** | `?symbol=MELI` · `?category=etf\|latam_etf\|us_equity\|latam_adr` | 20 activos NYSE/NASDAQ (ETFs US, mega-caps y ADRs LatAm) con precio USD, cierre previo, cambio `%` y volumen |
| `GET` | `/api/v1/bvc` | **`$0.005`** | `?onlyPriced=true` | 38 emisoras de la Bolsa de Caracas con precio en **VES**, variación `%`, volumen, monto efectivo y valuación cruzada en **USD BCV** y **USD P2P** + resumen del día |
| `GET` | `/api/v1/bvc/:ticker` | **`$0.005`** | `:ticker` (ej. `BVCC`, `BNC`, `BPV`, `BVL`, `MVZ.A`, `RST`, `TDV.D`) | Cotización individual de 1 acción de la BVC en VES, USD BCV y USD P2P |
| `GET` | `/api/v1/ecosystem` | **`$0.010`** | `?sections=all\|fx\|bvc\|crypto\|nyse\|ratios` | **Snapshot unificado de los 4 mercados** + métricas cruzadas (`BTC/VES`, `SPY/VES`, `BTC/SPY`, `PAXG/GLD`, brecha VE) |

---

## 3. Ejemplos reales de consulta y respuesta

### 3.1. `GET /api/health` *(Gratis)*

```bash
curl https://latam-x402.vercel.app/api/health
```

```json
{
  "status": "ok",
  "service": "latam-x402",
  "now_utc": "2026-11-23T01:17:32.514Z",
  "x402": {
    "network": "eip155:8453",
    "facilitator": "https://facilitator.payai.network",
    "wallet_configured": true
  },
  "feeds": {
    "bcv": { "source": "remote-live", "updated_at_utc": "2026-11-22T23:08:26.478Z" },
    "bvc": { "source": "remote-live", "updated_at_utc": "2026-11-22T23:08:26.478Z" },
    "crypto": { "source": "remote-live", "updated_at_utc": "2026-11-22T23:08:26.478Z" },
    "nyse": { "source": "remote-live", "updated_at_utc": "2026-11-22T23:08:26.478Z" },
    "ecosystem": { "source": "remote-live", "updated_at_utc": "2026-11-22T23:08:26.478Z" }
  }
}
```

---

### 3.2. `GET /api/v1/bcv?days=30` *(`$0.002` USDC)*

**Para qué sirve:** agentes o apps que necesitan la tasa oficial BCV, la referencia real de USDT P2P en Binance Venezuela y la brecha porcentual en una sola llamada.

```json
{
  "market": "BCV_FX_VE",
  "updated_at_utc": "2026-11-22T23:08:26.478Z",
  "sources": [
    "ve.dolarapi.com/dolares",
    "ve.dolarapi.com/euros",
    "binance-p2p-ves"
  ],
  "latest": {
    "date": "2026-11-22",
    "usd_bcv": 918.7662,
    "eur_bcv": 1009.0717,
    "usd_paralelo": 1086.8627,
    "usdt_p2p_buy": 1088,
    "usdt_p2p_sell": 1090,
    "usdt_p2p_mid": 1089,
    "spread_vs_bcv_pct": 18.53,
    "eur_usd_implied": 1.0983
  },
  "history": [
    {
      "date": "2026-11-22",
      "usd_bcv": 918.7662,
      "eur_bcv": 1009.0717,
      "usdt_p2p_mid": 1089,
      "spread_vs_bcv_pct": 18.53
    }
  ]
}
```

---

### 3.3. `GET /api/v1/bvc?onlyPriced=true` y `GET /api/v1/bvc/BVCC` *(`$0.005` USDC)*

**Para qué sirve:** consultar acciones de la Bolsa de Valores de Caracas ya convertidas automáticamente a **USD BCV** y **USD P2P** (con volumen y monto efectivo del día).

Ejemplo de respuesta de **`GET /api/v1/bvc/BVCC`**:

```json
{
  "market": "BVC_CARACAS",
  "updated_at_utc": "2026-11-22T23:08:26.478Z",
  "fx_reference": {
    "usd_bcv": 918.7662,
    "usdt_p2p_mid": 1089
  },
  "stock": {
    "ticker": "BVCC",
    "name": "Bolsa de Valores de Caracas",
    "price_ves": 930,
    "change_abs_ves": -4.98,
    "change_pct": -0.53,
    "volume_shares": 20138,
    "turnover_ves": 18600101.79,
    "turnover_usd_bcv": 20244.65,
    "price_usd_bcv": 1.012227,
    "price_usd_p2p": 0.853994,
    "last_trade_time": "13:00:00",
    "status": "live"
  }
}
```

Y **`GET /api/v1/bvc`** incluye además el resumen general del mercado (`market_summary`: operaciones, títulos negociados y monto efectivo total en Bs., USD BCV y USD P2P) y el listado de las 38 emisoras.

---

### 3.4. `GET /api/v1/crypto?symbol=BTC` *(`$0.002` USDC)*

**Para qué sirve:** obtener precio spot, rango 24h, volumen y **funding rate** perpetuo de los 12 activos principales (`BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `ADA`, `AVAX`, `DOGE`, `LINK`, `TRX`, `TON`, `PAXG`).

```json
{
  "market": "CRYPTO_GLOBAL",
  "updated_at_utc": "2026-11-22T23:08:26.478Z",
  "sources": [
    "https://data-api.binance.vision/api/v3/ticker/24hr",
    "okx.com/public/funding-rate"
  ],
  "count": 1,
  "assets": [
    {
      "symbol": "BTCUSDT",
      "base": "BTC",
      "price_usd": 60911.73,
      "change_24h_pct": 1.21,
      "high_24h": 61669.99,
      "low_24h": 58768.51,
      "quote_volume_24h_usd": 1202510550.84,
      "funding_rate": 0.000022,
      "funding_rate_pct": 0.0022
    }
  ]
}
```

---

### 3.5. `GET /api/v1/nyse?category=latam_adr` *(`$0.003` USDC)*

**Para qué sirve:** cotizaciones diferidas (~15 min / cierre) de ETFs y acciones líderes de Wall Street (`SPY`, `QQQ`, `DIA`, `GLD`, `USO`, `AAPL`, `MSFT`, `NVDA`, `AMZN`, `GOOGL`, `META`, `TSLA`, `JPM`) y líderes de Latinoamérica (`ILF`, `MELI`, `NU`, `PBR`, `VALE`, `EC`, `YPF`).

```json
{
  "market": "NYSE_US_LATAM",
  "updated_at_utc": "2026-11-22T23:08:26.478Z",
  "delay_notice": "Standard delayed / end-of-day quotes (~15 min)",
  "coverage": { "total": 20, "live": 20 },
  "equities": [
    {
      "symbol": "MELI",
      "name": "MercadoLibre Inc.",
      "category": "latam_adr",
      "exchange": "NasdaqGS",
      "currency": "USD",
      "price_usd": 1355,
      "prev_close_usd": 1491.49,
      "change_pct": -9.15,
      "volume": 1253600,
      "source": "yahoo-finance"
    },
    {
      "symbol": "NU",
      "name": "Nu Holdings Ltd.",
      "category": "latam_adr",
      "exchange": "NYSE",
      "currency": "USD",
      "price_usd": 11.27,
      "prev_close_usd": 13.22,
      "change_pct": -14.75,
      "volume": 68649700,
      "source": "yahoo-finance"
    }
  ]
}
```

---

### 3.6. `GET /api/v1/ecosystem?sections=all` *(`$0.010` USDC — endpoint estrella)*

**Para qué sirve:** un agente de IA obtiene en **1 sola llamada** el panorama completo de **Venezuela (BCV + BVC en USD) + Cripto + NYSE/LatAm + ratios cruzados**.  
Con `?sections=ratios` (o `fx`, `bvc`, `crypto`, `nyse`) puede pedir solo el bloque que necesite.

```json
{
  "ecosystem": "latam-x402",
  "version": "1.0.0",
  "updated_at_utc": "2026-11-22T23:08:26.478Z",
  "fx_venezuela": {
    "date": "2026-11-22",
    "usd_bcv": 918.7662,
    "eur_bcv": 1009.0717,
    "usdt_p2p_mid": 1089,
    "spread_vs_bcv_pct": 18.53
  },
  "bvc_caracas": {
    "coverage": { "catalog_total": 38, "live_quotes": 31, "priced_total": 31 },
    "top_movers": [ "...top 8 variaciones del dia en VES y USD..." ],
    "sample_quotes": [ "...10 emisoras cotizadas..." ]
  },
  "crypto_benchmarks": {
    "btc": { "symbol": "BTCUSDT", "price_usd": 60911.73, "change_24h_pct": 1.21, "funding_rate_pct": 0.0022 },
    "eth": { "symbol": "ETHUSDT", "price_usd": 1718.52, "change_24h_pct": 2.09, "funding_rate_pct": -0.0037 },
    "avg_funding_rate_pct": 0.0005
  },
  "nyse_benchmarks": {
    "us_indices": [ "SPY", "QQQ", "GLD" ],
    "latam_leaders": [ "ILF", "MELI", "NU", "PBR" ]
  },
  "cross_market_metrics": {
    "venezuela_fx_spread_pct": 18.53,
    "btc_price_ves_bcv": 55963638.71,
    "btc_price_ves_p2p": 66332873.97,
    "spy_price_ves_bcv": 633774.11,
    "btc_per_spy_ratio": 88.3,
    "paxg_vs_gld_10x_spread_pct": 10.22
  }
}
```

---

## 4. Cómo consumirla desde un agente de IA (TypeScript)

```ts
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const buyer = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);
const client = new x402Client();
registerExactEvmScheme(client, { signer: buyer });
const httpClient = new x402HTTPClient(client);

const url = "https://latam-x402.vercel.app/api/v1/ecosystem?sections=all";

// 1. Peticion inicial -> devuelve HTTP 402 con los requisitos de pago
const res402 = await fetch(url);
const paymentReq = httpClient.getPaymentRequiredResponse((h) => res402.headers.get(h));

// 2. Firma EIP-3009 sin gas y reenvia -> devuelve HTTP 200 con los datos
const payload = await httpClient.createPaymentPayload(paymentReq);
const headers = httpClient.encodePaymentSignatureHeader(payload);
const resOk = await fetch(url, { headers });
const data = await resOk.json();
console.log(data.cross_market_metrics);
```
