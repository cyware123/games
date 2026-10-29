const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
process.chdir(root);
const files = {
    "src/stockfish-17.1-lite-single-03e3232.js": "engine/stockfish.js",
    "src/stockfish-17.1-lite-single-03e3232.wasm": "engine/stockfish.wasm",
  },
  expected = {
    "src/stockfish-17.1-lite-single-03e3232.js":
      "1c8265e52fdaef797684b4979b42c5dcfe0350df3e11a87e48e4ec5f86e0ca5c",
    "src/stockfish-17.1-lite-single-03e3232.wasm":
      "7ca31bedd166148931a1cc84dbd8dd9cf001744e9994caf23a3c6ff4988d7086",
  };
for (const [source, target] of Object.entries(files)) {
  const raw = fs.readFileSync(
    path.join(root, "node_modules/stockfish", source),
  );
  const actual = crypto.createHash("sha256").update(raw).digest("hex");
  if (actual !== expected[source])
    throw new Error("Stockfish SHA256 mismatch: " + source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, raw);
}
fs.copyFileSync("node_modules/stockfish/Copying.txt", "engine/COPYING.txt");
const source = fs.readFileSync("engine/stockfish.js", "utf8");
const wasm = fs.readFileSync("engine/stockfish.wasm");
const compatibilityFile =
  "node_modules/stockfish/src/stockfish-17.1-asm-341ff22.js";
const compatibility = fs.readFileSync(compatibilityFile, "utf8");
const compatibilityHash = crypto
  .createHash("sha256")
  .update(compatibility)
  .digest("hex");
if (
  compatibilityHash !==
  "3651fc70f951d14fdc90f7497941ab62d59c9e70b967a451a69f92b3a3f377f0"
)
  throw new Error("Stockfish JS compatibility checksum mismatch.");
const embedded = {
  version: "Stockfish 17.1 lite",
  compatibilitySource: compatibility,
  compatibilitySHA256: compatibilityHash,
  source,
  wasmBase64: wasm.toString("base64"),
  wasmSHA256: crypto.createHash("sha256").update(wasm).digest("hex"),
};
fs.writeFileSync(
  "engine/embedded.js",
  "/* Stockfish.js 17.1 · GPLv3. Unmodified engine and WASM encoded for local-file use. See COPYING.txt and corresponding source. */\nwindow.ENROQUE_ENGINE = " +
    JSON.stringify(embedded) +
    ";\n",
);
console.log(
  "Stockfish 17.1 lite verificado y preparado para abrir index.html sin servidor.",
);
