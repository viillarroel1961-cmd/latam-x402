# Installing latam-x402 MCP Server

Connect AI agents (Claude Desktop, Cursor, Cline, Windsurf, LangChain) to **latam-x402** for unified LatAm FX & P2P spreads, Caracas Stock Exchange (BVC) in VES/USD, Crypto spot & pre-computed technical signals (RSI/EMA/ATR), NYSE/LatAm ADRs, DeFi stablecoin yields, and Polymarket prediction markets.

## Option 1: Remote Streamable HTTP MCP (Zero Install)

Point any Streamable HTTP MCP client to:

```text
https://latam-x402.vercel.app/api/mcp
```

## Option 2: Local STDIO MCP (Auto-pays x402 Base USDC micropayments)

1. Clone and install:
```bash
git clone https://github.com/viillarroel1961-cmd/latam-x402.git
cd latam-x402
npm install
```

2. Add to your MCP client config (`claude_desktop_config.json`, Cursor `.cursor/mcp.json`, or Cline MCP settings):

```json
{
  "mcpServers": {
    "latam-x402": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/latam-x402/mcp/server.ts"],
      "env": {
        "LATAM_X402_URL": "https://latam-x402.vercel.app",
        "EVM_PRIVATE_KEY": "0xYOUR_OPTIONAL_BASE_USDC_AGENT_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

- `get_api_health` works for free without a wallet.
- Paid tools (`$0.002`–`$0.01` USDC on Base Mainnet via PayAI) automatically sign gasless EIP-3009 x402 payments when `EVM_PRIVATE_KEY` is provided.
