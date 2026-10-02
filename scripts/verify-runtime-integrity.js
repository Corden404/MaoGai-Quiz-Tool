// Run with Node 18+: node scripts/verify-runtime-integrity.js
// Read-only: verifies CDN bytes against reviewed, committed hashes. This never
// rewrites a hash to match unexpected content. Review version/hash updates together.
const { createHash } = require("node:crypto");
const manifest = require("./runtime-integrity.json");

(async () => {
  for (const [name, asset] of Object.entries(manifest)) {
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    if (response.url !== asset.url) throw new Error(`${name}: unexpected redirect`);
    if (response.headers.get("access-control-allow-origin") !== "*") {
      throw new Error(`${name}: anonymous cross-origin SRI is unavailable`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const integrity = `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
    if (integrity !== asset.integrity) throw new Error(`${name}: integrity mismatch`);
    console.log(`${name}: integrity verified (${bytes.length} bytes)`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
