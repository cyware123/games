const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace(
  /<link\b[^>]*rel="stylesheet"[^>]*>/gi,
  () =>
    "<style>\n" +
    fs.readFileSync(path.join(root, "style.css"), "utf8") +
    "\n</style>",
);
html = html.replace(
  /<script\b[^>]*src="([^"]+)"[^>]*>\s*<\/script>/gi,
  (_, file) => {
    const script = fs
      .readFileSync(path.join(root, file), "utf8")
      .replace(/<\/script/gi, "<\\/script");
    return (
      "<script>\n/* Embedded local asset: " +
      file +
      " */\n" +
      script +
      "\n</script>"
    );
  },
);
const licenses = {
  stockfish: fs.readFileSync(path.join(root, "engine/COPYING.txt"), "utf8"),
  chessJS: fs.readFileSync(path.join(root, "vendor/LICENSE"), "utf8"),
  stockfishSource:
    "https://github.com/cyware123/games/blob/enroque-stockfish/engine/stockfish-corresponding-source.tar.gz",
};
html = html.replace(
  "</head>",
  "<script>window.ENROQUE_LICENSES=" +
    JSON.stringify(licenses).replace(/<\/script/gi, "<\\/script") +
    ";</script>\n</head>",
);
fs.writeFileSync(path.join(root, "enroque-portatil.html"), html);
console.log(
  "enroque-portatil.html preparado: todos los estilos, datos, reglas y Stockfish incluidos. Sin servidor.",
);
