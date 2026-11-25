import { app } from "../src/app.js";

async function probe(path: string) {
  const res = await app.fetch(new Request(`http://localhost:3000${path}`));
  const paymentReqHeader =
    res.headers.get("payment-required") || res.headers.get("x-payment-required") || "";
  const bodyText = await res.text();
  let parsed: unknown = bodyText;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    // plain text
  }
  console.log(`\n=== GET ${path} -> HTTP ${res.status} ===`);
  if (paymentReqHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(paymentReqHeader, "base64").toString("utf8"));
      console.log("PAYMENT-REQUIRED (decoded):", JSON.stringify(decoded, null, 2));
    } catch {
      console.log("PAYMENT-REQUIRED (raw):", paymentReqHeader.slice(0, 300));
    }
  } else if (typeof parsed === "object" && parsed !== null) {
    const preview = JSON.stringify(parsed, null, 2);
    console.log(preview.slice(0, 600) + (preview.length > 600 ? "\n..." : ""));
  } else {
    console.log(String(parsed).slice(0, 400));
  }
  return res.status;
}

async function main() {
  const results = {
    root: await probe("/"),
    health: await probe("/api/health"),
    docs: await probe("/api/docs"),
    bcv: await probe("/api/v1/bcv"),
    latamFx: await probe("/api/v1/latam-fx"),
    bvc: await probe("/api/v1/bvc"),
    bvcTicker: await probe("/api/v1/bvc/BVCC"),
    crypto: await probe("/api/v1/crypto"),
    cryptoSignals: await probe("/api/v1/crypto/signals"),
    liquidity: await probe("/api/v1/liquidity"),
    nyse: await probe("/api/v1/nyse"),
    defiYields: await probe("/api/v1/defi/yields"),
    predictions: await probe("/api/v1/predictions"),
    ecosystem: await probe("/api/v1/ecosystem"),
  };

  console.log("\nSUMMARY:", JSON.stringify(results));
  const ok =
    results.root === 200 &&
    results.health === 200 &&
    results.docs === 200 &&
    results.bcv === 402 &&
    results.latamFx === 402 &&
    results.bvc === 402 &&
    results.bvcTicker === 402 &&
    results.crypto === 402 &&
    results.cryptoSignals === 402 &&
    results.liquidity === 402 &&
    results.nyse === 402 &&
    results.defiYields === 402 &&
    results.predictions === 402 &&
    results.ecosystem === 402;

  if (!ok) {
    console.error("VERIFICATION FAILED!");
    process.exit(1);
  }
  console.log("ALL ENDPOINTS VERIFIED OK (200 free + 402 x402 paid)!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
