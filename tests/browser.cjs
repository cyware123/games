const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("fs");
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
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", (r) => {
    if (
      r
        .request()
        .url()
        .startsWith(baseURL + "/") ||
      r.request().url().startsWith("blob:")
    )
      return r.continue();
    external.push(r.request().url());
    return r.abort();
  });
  await page.goto(baseURL);
  await page.waitForSelector(".hero");
  await page.click('nav a[href="#tactica"]');
  await page.waitForSelector("[data-train]");
  assert.equal(await page.locator("[data-train]").count(), 24);
  assert.match(await page.locator("#content").innerText(), /8847|8.847/);
  await page.click('[data-theme="Clavadas"]');
  await page.selectOption("#filter-length", "all");
  assert.match(await page.locator("#content").innerText(), /613 problemas/);
  console.log("Banco de 10.000: filtros de tema y paginación correctos.");
  await page.selectOption("#filter-theme", "all");
  await page.selectOption("#filter-level", "avanzado");
  const id = await page
    .locator("[data-train]")
    .first()
    .getAttribute("data-train");
  const line = await page.evaluate(
    (id) => ENROQUE_PUZZLES.find((t) => t.id === id).line,
    id,
  );
  await page.click(`[data-train="${id}"]`);
  for (let i = 0; i < line.length; i += 2) {
    await move(line[i]);
    if (i + 1 < line.length) await page.waitForTimeout(750);
  }
  assert.match(await page.locator("#status").innerText(), /completado/);
  console.log(
    "Combinación avanzada completada:",
    id,
    line.length,
    "medias jugadas.",
  );
  // Ayuda automática: el destino del propio origen no es intento; tres destinos ilegales sí.
  await page.click('nav a[href="#tactica"]');
  await page.selectOption("#filter-length", "all");
  await page.fill("#filter-query", "00008");
  await page.press("#filter-query", "Tab");
  await page.click('[data-train="lp_00008"]');
  const next = await page.evaluate(
    () => ENROQUE_PUZZLES.find((t) => t.id === "lp_00008").line[0],
  );
  const from = index(next.slice(0, 2));
  const invalid = await page
    .evaluate((from) => {
      const legal = new Position(
        ENROQUE_PUZZLES.find((t) => t.id === "lp_00008").fen,
      );
      return Array.from({ length: 64 }, (_, i) => i).find(
        (i) =>
          i !== from &&
          !legal.b[i] &&
          !legal.moves().some((m) => m.from === from && m.to === i),
      );
    }, from)
    .catch(() => null);
  // Position es léxico global y puede consultarse desde evaluate.
  for (let i = 0; i < 3; i++) {
    await page.click(`[data-square="${from}"]`);
    await page.click(`[data-square="${invalid}"]`);
  }
  assert.match(
    await page.locator("#status").innerText(),
    new RegExp(next.slice(0, 2) + " a " + next.slice(2, 4)),
  );
  assert.equal(await page.locator(".hint-from").count(), 1);
  assert.equal(await page.locator(".hint-to").count(), 1);
  await page.click('[data-action="flip"]');
  await move(next);
  await page.waitForTimeout(750);
  assert.equal(await page.locator(".hint-arrow").count(), 0);
  console.log(
    "Ayuda automática tras tres fallos: casillas de origen/destino y reinicio por paso.",
  );
  await page.click('nav a[href="#tactica"]');
  await page.selectOption("#filter-length", "all");
  await page.fill("#filter-query", "008o6");
  await page.press("#filter-query", "Tab");
  await page.click('[data-train="lp_008o6"]');
  await move("f1f8");
  assert.match(await page.locator("#status").innerText(), /completado/);
  console.log("Mate alternativo aceptado.");
  await page.click('nav a[href="#aperturas"]');
  await page.waitForSelector("[data-course]");
  await page.fill("#opening-search", "siciliana");
  await page.click('[data-action="opening-search"]');
  assert.ok((await page.locator("[data-course]").count()) >= 1);
  await page.locator("[data-course]").first().click();
  await page.selectOption("#course-side", "b");
  await page.selectOption("#course-mode", "train");
  await page.waitForTimeout(750);
  const expected = await page.evaluate(
    () =>
      COURSES.openings.find((o) => o.name === "Sicilian Defense").variants[0]
        .line,
  );
  for (let i = 1; i < expected.length; i += 2) {
    await move(expected[i]);
    if (i + 1 < expected.length) await page.waitForTimeout(750);
  }
  assert.match(await page.locator("#status").innerText(), /completada/);
  console.log("Catálogo ECO: búsqueda española y práctica con negras.");
  await page.click('nav a[href="#practicar"]');
  await page.selectOption("#analysis-time", "1000");
  await page.selectOption("#strength", "6");
  await move("e2e4");
  await page.waitForFunction(
    () =>
      document.querySelector("#moves").innerText.split("\n").length >= 2 &&
      !document.querySelector('[data-square="52"]').disabled,
    null,
    { timeout: 30000 },
  );
  assert.match(await page.locator("#analysis").innerText(), /Stockfish/);
  assert.ok((await page.locator(".analysis-line").count()) >= 2);
  console.log("Rival Stockfish y análisis MultiPV reales.");
  await page.click('[data-action="import-pgn"]');
  await page.fill("#pgn-text", '[Event "Prueba"]\n\n1. f3 e5 2. g4 Qh4#');
  await page.click("[data-load-pgn]");
  await page.waitForSelector("#replay-list");
  assert.equal(await page.locator("[data-replay-to]").count(), 4);
  await page.selectOption("#analysis-time", "1000");
  await page.click('[data-action="analyze-pgn"]');
  await page.waitForFunction(
    () => document.querySelector("#status").innerText.includes("terminado"),
    null,
    { timeout: 40000 },
  );
  assert.match(
    await page.locator("#game-analysis-list").innerText(),
    /Error importante/,
  );
  console.log(
    "Importación PGN y análisis completo con detección de mate perdido.",
  );
  await page.click('nav a[href="#finales"]');
  await page.click('[data-lab="1"]');
  await page.selectOption("#analysis-time", "1000");
  assert.match(await page.locator(".lab-objective").innerText(), /Torre y rey/);
  await page.click('[data-action="analyze"]');
  await page.waitForFunction(
    () => document.querySelector("#analysis").innerText.includes("Stockfish"),
    null,
    { timeout: 20000 },
  );
  console.log("Laboratorio de final con análisis real.");
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "inicio",
      "tactica",
      "aperturas",
      "academia",
      "finales",
      "repaso",
      "progreso",
      "practicar",
    ]) {
      await page.goto(baseURL + "/#" + route);
      await page.waitForTimeout(50);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        width + " " + route,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL + "/#tactica");
  fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
  await page.screenshot({
    path: path.join(root, "test-results/enroque-pro-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "Responsive en cuatro tamaños, cero errores y cero peticiones externas.",
  );
  await browser.close();
  server.close();
  function index(s) {
    return (8 - Number(s[1])) * 8 + "abcdefgh".indexOf(s[0]);
  }
  async function move(u) {
    await page.click(`[data-square="${index(u.slice(0, 2))}"]`);
    await page.click(`[data-square="${index(u.slice(2, 4))}"]`);
    if (u[4]) await page.click(`[data-promotion="${u[4]}"]`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
