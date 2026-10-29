# Fuentes y atribuciones

## Problemas de Lichess · CC0

Origen del banco y documentación de su formato: https://database.lichess.org/#puzzles

Subconjunto público de 10.000 filas obtenido de:
https://github.com/Ali-Raza764/chess_puzzles_api/blob/94e65c36af8358a04d3c835984435845fc638fe3/puzzles_10000.csv

SHA256 del CSV original:
`9216f3af0f56b5f8b9e6a0a4a0fbb6c0dd63c6762aa9f7f3e78db10fc93c2564`

Los hechos y soluciones del banco de problemas de Lichess se distribuyen bajo CC0. Se conservan ID, rating, etiquetas y referencia a la partida. La fecha de recuperación es 2026-10-29; los ratings pertenecen a la instantánea del subconjunto, no a una consulta en tiempo real.

Transformación importante: en el formato de Lichess, la primera jugada del campo Moves es el movimiento que prepara el problema. Se ejecuta primero sobre el FEN de origen; el usuario empieza con el bando contrario y resuelve las jugadas restantes. Las 10.000 secuencias se validaron como legales. No se afirma haber reevaluado exhaustivamente cada problema a profundidad ilimitada.

## Catálogo de aperturas · CC0

https://github.com/lichess-org/chess-openings

Revisión fijada: `e76b8b4ec5c8aeeba41dac6caf4a60b938f652db`.
Se importan a.tsv, b.tsv, c.tsv, d.tsv y e.tsv. Licencia en `data/CC0.txt`. La conversión PGN → UCI se valida con chess.js. Los nombres oficiales se conservan; no se atribuyen anotaciones humanas que el catálogo no contiene.

## Stockfish.js 17.1 · GPLv3

https://github.com/nmrugg/stockfish.js
https://www.npmjs.com/package/stockfish/v/17.1.0

Versión npm exacta: 17.1.0. Revisión indicada por el paquete: `602fd7e1a571a2be71f242942db90483731f2a1f`.

La herramienta de preparación utiliza sin modificar los binarios lite single-thread originales (los originales separados son archivos de desarrollo; no se necesitan para ejecutar la aplicación):

- `stockfish-17.1-lite-single-03e3232.js` → `engine/stockfish.js`
- `stockfish-17.1-lite-single-03e3232.wasm` → `engine/stockfish.wasm`

Para permitir la apertura directa del HTML, `engine/embedded.js` contiene el JavaScript original como texto y el módulo original como Base64. El adaptador crea un Worker Blob y le transfiere los bytes del módulo; incorpora la propiedad Emscripten `wasmBinary` a la configuración del cargador del Worker. Esa adaptación del cargador está en `engine/uci.js` y no cambia los bytes del módulo ni la red. No se usa fetch/XHR para cargarlos. El HTML portátil contiene los mismos activos. El encabezado original de autoría se conserva. Licencia íntegra en `engine/COPYING.txt`. El archivo `engine/stockfish-corresponding-source.tar.gz` incluye código fuente de la revisión exacta, scripts de compilación y la red lite `nn-9067e33176e8.nnue`. Se omiten binarios generados, ejemplos, node_modules y redes de otras ediciones.

La red lite se recuperó del archivo del proyecto original y se comprobó su SHA256 contra su nombre: comienza por `9067e33176e8`. Las instrucciones de compilación originales están en el README y build.js de ese archivo. No se recompiló ni se sustituyó el WASM por un motor propio.

Stockfish original: https://github.com/official-stockfish/Stockfish
Autores y créditos adicionales en el encabezado del motor y su distribución fuente.

## chess.js 1.4.0 · BSD-2-Clause

https://github.com/jhlywa/chess.js

Se incluye localmente para PGN, FEN y validación. La edición de navegador se envuelve en una función y expone `window.ChessRules`; se conserva la implementación y se elimina únicamente la sintaxis de exportación ESM. Licencia en `vendor/LICENSE`.

Los SHA256 de los activos preparados están en `ASSETS.sha256`. Las herramientas de reconstrucción fijan las fuentes y mantienen la verificación de integridad.

### Compatibilidad JavaScript de Stockfish 17.1

También se incluye la edición oficial `stockfish-17.1-asm-341ff22.js` del mismo paquete npm 17.1.0. Se conserva sin modificar en `engine/embedded.js` como `compatibilitySource`. SHA256 original: `3651fc70f951d14fdc90f7497941ab62d59c9e70b967a451a69f92b3a3f377f0`. Tiene la misma licencia GPLv3 y procede de la misma revisión fuente del paquete. No es el antiguo motor propio de la aplicación. El adaptador puede ejecutarla sin WebAssembly y la selecciona automáticamente si el arranque WebAssembly falla.
