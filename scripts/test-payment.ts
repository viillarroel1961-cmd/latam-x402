import fs from "node:fs";
import path from "node:path";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BUYER_FILE = path.resolve(process.cwd(), ".test-buyer.json");
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const MERCHANT_ADDR = "0x2A4d6c205c9a8fe7E9596d5162ad33C69D6b6f58" as const;
const TARGET_URL =
  process.argv.find((a) => a.startsWith("http")) || "https://latam-x402.vercel.app/api/v1/ecosystem";
const DRY_RUN = process.argv.includes("--dry-run");

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
        warning: "DISPOSABLE TESTNET-ONLY WALLET (Base Sepolia). Never send real funds here.",
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

async function main() {
  const buyer = loadOrCreateTestBuyer();
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const [buyerBalRaw, merchantBalBeforeRaw] = await Promise.all([
    publicClient.readContract({
      address: BASE_SEPOLIA_USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [buyer.address],
    }),
    publicClient.readContract({
      address: BASE_SEPOLIA_USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [MERCHANT_ADDR],
    }),
  ]);

  const buyerBal = Number(formatUnits(buyerBalRaw, 6));
  const merchantBalBefore = Number(formatUnits(merchantBalBeforeRaw, 6));

  console.log("=== latam-x402 Base Sepolia Live Payment Test ===");
  console.log("Test Buyer (disposable):", buyer.address);
  console.log("Test Buyer USDC balance:", buyerBal, "USDC");
  console.log("Merchant (your MetaMask):", MERCHANT_ADDR);
  console.log("Merchant USDC before:   ", merchantBalBefore, "USDC");
  console.log("Target URL:             ", TARGET_URL);

  if (buyerBal < 0.02 && !DRY_RUN) {
    console.log("\n[NEEDS TESTNET USDC]");
    console.log("1. Open https://faucet.circle.com/");
    console.log("2. Select Network: Base Sepolia (USDC)");
    console.log("3. Paste Test Buyer address:", buyer.address);
    console.log("4. Click 'Send 20 USDC' (free, no ETH gas needed!) and re-run this script.");
    process.exit(2);
  }

  // 1. Primera peticion -> debe devolver 402 Payment Required
  const res1 = await fetch(TARGET_URL);
  console.log(`\nStep 1 -> HTTP ${res1.status}`);
  if (res1.status !== 402) {
    console.error("Expected HTTP 402, got:", res1.status, await res1.text());
    process.exit(1);
  }

  // 2. Firmar autorizacion EIP-3009 sin gas con x402Client + ExactEvmScheme
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: buyer });
  const httpClient = new x402HTTPClient(client);

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) => res1.headers.get(name));
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  // 3. Reintentar con firma de pago -> PayAI verifica y liquida on-chain
  console.log("Step 2 -> Sending signed x402 payment to PayAI facilitator...");
  const res2 = await fetch(TARGET_URL, { headers: paymentHeaders });
  const bodyText = await res2.text();
  console.log(`Step 3 -> HTTP ${res2.status}`);

  if (!res2.ok) {
    const errHeader = res2.headers.get("payment-required");
    if (errHeader) {
      console.log("PayAI verify response:", Buffer.from(errHeader, "base64").toString("utf8"));
    }
    console.error("Payment failed:", bodyText);
    process.exit(1);
  }

  let settle: unknown = null;
  try {
    settle = httpClient.getPaymentSettleResponse((name) => res2.headers.get(name));
  } catch {
    // opcional
  }
  console.log("Settlement response:", JSON.stringify(settle, null, 2));

  const merchantBalAfterRaw = await publicClient.readContract({
    address: BASE_SEPOLIA_USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [MERCHANT_ADDR],
  });
  const merchantBalAfter = Number(formatUnits(merchantBalAfterRaw, 6));
  console.log("\nMerchant USDC after:    ", merchantBalAfter, "USDC");
  console.log("Merchant delta:         +", (merchantBalAfter - merchantBalBefore).toFixed(6), "USDC");
  console.log("\nAPI Payload preview:\n", bodyText.slice(0, 600) + (bodyText.length > 600 ? "\n..." : ""));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
