const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  for (const scenario of [
    "wasm-memory",
    "javascript-only",
    "automatic-fallback",
  ]) {
    const context = await browser.newContext({ offline: true }),
      p = await context.newPage();
    const errors = [],
      network = [];
    p.on("pageerror", (e) => errors.push(e.message));
    context.on("request", (r) => {
      if (/^https?:|^file:/.test(r.url())) network.push(r.url());
    });
    await p.addScriptTag({ path: path.join(root, "engine/embedded.js") });
    await p.addScriptTag({ path: path.join(root, "engine/uci.js") });
    const result = await p.evaluate(async (scenario) => {
      const deny =
        'self.fetch=function(){throw new Error("Network forbidden in this test");};self.XMLHttpRequest=function(){throw new Error("XHR forbidden in this test");};\n';
      ENROQUE_ENGINE.source = deny + ENROQUE_ENGINE.source;
      ENROQUE_ENGINE.compatibilitySource =
        deny + ENROQUE_ENGINE.compatibilitySource;
      if (scenario === "automatic-fallback") ENROQUE_ENGINE.wasmBase64 = "AA==";
      const engine = new StockfishClient({
        mode:
          scenario === "javascript-only"
            ? "js"
            : scenario === "wasm-memory"
              ? "wasm"
              : "auto",
      });
      try {
        const r = await engine.search("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", {
          ms: 1000,
          multiPV: 1,
        });
        return { ...r, diagnostics: engine.startupDiagnostics };
      } finally {
        engine.cancel();
      }
    }, scenario);
    assert.equal(result.move, "g6g7");
    assert.equal(result.scoreType, "mate");
    assert.equal(result.mode, scenario === "wasm-memory" ? "wasm" : "js");
    if (scenario === "automatic-fallback")
      assert.ok(result.diagnostics.length >= 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    console.log(
      scenario +
        ": Stockfish da mate sin fetch, XHR ni Internet. Modo " +
        result.mode +
        ".",
    );
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
