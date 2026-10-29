const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 390, height: 844 },
  });
  let page = await context.newPage();
  const errors = [],
    http = [];
  page.on("pageerror", (e) => errors.push(e.message));
  context.on("request", (r) => {
    if (/^https?:/.test(r.url())) http.push(r.url());
  });
  let mode = "archivo local real";
  try {
    await page.goto(
      pathToFileURL(path.join(root, "enroque-portatil.html")).href,
    );
  } catch (e) {
    if (!/ERR_BLOCKED_BY_ADMINISTRATOR/.test(e.message)) throw e;
    mode = "origen opaco (el navegador administrado bloquea file://)";
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent(
      fs.readFileSync(path.join(root, "enroque-portatil.html"), "utf8"),
    );
  }
  await page.waitForSelector(".hero");
  assert.equal(await page.evaluate(() => ENROQUE_PUZZLES.length), 10000);
  assert.equal(await page.evaluate(() => ENROQUE_OPENINGS.length), 3865);
  const engine = await page.evaluate(async () => {
    const c = new StockfishClient();
    try {
      return await c.search("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", {
        ms: 700,
        multiPV: 3,
      });
    } finally {
      c.cancel();
    }
  });
  assert.equal(engine.move, "g6g7");
  assert.equal(engine.scoreType, "mate");
  await page.click('nav a[href="#practicar"]');
  await page.selectOption("#analysis-time", "1000");
  await move("e2e4");
  await page.waitForFunction(
    () =>
      document.querySelector("#moves").innerText.split("\n").length >= 2 &&
      !document.querySelector('[data-square="52"]').disabled,
    null,
    { timeout: 25000 },
  );
  assert.match(await page.locator("#analysis").innerText(), /Stockfish/);
  const historyBefore=await page.locator('#moves').innerText();
  await page.selectOption('#engine-preference','js');
  assert.equal(await page.locator('#moves').innerText(),historyBefore);
  await move('g1f3');
  await page.waitForFunction(()=>document.querySelector('#moves').innerText.split('\n').length>=4&&!document.querySelector('[data-square="52"]').disabled,null,{timeout:40000});
  assert.match(await page.locator('#engine-mode').innerText(),/compatibilidad JavaScript/);
  console.log('Modo JavaScript compatible: juega y analiza sin borrar la partida.');
  await page.click('nav a[href="#tactica"]');
  await page.selectOption("#filter-length", "all");
  await page.fill("#filter-query", "00008");
  await page.press("#filter-query", "Tab");
  await page.click('[data-train="lp_00008"]');
  const expected = await page.evaluate(
    () => ENROQUE_PUZZLES.find((t) => t.id === "lp_00008").line[0],
  );
  const from = index(expected.slice(0, 2));
  const invalid = await page.evaluate((from) => {
    const p = new Position(
      ENROQUE_PUZZLES.find((t) => t.id === "lp_00008").fen,
    );
    return Array.from({ length: 64 }, (_, i) => i).find(
      (i) => !p.b[i] && !p.moves().some((m) => m.from === from && m.to === i),
    );
  }, from);
  for (let i = 0; i < 3; i++) {
    await page.click(`[data-square="${from}"]`);
    await page.click(`[data-square="${invalid}"]`);
  }
  assert.equal(await page.locator(".hint-from").count(), 1);
  assert.equal(await page.locator(".hint-to").count(), 1);
  await move(expected);
  await page.waitForTimeout(750);
  assert.equal(await page.locator(".hint-to").count(), 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(http, []);
  console.log("HTML portátil sin servidor ni Internet: " + mode + ".");
  console.log(
    "10.000 problemas, Stockfish real, partida con análisis, ayuda al tercer error y vista móvil: correctos. CERO accesos HTTP.",
  );
  await page.close();
  const multi = await context.newPage();
  await multi.goto("about:blank");
  const multiErrors = [];
  multi.on("pageerror", (e) => multiErrors.push(e.message));
  let html = fs
    .readFileSync(path.join(root, "index.html"), "utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");
  await multi.setContent(html);
  await multi.addStyleTag({ path: path.join(root, "style.css") });
  for (const file of [
    "boot.js",
    "vendor/chess-rules.js",
    "data/puzzles.js",
    "data/openings.js",
    "engine/embedded.js",
    "engine/uci.js",
    "app.js",
  ])
    await multi.addScriptTag({ path: path.join(root, file) });
  await multi.waitForSelector(".hero");
  const result = await multi.evaluate(async () => {
    const e = new StockfishClient();
    try {
      return await e.search("7k/8/5KQ1/8/8/8/8/8 w - - 0 1", { ms: 400 });
    } finally {
      e.cancel();
    }
  });
  assert.equal(result.move, "g6g7");
  assert.deepEqual(multiErrors, []);
  assert.deepEqual(http, []);
  console.log(
    "Edición con HTML, CSS y JS separados: inicia y calcula sin origen HTTP.",
  );
  await browser.close();
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
