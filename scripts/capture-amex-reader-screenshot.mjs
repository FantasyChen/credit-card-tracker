import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const root = process.cwd();
const output = process.argv[2] ?? resolve(root, "release/store-assets/screenshot-1280x800.png");
const bundlePath = resolve(root, "release/.screenshot-entry.js");
await mkdir(resolve(root, "release/store-assets"), { recursive: true });
const bundled = await build({
  entryPoints: [resolve(root, "src/extension/screenshot-entry.ts")],
  outfile: bundlePath,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  charset: "utf8",
  legalComments: "none",
  tsconfig: resolve(root, "tsconfig.json"),
});
void bundled;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>Synthetic AMEX reader screenshot</title><style>html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#dce5ed;color:#344054}body{min-height:800px;background:linear-gradient(180deg,#fff 0 86px,#dce5ed 86px)}header{height:86px;padding:0 44px;display:flex;flex-direction:column;justify-content:center;gap:3px;background:#fff}header strong{font-size:17px}header span{font-size:11px;color:#667085}.synthetic-content{width:820px;padding:56px 58px}.synthetic-card{height:92px;border-radius:16px;background:#fff;padding:24px 30px;box-sizing:border-box}.synthetic-card strong{display:block;font-size:15px}.synthetic-card span{display:block;margin-top:14px;width:240px;height:12px;border-radius:6px;background:#dfe6ed}.synthetic-line{height:18px;margin-top:40px;border-radius:9px;background:#fff;opacity:.8;width:610px}.synthetic-line.short{width:480px;margin-top:22px}</style></head><body><header><strong>Synthetic American Express benefits page</strong><span>Invented E2E page • no provider account data</span></header><main class="synthetic-content"><div class="synthetic-card"><strong>Your card benefits</strong><span></span></div><div class="synthetic-line"></div><div class="synthetic-line short"></div></main></body></html>`);
  await page.addScriptTag({ path: bundlePath });
  await page.locator("#perks-reminder-amex-reader").waitFor({ state: "attached" });
  await page.screenshot({ path: output, fullPage: false });
} finally {
  await browser.close();
  await rm(bundlePath, { force: true });
}
console.log(`Captured shared panel screenshot at ${output}`);
