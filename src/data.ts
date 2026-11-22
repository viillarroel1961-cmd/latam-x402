import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const remoteCache = new Map<string, CacheEntry>();

function readLocalJson<T>(filename: string): T | null {
  const candidates = [
    path.join(DATA_DIR, filename),
    path.resolve(process.cwd(), "latam-x402", "data", filename),
  ];
  for (const fullPath of candidates) {
    try {
      if (fs.existsSync(fullPath)) {
        return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
      }
    } catch {
      // probar siguiente ruta
    }
  }
  return null;
}

export async function loadMarketData<T = Record<string, unknown>>(
  filename: string
): Promise<{ data: T | null; source: "remote-cache" | "remote-live" | "local" | "missing" }> {
  const remoteBase = (process.env.DATA_REMOTE_BASE_URL || "").trim().replace(/\/+$/, "");

  if (remoteBase) {
    const cached = remoteCache.get(filename);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data as T, source: "remote-cache" };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${remoteBase}/${filename}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const json = (await res.json()) as T;
          remoteCache.set(filename, { expiresAt: Date.now() + CACHE_TTL_MS, data: json });
          return { data: json, source: "remote-live" };
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // fallback a archivo local empaquetado
    }
  }

  const local = readLocalJson<T>(filename);
  if (local) {
    return { data: local, source: "local" };
  }
  return { data: null, source: "missing" };
}
