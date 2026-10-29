# Enroque · Stockfish y entrenamiento personal

Aplicación de ajedrez en español para PC, tableta y celular. Funciona sin Internet cuando se conserva la carpeta completa. No usa cuentas, APIs de juego ni un CDN.

## Abrir sin instalar ni ejecutar otros programas

1. Extrae el ZIP completo.
2. Abre **index.html** con doble clic en Chrome, Edge o Firefox actualizado.
3. También puedes abrir **enroque-portatil.html**: contiene la aplicación, los estilos, las reglas, el banco completo y Stockfish en un solo HTML. Ese archivo se puede copiar solo, sin el resto de carpetas.

No hay BAT, PowerShell, Python, npm ni servidor necesarios para jugar. HTML, CSS y JavaScript se mantienen separados para editar el proyecto; el HTML portátil es una edición generada con esos mismos archivos.

Stockfish se prepara dentro de `engine/embedded.js`. JavaScript crea el motor y su módulo de memoria desde datos ya incluidos en el archivo, mediante URL Blob. No se intenta descargar un `.wasm` a través de `file://` ni se hace una petición HTTP. El módulo de Stockfish y su red NNUE siguen siendo los originales.

### Celular

El diseño es responsive. La opción más sencilla para transferirlo es **enroque-portatil.html**, que no depende de archivos vecinos. Ábrelo con un navegador que permita JavaScript en archivos locales; algunos visores de documentos no ejecutan aplicaciones web. No se hicieron pruebas en teléfonos físicos y no se garantiza que todos los gestores de archivos móviles permitan abrir HTML interactivo.

## Banco de problemas

Se incluyen **10.000 problemas de partidas reales de Lichess**, distribuidos bajo CC0:

| Dificultad del problema | Rating del problema | Cantidad |
|---|---|---:|
| Principiante | Menos de 1400 | 4.537 |
| Intermedio | 1400 a 1999 | 3.376 |
| Avanzado | 2000 o más | 2.087 |

**8.847 requieren más de una decisión del alumno.** La vista inicial prioriza esas combinaciones. Se puede incluir mate en una y otras soluciones cortas mediante el filtro de extensión.

Los temas se superponen, porque una combinación puede tener varios motivos:

| Tema | Problemas |
|---|---:|
| Clavadas | 613 |
| Ataques dobles | 1.387 |
| Descubiertas | 556 |
| Sacrificios | 732 |
| Defensa | 602 |
| Mates | 2.550 |

Hay búsqueda por ID, nivel, tema, duración y estado; paginación y selección aleatoria. Se conserva el ID original y el rating de la instantánea. El rating del problema no es un Elo certificado del usuario.

Las respuestas del rival pertenecen a la solución de Lichess. Los mates alternativos legales se aceptan. Otras alternativas se contrastan con Stockfish: se exige profundidad mínima 12, una ventaja dentro de 25 centipeones de la mejor línea calculada o una continuación de mate comprobada. Si el cálculo no basta, no se inventa un veredicto. Esta comprobación es limitada por el tiempo y no equivale a una demostración matemática.

### Ayuda tras tres errores

- El contador pertenece a **cada decisión**, no a toda la partida.
- Seleccionar una pieza no cuenta como error.
- Después del tercer intento incorrecto se marcan la casilla de origen y la de destino, con texto como **«Mueve de f6 a h5»**.
- La pieza no se mueve automáticamente.
- Al acertar desaparecen las marcas y el siguiente paso comienza con un contador nuevo.
- Si se continúa fallando en el mismo paso, la ayuda reaparece. No hay un límite de una ayuda por ejercicio.
- Funciona en problemas, repertorio y repasos. En partidas libres/contra el motor, tres intentos ilegales activan una sugerencia calculada por Stockfish. Las jugadas legales en una partida se permiten; su calidad se analiza después.
- Resolver con ayuda queda registrado como repaso pendiente.

## Aperturas y finales

- **3.865 líneas ECO**, procedentes del catálogo público de Lichess, agrupadas por familias. Modos Aprender y Practicar con blancas o negras. Algunas entradas son nombres introductorios de una sola jugada: no incluyen decisiones de negras. Hay 7.710 recorridos con al menos una decisión del color elegido.
- Planes, riesgos y consejos en español para ocho familias principales. Los nombres oficiales de variantes se conservan en inglés. El catálogo no se presenta como miles de lecciones anotadas por un maestro.
- **4.660 problemas de finales**, incluidos dentro de los 10.000, con etiquetas de peones, torres, damas y piezas menores.
- **12 posiciones de laboratorio**: rey y dama, rey y torre, dos alfiles, alfil y caballo, oposición, peones pasados, peón de torre, torre y peón, carreras de peones y defensa. En el laboratorio el rival responde con Stockfish, sin una secuencia de respuestas fija.

## Rival y análisis

**Stockfish 17.1 lite single-thread NNUE**, funcionando localmente. Seis ajustes de habilidad (0, 4, 8, 12, 16 y 20). El análisis utiliza fuerza máxima independientemente del nivel elegido para el rival.

Tiempo seleccionable de 1, 2,5, 5 o 10 segundos. Análisis de posición y comparación antes/después de tus jugadas con hasta tres variantes principales (MultiPV), profundidad real y pérdida de evaluación. El tiempo y la profundidad limitan el resultado; el nivel elegido no se anuncia como un Elo certificado. La edición lite utiliza una red más pequeña que el Stockfish completo.

Incluye:

- Importación y exportación **PGN**.
- Reproducción de partidas jugada a jugada.
- Análisis de una partida PGN completa, con cancelación y resultados parciales.
- Posiciones **FEN** para practicar desde un punto concreto.
- Repaso interactivo de los errores detectados.
- Reglas legales, enroques, captura al paso, coronaciones y detección de finales.

Las etiquetas de calidad usan umbrales de pérdida estimada (60/120/250 centipeones). No son una reproducción de las métricas propietarias de Chess.com ni una certificación pedagógica. No se incluye juego en línea, matchmaking, cuentas ni cursos privados de otras plataformas.

## Audio y progreso

Audio seleccionable español/inglés mediante las voces del sistema; las lecciones incluyen texto de voz traducido. Para oírlo sin conexión debe existir una voz local instalada. Si no hay voz disponible, la aplicación avisa y permite seguir con texto. No se garantiza la disponibilidad de voces en todos los dispositivos.

El progreso y los errores se guardan en el navegador. Exporta el JSON desde **Mi progreso** para conservar una copia o llevarlo a otro dispositivo. No hay sincronización automática. Los aciertos sin ayuda programan repasos a 1, 3 y 7 días.

## Estructura y licencias

```
index.html               Página para abrir directamente
style.css                Diseño responsive
app.js                   Entrenamiento e interfaz
enroque-portatil.html    Aplicación completa en un solo HTML
boot.js                  Diagnóstico de archivos incompletos
engine/embedded.js       Stockfish y su módulo incluidos en JavaScript
engine/uci.js            Comunicación con el motor en segundo plano
engine/                  Licencia y código fuente correspondiente
vendor/                  chess.js y licencia BSD
data/                    Bancos locales CC0 y manifiesto
```

Consulta **SOURCES.md**, **ASSETS.sha256** y `engine/COPYING.txt`. El código fuente correspondiente a Stockfish se incluye en `engine/stockfish-corresponding-source.tar.gz`, con la red lite y las instrucciones de compilación del proyecto original.

## Desarrollo y pruebas

Los usuarios no necesitan instalar dependencias. Para desarrollar o reconstruir datos:

```
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run test:local
npm run data:build
npm run engine:prepare
npm run build:portable
```

La última orden requiere Internet para descargar las fuentes fijadas por commit y verificar sus SHA256. La aplicación preparada no la ejecuta al iniciar.

Validación realizada:

- Los 10.000 problemas y sus 36.614 medias jugadas se contrastaron con dos implementaciones de reglas; se verificaron las posiciones finales de mate.
- Las 3.865 líneas ECO y las 12 posiciones de laboratorio son legales.
- Perft inicial hasta profundidad 4 y Kiwipete hasta profundidad 3.
- Chromium: ejercicios avanzados, mates alternativos, ayuda repetida tras tres fallos, repertorio con negras, Stockfish real, MultiPV, importación y análisis PGN, finales y navegación.
- Ocho secciones y tamaños de 360, 390, 768 y 1440 px. Las pruebas bloquean solicitudes fuera del servidor local.
- La prueba local intenta abrir el HTML con `file://`. El navegador administrado del entorno bloquea esas direcciones; en ese caso prueba el mismo HTML en un origen opaco con Internet desactivado. Stockfish, partida, análisis, datos y ayuda funcionan allí sin solicitudes HTTP ni descarga de archivos locales. No se ejecutó una prueba en un Windows físico ni en teléfonos físicos.
