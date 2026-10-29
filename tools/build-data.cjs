const fs = require("fs"),
  { Chess } = require("chess.js"),
  crypto = require("crypto");
process.chdir(require("node:path").resolve(__dirname, ".."));
process.chdir(require("node:path").resolve(__dirname, ".."));
const rows = JSON.parse(
  fs.readFileSync("data/.build-cache/puzzle-rows.json", "utf8"),
);
const themes = {
  pin: "Clavadas",
  fork: "Ataques dobles",
  discoveredAttack: "Descubiertas",
  sacrifice: "Sacrificios",
  defensiveMove: "Defensa",
  mate: "Mates",
  deflection: "Desvíos",
  attraction: "Atracción",
  clearance: "Despeje",
  interference: "Interferencia",
  skewer: "Enfiladas",
  xRayAttack: "Rayos X",
  zugzwang: "Zugzwang",
  trappedPiece: "Piezas atrapadas",
  promotion: "Coronación",
  underPromotion: "Subpromoción",
  hangingPiece: "Piezas indefensas",
  backRankMate: "Mate de pasillo",
  smotheredMate: "Mate de la coz",
  queenEndgame: "Final de damas",
  rookEndgame: "Final de torres",
  pawnEndgame: "Final de peones",
  bishopEndgame: "Final de alfiles",
  knightEndgame: "Final de caballos",
  queenRookEndgame: "Dama y torre",
  endgame: "Finales",
};
const lessons = {
  pin: "Identifica la pieza clavada y la pieza valiosa que está detrás. Aumenta la presión sin abandonar la seguridad de tu rey.",
  fork: "Busca una jugada que amenace dos objetivos. Los jaques pueden ganar el tiempo necesario para ejecutar el ataque doble.",
  discoveredAttack:
    "Al mover una pieza puedes abrir la línea de otra. Calcula las dos amenazas resultantes.",
  sacrifice:
    "Calcula las continuaciones forzadas antes de entregar material. La compensación debe ser concreta: mate, recuperación o una ventaja verificable.",
  defensiveMove:
    "Identifica primero la amenaza del rival. Busca la defensa que conserva la posición y evita responder solo a la amenaza más visible.",
  mate: "Revisa jaques y casillas de escape. Coordina las piezas para cerrar la red, no des jaques sin un objetivo.",
  endgame:
    "Calcula los tiempos y la actividad de ambos reyes. En finales, una casilla o un tiempo puede cambiar el resultado.",
};
const out = [],
  seen = new Set();
let plies = 0,
  multi = 0;
const invalid = [];
for (const r of rows) {
  try {
    if (seen.has(r.PuzzleId)) continue;
    const c = new Chess(r.FEN),
      moves = r.Moves.trim().split(/\s+/);
    if (moves.length < 2) throw Error("Línea demasiado corta");
    const setup = moves.shift();
    c.move({
      from: setup.slice(0, 2),
      to: setup.slice(2, 4),
      promotion: setup[4],
    });
    const fen = c.fen();
    for (const u of moves)
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    const tags = r.Themes.split(" "),
      labels = tags.filter((t) => themes[t]).map((t) => themes[t]);
    const core =
      [
        "pin",
        "fork",
        "discoveredAttack",
        "sacrifice",
        "defensiveMove",
        "mate",
      ].find((t) => tags.includes(t)) ||
      tags.find((t) => themes[t]) ||
      "combination";
    const rating = Number(r.Rating),
      theme = themes[core] || "Combinación";
    out.push({
      id: "lp_" + r.PuzzleId,
      title: theme + " · " + r.PuzzleId,
      rating,
      deviation: Number(r.RatingDeviation),
      level:
        rating < 1400
          ? "principiante"
          : rating < 2000
            ? "intermedio"
            : "avanzado",
      theme,
      themes: [...new Set(labels.length ? labels : ["Combinación"])],
      tags,
      fen,
      line: moves,
      kind: tags.includes("endgame") ? "endgame" : "tactic",
      goal: tags.includes("mate") ? "mate" : "advantage",
      hint:
        lessons[core] || lessons[tags.includes("endgame") ? "endgame" : "pin"],
      explain:
        (lessons[core] ||
          "La secuencia aprovecha una oportunidad táctica concreta.") +
        " La solución pertenece a la base de ejercicios de Lichess.",
      sourceId: r.PuzzleId,
      source: "Lichess · CC0",
      game: r.GameUrl,
      popularity: Number(r.Popularity),
    });
    seen.add(r.PuzzleId);
    plies += moves.length;
    if (moves.length >= 3) multi++;
  } catch (e) {
    invalid.push({ id: r.PuzzleId, error: e.message });
  }
}
fs.writeFileSync(
  "data/puzzles.js",
  "/* Lichess puzzle database subset · CC0. See SOURCES.md. */\nwindow.ENROQUE_PUZZLES=" +
    JSON.stringify(out) +
    ";\n",
);
const openings = [];
for (const r of JSON.parse(
  fs.readFileSync("data/.build-cache/opening-rows.json", "utf8"),
)) {
  const c = new Chess();
  c.loadPgn(r.pgn);
  const h = c.history({ verbose: true });
  openings.push({
    id: "eco" + openings.length,
    eco: r.eco,
    name: r.name,
    line: h.map((m) => m.from + m.to + (m.promotion || "")),
    san: h.map((m) => m.san),
    family: r.name.split(":")[0],
  });
}
fs.writeFileSync(
  "data/openings.js",
  "/* Lichess chess-openings · CC0. See SOURCES.md. */\nwindow.ENROQUE_OPENINGS=" +
    JSON.stringify(openings) +
    ";\n",
);
const manifest = {
  puzzles: out.length,
  multipleMovePuzzles: multi,
  openingLines: openings.length,
  solutionPlies: plies,
  invalid,
  byLevel: Object.fromEntries(
    ["principiante", "intermedio", "avanzado"].map((l) => [
      l,
      out.filter((t) => t.level === l).length,
    ]),
  ),
  coreThemes: Object.fromEntries(
    [
      "Clavadas",
      "Ataques dobles",
      "Descubiertas",
      "Sacrificios",
      "Defensa",
      "Mates",
    ].map((l) => [l, out.filter((t) => t.themes.includes(l)).length]),
  ),
  endgames: out.filter((t) => t.kind === "endgame").length,
  puzzleSource:
    "https://github.com/Ali-Raza764/chess_puzzles_api/tree/94e65c36af8358a04d3c835984435845fc638fe3",
  license: "CC0-1.0",
};
fs.writeFileSync("data/manifest.json", JSON.stringify(manifest, null, 2));
console.log(manifest);
if (invalid.length) process.exitCode = 1;
