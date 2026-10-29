const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const { Chess } = require("chess.js");
const window = {};
global.window = window;
vm.runInThisContext(
  fs.readFileSync(
    require("path").join(__dirname, "../data/puzzles.js"),
    "utf8",
  ),
);
vm.runInThisContext(
  fs.readFileSync(
    require("path").join(__dirname, "../data/openings.js"),
    "utf8",
  ),
);
vm.runInThisContext(
  fs
    .readFileSync(require("path").join(__dirname, "../app.js"), "utf8")
    .split("/* Interfaz:")[0] +
    "\nglobalThis.Position=Position;globalThis.TRAINING=TRAINING;globalThis.COURSES=COURSES;globalThis.ENDGAME_LABS=ENDGAME_LABS;",
);
let n = 0,
  plies = 0;
for (const t of TRAINING) {
  const p = new Position(t.fen),
    c = new Chess(t.fen);
  for (const u of t.line) {
    assert.ok(p.play(u), t.id + " " + u);
    c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    plies++;
  }
  if (t.goal === "mate") {
    assert.ok(c.isCheckmate(), t.id);
    assert.ok(p.check());
    assert.equal(p.moves().length, 0);
  }
  if (++n % 2000 === 0) console.log(n + " problemas verificados");
}
assert.equal(n, 10000);
console.log(
  "10.000 problemas, " +
    plies +
    " medias jugadas y mates contrastados en dos motores.",
);
let lines = 0;
for (const o of COURSES.openings)
  for (const v of o.variants) {
    const p = new Position();
    for (const u of v.line) assert.ok(p.play(u), v.id + " " + u);
    lines++;
  }
assert.equal(lines, 3865);
console.log("3.865 líneas ECO legales.");
for (const lab of ENDGAME_LABS) {
  const c = new Chess(lab.fen),
    p = new Position(lab.fen);
  assert.ok(p.moves().length, lab.name);
  assert.ok(!c.isGameOver(), lab.name);
}
console.log("12 posiciones de laboratorio válidas.");
let alternate = null;
for (const t of TRAINING.filter(
  (t) => t.line.length === 1 && t.goal === "mate",
)) {
  const p = new Position(t.fen);
  for (const m of p.moves()) {
    if (Position.uci(m) === t.line[0]) continue;
    p.make(m);
    const mate = p.check() && !p.moves().length;
    p.undo();
    if (mate) {
      alternate = { id: t.id, move: Position.uci(m) };
      break;
    }
  }
  if (alternate) break;
}
assert.ok(alternate);
console.log("Mate alternativo para prueba", alternate);

function perft(p, d) {
  if (!d) return 1;
  let total = 0;
  for (const m of p.moves()) {
    p.make(m);
    total += perft(p, d - 1);
    p.undo();
  }
  return total;
}
for (const [fen, counts] of [
  [Position.START, [20, 400, 8902, 197281]],
  [
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    [48, 2039, 97862],
  ],
]) {
  const p = new Position(fen);
  counts.forEach((n, i) => assert.equal(perft(p, i + 1), n));
}
console.log("Perft inicial hasta 4 y Kiwipete hasta 3 aprobados.");
