const fs = require("fs");
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const http = require("node:http"),
  path = require("node:path"),
  root = path.resolve(__dirname, "..");
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  const resolved = file === root ? path.join(root, "index.html") : file;
  if (!resolved.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(resolved);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".json": "application/json",
      }[ext] || "application/octet-stream",
    );
    res.end(data);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseURL = "http://127.0.0.1:" + server.address().port;
  const b = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const p = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(baseURL + "/#aperturas");
  await p.locator("[data-course]").first().click();
  await p.selectOption("#course-mode", "train");
  for (const u of ["d2d4", "c2c4"]) await move(u);
  assert.equal(await p.locator(".hint-to").count(), 0);
  await move("b1c3");
  assert.equal(await p.locator('.hint-from[data-square="52"]').count(), 1);
  assert.equal(await p.locator('.hint-to[data-square="36"]').count(), 1);
  assert.equal(await p.locator(".hint-arrow").count(), 0);
  await move("a2a3");
  assert.equal(await p.locator(".hint-to").count(), 1);
  assert.match(await p.locator("#status").innerText(), /Ayuda/);
  await move("e2e4");
  await p.waitForTimeout(750);
  assert.equal(await p.locator(".hint-to").count(), 0);
  await move("a2a3");
  assert.match(await p.locator("#status").innerText(), /Intento 1 de 3/);
  assert.equal(await p.locator(".hint-to").count(), 0);
  await move("b2b3");
  await move("c2c3");
  assert.equal(await p.locator('.hint-from[data-square="62"]').count(), 1);
  assert.equal(await p.locator('.hint-to[data-square="45"]').count(), 1);
  await move("g1f3");
  await p.waitForTimeout(750);
  assert.equal(await p.locator(".hint-to").count(), 0);
  console.log(
    "Ayuda repetible en cualquier paso: solo tras tres fallos, no tras dos; desaparece con acierto y vuelve tras otros tres.",
  );
  await p.click('nav a[href="#practicar"]');
  await p.selectOption("#analysis-time", "1000");
  for (let i = 0; i < 3; i++) await move("e2e5");
  await p.waitForFunction(() => document.querySelector(".hint-to"), null, {
    timeout: 15000,
  });
  assert.match(await p.locator("#status").innerText(), /Ayuda: mueve/);
  console.log(
    "Tres intentos ilegales en partida activan ayuda calculada por Stockfish.",
  );
  const result = await p.evaluate(async () => {
    let c = new StockfishClient();
    const pending = c.search("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", { ms: 500 });
    c.cancel();
    let cancelled = false;
    try {
      await pending;
    } catch {
      cancelled = true;
    }
    const second = await c.search("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", { ms: 500 });
    c.cancel();
    return { cancelled, move: second.move };
  });
  assert.equal(result.cancelled, true);
  assert.equal(result.move, "g6g7");
  console.log("Cancelar durante carga del motor y volver a usarlo funciona.");
  assert.deepEqual(errors, []);
  await b.close();
  server.close();
  function idx(s) {
    return (8 - Number(s[1])) * 8 + "abcdefgh".indexOf(s[0]);
  }
  async function move(u) {
    await p.click(`[data-square="${idx(u.slice(0, 2))}"]`);
    await p.click(`[data-square="${idx(u.slice(2, 4))}"]`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
