import { serve } from "@hono/node-server";
import { app, getRuntimeConfig } from "./app.js";

try {
  process.loadEnvFile?.();
} catch {
  // .env opcional en local
}

const port = Number(process.env.PORT || 3000);
const cfg = getRuntimeConfig();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[latam-x402] Listening on http://localhost:${info.port}`);
  console.log(
    `[latam-x402] x402 network=${cfg.network} facilitator=${cfg.facilitatorUrl} payTo=${cfg.payTo}`
  );
});
