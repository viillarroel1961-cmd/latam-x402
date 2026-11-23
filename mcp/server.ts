#!/usr/bin/env node
/**
 * STDIO Model Context Protocol (MCP) server for latam-x402.
 * Compatible with Claude Desktop, Cursor, Cline, Glama, and Smithery.
 *
 * Environment variables:
 *   LATAM_X402_URL   (optional, default https://latam-x402.vercel.app)
 *   EVM_PRIVATE_KEY  (optional 0x... key funded with Base USDC to auto-pay x402 calls)
 */
import readline from "node:readline";
import { handleMcpJsonRpc } from "../src/mcp.js";

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed) as Record<string, unknown>;
    const res = await handleMcpJsonRpc(req);
    if (res !== null) {
      process.stdout.write(JSON.stringify(res) + "\n");
    }
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
        },
      }) + "\n"
    );
  }
});
