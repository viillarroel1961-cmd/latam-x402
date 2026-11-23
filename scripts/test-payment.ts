import fs from "node:fs";
import path from "node:path";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BUYER_FILE = path.resolve(process.cwd(), ".test-buyer.json");
const MERCHANT_ADDR = "0x2A4d6c205c9a8fe7E9596d5162ad33C69D6b6f58" as const;
const USE_TESTNET = process.argv.includes("--testnet");
const DRY_RUN = process.argv.includes("--dry-run");
const RUN_ALL = process.argv.includes("--all");
const TARGET_URL =
  process.argv.find((a) => a.startsWith("http")) || "https://latam-x402.vercel.app/api/v1/bcv";

const CHAIN = USE_TESTNET ? baseSepolia : base;
const RPC_URL = USE_TESTNET ? "https://sepolia.base.org" : "https://mainnet.base.org";
const USDC_ADDR = (
  USE_TESTNET
    ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
) as `0x${string}`;

const ALL_ENDPOINTS = [
  "https://latam-x402.vercel.app/api/v1/bcv",
  "https://latam-x402.vercel.app/api/v1/latam-fx",
  "https://latam-x402.vercel.app/api/v1/bvc",
  "https://latam-x402.vercel.app/api/v1/bvc/BVCC",
  "https://latam-x402.vercel.app/api/v1/crypto",
  "https://latam-x402.vercel.app/api/v1/crypto/signals",
  "https://latam-x402.vercel.app/api/v1/nyse",
  "https://latam-x402.vercel.app/api/v1/defi/yields",
  "https://latam-x402.vercel.app/api/v1/predictions",
  "https://latam-x402.vercel.app/api/v1/ecosystem",
];

const ERC20_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

function loadOrCreateTestBuyer() {
  if (fs.existsSync(BUYER_FILE)) {
    const saved = JSON.parse(fs.readFileSync(BUYER_FILE, "utf8"));
    return privateKeyToAccount(saved.privateKey as `0x${string}`);
  }
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  fs.writeFileSync(
    BUYER_FILE,
    JSON.stringify(
      {
        warning: "DISPOSABLE BUYER WALLET FOR X402 TESTING ONLY. Keep only tiny USDC amounts.",
        address: account.address,
        privateKey,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  return account;
}

async function payOne(url: string, httpClient: x402HTTPClient) {
  const res1 = await fetch(url);
  if (res1.status !== 402) {
    throw new Error(`Expected 402 for ${url}, got ${res1.status}`);
  }
  const pr = httpClient.getPaymentRequiredResponse((h) => res1.headers.get(h));
  const payload = await httpClient.createPaymentPayload(pr);
  const headers = httpClient.encodePaymentSignatureHeader(payload);
  const res2 = await fetch(url, { headers });
  const text = await res2.text();
  if (!res2.ok) {
    const errH = res2.headers.get("payment-required");
    const detail = errH ? Buffer.from(errH, "base64").toString("utf8") : text;
    throw new Error(`HTTP ${res2.status} on ${url}: ${detail}`);
  }
  let settle: unknown = null;
  try {
    settle = httpClient.getPaymentSettleResponse((h) => res2.headers.get(h));
  } catch {
    // opcional
  }
  console.log(`OK 200 ${url} | settle=${JSON.stringify(settle)} | bytes=${text.length}`);
}

async function main() {
  const buyer = loadOrCreateTestBuyer();
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

  const [buyerBalRaw, merchantBalBeforeRaw] = await Promise.all([
    publicClient.readContract({
      address: USDC_ADDR,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [buyer.address],
    }),
    publicClient.readContract({
      address: USDC_ADDR,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [MERCHANT_ADDR],
    }),
  ]);

  const buyerBal = Number(formatUnits(buyerBalRaw, 6));
  const merchantBalBefore = Number(formatUnits(merchantBalBeforeRaw, 6));
  const urls = RUN_ALL ? ALL_ENDPOINTS : [TARGET_URL];
  const minNeeded = RUN_ALL ? 0.05 : 0.01;

  console.log(`=== latam-x402 Live Payment Test (${CHAIN.name}) ===`);
  console.log("Test Buyer address:      ", buyer.address);
  console.log("Test Buyer USDC balance: ", buyerBal, "USDC");
  console.log("Merchant (your MetaMask):", MERCHANT_ADDR);
  console.log("Merchant USDC before:    ", merchantBalBefore, "USDC");

  if (buyerBal < minNeeded && !DRY_RUN) {
    console.log(`\n[NEEDS >= ${minNeeded} USDC on ${CHAIN.name}]`);
    console.log(`Send >= ${minNeeded} USDC (${CHAIN.name}, NO ETH gas needed) to: ${buyer.address}`);
    process.exit(2);
  }

  const client = new x402Client();
  registerExactEvmScheme(client, { signer: buyer });
  const httpClient = new x402HTTPClient(client);

  for (const url of urls) {
    await payOne(url, httpClient);
  }

  const merchantBalAfterRaw = await publicClient.readContract({
    address: USDC_ADDR,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [MERCHANT_ADDR],
  });
  const merchantBalAfter = Number(formatUnits(merchantBalAfterRaw, 6));
  console.log("\nMerchant USDC after:     ", merchantBalAfter, "USDC");
  console.log("Merchant delta:          +", (merchantBalAfter - merchantBalBefore).toFixed(6), "USDC");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
