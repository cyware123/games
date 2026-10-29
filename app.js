"use strict";
/* Enroque: reglas locales. Sin CDN, fuentes remotas ni servicios externos. */
class Position {
  static START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  static square(i) {
    return "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));
  }
  static index(s) {
    return (8 - Number(s[1])) * 8 + "abcdefgh".indexOf(s[0]);
  }
  static color(p) {
    return p === p.toUpperCase() ? "w" : "b";
  }
  constructor(fen = Position.START) {
    if (typeof fen !== "string" || fen.length > 160)
      throw new Error("FEN no válido.");
    const [rows, turn, rights, ep, half, full] = fen.trim().split(/\s+/);
    if (
      !rows ||
      rows.split("/").length !== 8 ||
      !["w", "b"].includes(turn) ||
      !/^(-|K?Q?k?q?)$/.test(rights || "") ||
      !/^(-|[a-h][36])$/.test(ep || "") ||
      !/^\d+$/.test(half || "") ||
      !/^[1-9]\d*$/.test(full || "")
    )
      throw new Error("FEN no válido.");
    for (const row of rows.split("/")) {
      if (
        !/^[prnbqkPRNBQK1-8]+$/.test(row) ||
        [...row].reduce((n, c) => n + (/\d/.test(c) ? Number(c) : 1), 0) !== 8
      )
        throw new Error("Fila FEN no válida.");
    }
    this.b = [];
    for (const ch of rows.replaceAll("/", "")) {
      if (/\d/.test(ch)) this.b.push(...Array(Number(ch)).fill(null));
      else this.b.push(ch);
    }
    if (
      this.b.filter((p) => p === "K").length !== 1 ||
      this.b.filter((p) => p === "k").length !== 1
    )
      throw new Error("El FEN necesita un rey de cada color.");
    this.turn = turn;
    this.rights = rights === "-" ? "" : rights;
    this.ep = ep === "-" ? -1 : Position.index(ep);
    this.half = Number(half);
    this.full = Number(full);
    this.stack = [];
    this.keys = [this.key()];
  }
  fen() {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let s = "",
        n = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.b[r * 8 + f];
        if (!p) n++;
        else {
          if (n) s += n;
          n = 0;
          s += p;
        }
      }
      if (n) s += n;
      rows.push(s);
    }
    return `${rows.join("/")} ${this.turn} ${this.rights || "-"} ${this.ep < 0 ? "-" : Position.square(this.ep)} ${this.half} ${this.full}`;
  }
  key() {
    // Solo incluye la casilla al paso si existe una captura legal.
    let ep = this.ep;
    if (ep >= 0) {
      const dir = this.turn === "w" ? -8 : 8,
        pawn = this.turn === "w" ? "P" : "p";
      let usable = false;
      for (const delta of [-1, 1]) {
        const from = ep - dir + delta;
        if (
          from < 0 ||
          from > 63 ||
          Math.abs((from % 8) - (ep % 8)) !== 1 ||
          this.b[from] !== pawn
        )
          continue;
        const victim = ep - dir,
          captured = this.b[victim];
        if (captured !== (this.turn === "w" ? "p" : "P")) continue;
        this.b[from] = null;
        this.b[victim] = null;
        this.b[ep] = pawn;
        if (!this.check(this.turn)) usable = true;
        this.b[from] = pawn;
        this.b[victim] = captured;
        this.b[ep] = null;
      }
      if (!usable) ep = -1;
    }
    return (
      this.b.map((p) => p || ".").join("") + this.turn + this.rights + ":" + ep
    );
  }
  attacked(i, by) {
    const r = Math.floor(i / 8),
      f = i % 8;
    const pawn = by === "w" ? "P" : "p",
      origin = by === "w" ? r + 1 : r - 1;
    for (const df of [-1, 1])
      if (
        origin >= 0 &&
        origin < 8 &&
        f + df >= 0 &&
        f + df < 8 &&
        this.b[origin * 8 + f + df] === pawn
      )
        return true;
    for (const [dr, df] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]) {
      const nr = r + dr,
        nf = f + df;
      if (
        nr >= 0 &&
        nr < 8 &&
        nf >= 0 &&
        nf < 8 &&
        this.b[nr * 8 + nf] === (by === "w" ? "N" : "n")
      )
        return true;
    }
    for (const [dr, df] of [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]) {
      let nr = r + dr,
        nf = f + df,
        distance = 1;
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        const p = this.b[nr * 8 + nf];
        if (p) {
          if (Position.color(p) === by) {
            const t = p.toLowerCase();
            if (
              t === "q" ||
              (t === "k" && distance === 1) ||
              (t === "b" && dr && df) ||
              (t === "r" && (!dr || !df))
            )
              return true;
          }
          break;
        }
        nr += dr;
        nf += df;
        distance++;
      }
    }
    return false;
  }
  check(color = this.turn) {
    const i = this.b.indexOf(color === "w" ? "K" : "k");
    return i >= 0 && this.attacked(i, color === "w" ? "b" : "w");
  }
  pseudo() {
    const list = [],
      side = this.turn,
      other = side === "w" ? "b" : "w";
    const add = (from, to, extra = {}) => {
      if (this.b[to]?.toLowerCase() === "k") return;
      if (this.b[from].toLowerCase() === "p" && (to < 8 || to >= 56)) {
        for (const promotion of ["q", "r", "b", "n"])
          list.push({ from, to, promotion, ...extra });
      } else list.push({ from, to, ...extra });
    };
    for (let i = 0; i < 64; i++) {
      const p = this.b[i];
      if (!p || Position.color(p) !== side) continue;
      const t = p.toLowerCase(),
        r = Math.floor(i / 8),
        f = i % 8;
      if (t === "p") {
        const dir = side === "w" ? -8 : 8,
          to = i + dir;
        if (to >= 0 && to < 64 && !this.b[to]) {
          add(i, to);
          if (r === (side === "w" ? 6 : 1) && !this.b[to + dir])
            add(i, to + dir);
        }
        for (const df of [-1, 1]) {
          const j = to + df;
          if (f + df < 0 || f + df > 7 || j < 0 || j > 63) continue;
          if (this.b[j] && Position.color(this.b[j]) === other) add(i, j);
          else if (
            j === this.ep &&
            this.b[j - dir] === (side === "w" ? "p" : "P")
          )
            add(i, j, { ep: true });
        }
      } else {
        const dirs =
          t === "n"
            ? [
                [-2, -1],
                [-2, 1],
                [-1, -2],
                [-1, 2],
                [1, -2],
                [1, 2],
                [2, -1],
                [2, 1],
              ]
            : t === "b"
              ? [
                  [-1, -1],
                  [-1, 1],
                  [1, -1],
                  [1, 1],
                ]
              : t === "r"
                ? [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                  ]
                : [
                    [-1, -1],
                    [-1, 0],
                    [-1, 1],
                    [0, -1],
                    [0, 1],
                    [1, -1],
                    [1, 0],
                    [1, 1],
                  ];
        for (const [dr, df] of dirs) {
          let nr = r + dr,
            nf = f + df;
          while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
            const j = nr * 8 + nf;
            if (!this.b[j] || Position.color(this.b[j]) !== side) add(i, j);
            if (this.b[j] || t === "n" || t === "k") break;
            nr += dr;
            nf += df;
          }
        }
        if (t === "k" && !this.check(side)) {
          const base = side === "w" ? 60 : 4,
            rook = side === "w" ? "R" : "r";
          if (
            i === base &&
            this.rights.includes(side === "w" ? "K" : "k") &&
            this.b[base + 3] === rook &&
            !this.b[base + 1] &&
            !this.b[base + 2] &&
            !this.attacked(base + 1, other) &&
            !this.attacked(base + 2, other)
          )
            add(i, base + 2, { castle: true });
          if (
            i === base &&
            this.rights.includes(side === "w" ? "Q" : "q") &&
            this.b[base - 4] === rook &&
            !this.b[base - 1] &&
            !this.b[base - 2] &&
            !this.b[base - 3] &&
            !this.attacked(base - 1, other) &&
            !this.attacked(base - 2, other)
          )
            add(i, base - 2, { castle: true });
        }
      }
    }
    return list;
  }
  moves() {
    const side = this.turn,
      result = [];
    for (const m of this.pseudo()) {
      this.make(m);
      if (!this.check(side)) result.push(m);
      this.undo();
    }
    return result;
  }
  make(m) {
    this.stack.push({
      b: this.b.slice(),
      turn: this.turn,
      rights: this.rights,
      ep: this.ep,
      half: this.half,
      full: this.full,
    });
    const p = this.b[m.from],
      captured = this.b[m.to],
      side = this.turn;
    this.b[m.to] = m.promotion
      ? side === "w"
        ? m.promotion.toUpperCase()
        : m.promotion
      : p;
    this.b[m.from] = null;
    if (m.ep) this.b[m.to + (side === "w" ? 8 : -8)] = null;
    if (m.castle) {
      const rf = m.to > m.from ? m.from + 3 : m.from - 4,
        rt = m.to > m.from ? m.from + 1 : m.from - 1;
      this.b[rt] = this.b[rf];
      this.b[rf] = null;
    }
    if (p === "K") this.rights = this.rights.replace(/[KQ]/g, "");
    if (p === "k") this.rights = this.rights.replace(/[kq]/g, "");
    for (const [sq, right] of [
      [0, "q"],
      [7, "k"],
      [56, "Q"],
      [63, "K"],
    ])
      if (m.from === sq || m.to === sq)
        this.rights = this.rights.replace(right, "");
    this.ep =
      p.toLowerCase() === "p" && Math.abs(m.to - m.from) === 16
        ? (m.to + m.from) / 2
        : -1;
    this.half = p.toLowerCase() === "p" || captured || m.ep ? 0 : this.half + 1;
    if (side === "b") this.full++;
    this.turn = side === "w" ? "b" : "w";
    this.keys.push(this.key());
  }
  undo() {
    const state = this.stack.pop();
    if (!state) return false;
    Object.assign(this, state);
    this.keys.pop();
    return true;
  }
  play(uci) {
    const m = this.moves().find((m) => Position.uci(m) === uci);
    if (!m) return null;
    this.make(m);
    return m;
  }
  static uci(m) {
    return (
      Position.square(m.from) + Position.square(m.to) + (m.promotion || "")
    );
  }
  draw() {
    if (
      this.half >= 100 ||
      this.keys.filter((k) => k === this.keys.at(-1)).length >= 3
    )
      return true;
    const material = this.b.flatMap((p, i) =>
      p && p.toLowerCase() !== "k" ? [{ p: p.toLowerCase(), i }] : [],
    );
    if (
      !material.length ||
      (material.length === 1 && ["b", "n"].includes(material[0].p))
    )
      return true;
    return (
      material.length > 0 &&
      material.every((x) => x.p === "b") &&
      new Set(material.map((x) => (Math.floor(x.i / 8) + (x.i % 8)) % 2))
        .size === 1
    );
  }
}
const TRAINING = window.ENROQUE_PUZZLES || [];
const COURSES = {
  lessons: [
    {
      title: "El tablero y el valor de las piezas",
      level: "Primeros pasos",
      icon: "♙",
      body: "El tablero tiene 64 casillas. Colócalo con una casilla blanca en tu esquina inferior derecha. Las columnas van de a a h y las filas de 1 a 8. El objetivo es dar jaque mate, no capturar el rey.",
      items: [
        "Peón: 1 punto. Avanza una casilla y captura en diagonal; desde su origen puede avanzar dos.",
        "Caballo: 3 puntos. Salta en forma de L y puede pasar sobre otras piezas.",
        "Alfil: 3 puntos. Se mueve por diagonales de su color.",
        "Torre: 5 puntos. Recorre filas y columnas. Dama: 9 puntos; combina torre y alfil.",
        "El rey se mueve una casilla. Nunca puede entrar en una casilla atacada.",
      ],
    },
    {
      title: "Los tres principios de la apertura",
      level: "Fundamentos",
      icon: "♘",
      body: "Una apertura sana prepara a todas tus piezas para trabajar juntas. Memorizar muchas jugadas no sustituye entender qué necesita la posición.",
      items: [
        "Controla el centro con peones y piezas. e4 y d4 son buenos puntos de partida.",
        "Desarrolla caballos y alfiles antes de mover muchas veces la misma pieza.",
        "Protege a tu rey con el enroque. No se puede enrocar estando en jaque ni atravesando una casilla atacada.",
        "Evita sacar la dama demasiado pronto: tu rival puede atacarla mientras desarrolla.",
      ],
    },
    {
      title: "Ataques dobles, clavadas y enfiladas",
      level: "Táctica",
      icon: "♕",
      body: "La táctica aprovecha una oportunidad concreta. Antes de mover, revisa jaques, capturas y amenazas de ambos bandos.",
      items: [
        "Ataque doble: una pieza amenaza dos objetivos. El caballo es especialmente peligroso.",
        "Clavada: una pieza no puede moverse sin exponer otra más valiosa. Si detrás está el rey, moverla puede ser ilegal.",
        "Enfilada: atacas primero a la pieza de mayor valor y, cuando se aparta, capturas la que queda detrás.",
        "Ataque descubierto: al mover una pieza, abres una línea de ataque para otra.",
      ],
    },
    {
      title: "Cómo defender una posición difícil",
      level: "Defensa",
      icon: "♜",
      body: "La mejor defensa empieza por identificar exactamente qué amenaza tu rival. Pregúntate qué jugaría si tú pasaras el turno.",
      items: [
        "Ante un jaque: mueve el rey, captura al atacante o bloquea la línea. Un jaque de caballo no se puede bloquear.",
        "Defiende una pieza atacada, muévela o crea una amenaza más urgente; calcula antes de elegir.",
        "Cambia piezas atacantes si reduces la presión sobre tu rey.",
        "Mantén casillas de escape y evita debilitar sin motivo los peones frente al enroque.",
      ],
    },
    {
      title: "Finales: activa tu rey",
      level: "Finales",
      icon: "♔",
      body: "Cuando quedan pocas piezas, el rey pasa de refugiarse a participar. Llevarlo al centro puede decidir el final.",
      items: [
        "En finales de peones, calcula la oposición: los reyes enfrentados se disputan el paso.",
        "Crea un peón pasado: sin peones enemigos delante en su columna ni en las adyacentes.",
        "Coloca las torres detrás de los peones pasados, propios o enemigos.",
        "No confundas mate y ahogado. Si el rival no tiene jugadas legales y no está en jaque, son tablas.",
      ],
    },
    {
      title: "Reglas especiales sin misterio",
      level: "Fundamentos",
      icon: "♗",
      body: "Algunas reglas aparecen pocas veces, pero pueden cambiar una partida. Todas están disponibles en el tablero de práctica.",
      items: [
        "Coronación: al llegar a la última fila, elige dama, torre, alfil o caballo.",
        "Captura al paso: justo después de que un peón rival avance dos casillas, un peón adyacente puede capturarlo como si hubiese avanzado una.",
        "Enroque: rey y torre no deben haber movido; no debe haber piezas entre ellos ni ataques sobre las casillas que pisa el rey.",
        "También hay tablas por material insuficiente, triple repetición y la regla de cincuenta movimientos.",
      ],
    },
  ],
};
const OPENING_PLANS = {
  "Italian Game": {
    description:
      "Desarrolla rápidamente, controla el centro y coordina el alfil de c4 con el caballo de f3. El ataque a f7 solo funciona si tus piezas llegan a tiempo.",
    plan: "Blancas: prepara c3 y d4 o un desarrollo tranquilo con d3. Negras: desarrolla, enroca y disputa el centro con ...d5 cuando esté preparado.",
    risk: "No sacrifiques en f7 por memoria: calcula las casillas de salida del rey y las piezas que pueden incorporarse.",
  },
  "Ruy Lopez": {
    description:
      "La presión del alfil sobre el caballo de c6 condiciona la defensa del peón e5. La apertura suele convertirse en una lucha larga por el centro.",
    plan: "Blancas: protege e4, completa el desarrollo y prepara d4. Negras: desarrolla, gana espacio en el flanco de dama cuando sea oportuno y busca contrajuego central.",
    risk: "La amenaza sobre e5 no siempre permite capturarlo inmediatamente. Revisa ...Qd4 y las recuperaciones centrales.",
  },
  "Sicilian Defense": {
    description:
      "Las negras responden a e4 con ...c5 para disputar d4 y crear una estructura asimétrica. Las posiciones abiertas exigen coordinación y cálculo concreto.",
    plan: "Blancas: desarrollo rápido, presión central y elección coherente de enroque. Negras: controla d5, desarrolla el alfil y prepara contrajuego en la columna c.",
    risk: "No mezcles planes de la Najdorf, el Dragón y la Alapin. Las estructuras y los tiempos disponibles cambian.",
  },
  "French Defense": {
    description:
      "La cadena e6–d5 desafía el centro blanco. En las posiciones de avance, las negras atacan la base d4 con ...c5 y a menudo la cabeza e5 con ...f6.",
    plan: "Blancas: aprovecha el espacio y vigila la defensa de d4. Negras: rompe el centro y resuelve el desarrollo del alfil de c8.",
    risk: "Una posición cerrada no permite ignorar el desarrollo ni la seguridad del rey. Prepara las rupturas antes de ejecutarlas.",
  },
  "Caro-Kann Defense": {
    description:
      "...c6 prepara ...d5 dejando libre la diagonal del alfil de c8. La estructura suele ser sólida, pero las blancas pueden ganar espacio.",
    plan: "Negras: desarrolla el alfil antes de ...e6 cuando la variante lo permita. Blancas: desarrolla con iniciativa y observa las rupturas ...c5 y ...e5.",
    risk: "No mantengas una estructura sólida a costa de una posición completamente pasiva. Calcula cuándo cambiar el centro.",
  },
  "Queen's Gambit Declined": {
    description:
      "Las negras sostienen d5 con ...e6. La tensión sobre c4 y d5 condiciona el desarrollo y los cambios centrales.",
    plan: "Blancas: desarrolla, presiona el centro y elige el momento de cxd5. Negras: completa el desarrollo y prepara ...c5 o ...e5 para liberar la posición.",
    risk: "El alfil de c8 puede quedar encerrado. Coordina la ruptura liberadora con la seguridad del rey.",
  },
  "English Opening": {
    description:
      "c4 controla d5 y permite elegir entre varias estructuras. Muchas líneas transponen a esquemas de peón de dama.",
    plan: "Desarrolla en función de la estructura que construye el rival. Mantén flexibilidad antes de decidir d4, e4 o un fianchetto.",
    risk: "La flexibilidad no sustituye el control central: evita que el rival ocupe el centro sin presión.",
  },
  "King's Indian Defense": {
    description:
      "Las negras permiten espacio central a cambio de desarrollo y contrajuego. El fianchetto de g7 exige preparar bien las rupturas.",
    plan: "Negras: enroca y prepara ...e5 o ...c5. Blancas: aprovecha el centro y decide si cerrar o mantener la tensión.",
    risk: "No lances los peones del flanco de rey si el centro puede abrirse contra tu propio rey.",
  },
};
// Catálogo oficial de aperturas: familias con variantes, sin inventar líneas.
const OPENING_LINES = window.ENROQUE_OPENINGS || [];
const featured = [
  "Italian Game",
  "Ruy Lopez",
  "Sicilian Defense",
  "French Defense",
  "Caro-Kann Defense",
  "Queen's Gambit Declined",
  "English Opening",
  "King's Indian Defense",
];
const families = new Map();
for (const row of OPENING_LINES) {
  if (!families.has(row.family)) families.set(row.family, []);
  families.get(row.family).push(row);
}
COURSES.openings = [...families]
  .sort((a, b) => {
    const ai = featured.indexOf(a[0]),
      bi = featured.indexOf(b[0]);
    return (
      (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a[0].localeCompare(b[0])
    );
  })
  .map(([family, rows], i) => ({
    name: family,
    icon: ["♘", "♗", "♟", "♜"][i % 4],
    color: ["", "gold", "blue"][i % 3],
    tag: rows[0].eco + " · REPERTORIO",
    description:
      OPENING_PLANS[family]?.description ||
      "Estudia la estructura y los movimientos identificados en la clasificación ECO. Comprueba los planes y las alternativas con Stockfish.",
    notes: [],
    variants: rows.map((r) => ({
      id: r.id,
      name: r.name,
      line: r.line,
      san: r.san,
      eco: r.eco,
    })),
  }));
const COURSE_PATHS = OPENING_LINES.reduce(
  (n, r) => n + (r.line.length >= 2 ? 2 : 1),
  0,
);
const ENDGAME_LABS = [
  {
    name: "Dama y rey",
    fen: "7k/8/8/4K3/2Q5/8/8/8 w - - 0 1",
    side: "w",
    goal: "Coordina rey y dama hasta dar mate. Stockfish elige las respuestas; evita el ahogado.",
  },
  {
    name: "Torre y rey",
    fen: "7k/8/5K2/8/8/8/8/R7 w - - 0 1",
    side: "w",
    goal: "Corta las salidas con la torre y acerca el rey. Completa el mate contra la defensa del motor.",
  },
  {
    name: "Torre con negras",
    fen: "r7/8/8/8/8/5k2/8/7K b - - 0 1",
    side: "b",
    goal: "Entrena el mate de torre jugando con negras. El rival no sigue una respuesta prefijada.",
  },
  {
    name: "Dos alfiles",
    fen: "7k/8/8/8/3K4/2BB4/8/8 w - - 0 1",
    side: "w",
    goal: "Controla diagonales y lleva al rey rival hacia un borde. Practica sin abandonar a tus alfiles.",
  },
  {
    name: "Alfil y caballo",
    fen: "7k/8/8/8/3K4/2BN4/8/8 w - - 0 1",
    side: "w",
    goal: "Final avanzado: coordina alfil, caballo y rey. Estudia cómo orientar al rey rival hacia la esquina del color del alfil.",
  },
  {
    name: "Peón pasado",
    fen: "7k/8/1K6/P7/8/8/8/8 w - - 0 1",
    side: "w",
    goal: "Calcula los tiempos y corona el peón. Después convierte la ventaja con la dama.",
  },
  {
    name: "Oposición",
    fen: "8/8/4k3/8/4K3/4P3/8/8 w - - 0 1",
    side: "w",
    goal: "Explora la oposición y las casillas clave. Comprueba con el análisis qué planes conservan las opciones de progresar.",
  },
  {
    name: "Peón de torre",
    fen: "7k/8/5K1P/8/8/8/8/8 w - - 0 1",
    side: "w",
    goal: "Investiga la limitación del peón de torre y las trampas de ahogado. No supongas que todo peón de ventaja gana.",
  },
  {
    name: "Torre y peón",
    fen: "2K5/k1P5/8/8/8/8/3R4/5r2 w - - 0 1",
    side: "w",
    goal: "Coordina la torre con tu rey y peón pasado. Analiza cómo cubrir los jaques laterales.",
  },
  {
    name: "Defender con torre",
    fen: "8/8/6k1/8/8/5K2/6P1/4R2r b - - 0 1",
    side: "b",
    goal: "Defiende con actividad de torre. Usa jaques y ataques al peón; consulta el análisis antes de cambiar torres.",
  },
  {
    name: "Carrera de peones",
    fen: "7k/1P6/8/8/8/8/6p1/K7 w - - 0 1",
    side: "w",
    goal: "Compara coronaciones con jaque y el orden de los movimientos. Ambos bandos tienen amenazas inmediatas.",
  },
  {
    name: "Dama contra peón",
    fen: "8/8/8/8/2K1Q3/8/2p5/k7 w - - 0 1",
    side: "w",
    goal: "Estudia cómo acercar el rey y detener un peón en séptima. Vigila las posiciones de ahogado.",
  },
];
/* Interfaz: entrenamiento personal con Stockfish y bancos locales. */
(() => {
  const $ = (s) => document.querySelector(s);
  const symbols = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  };
  const names = {
    es: {
      p: "peón",
      n: "caballo",
      b: "alfil",
      r: "torre",
      q: "dama",
      k: "rey",
    },
    en: {
      p: "pawn",
      n: "knight",
      b: "bishop",
      r: "rook",
      q: "queen",
      k: "king",
    },
  };
  const levelNames = {
    principiante: "Principiante",
    intermedio: "Intermedio",
    avanzado: "Avanzado",
  };
  const blank = () => ({
    version: 3,
    items: {},
    courses: [],
    read: [],
    days: [],
    games: 0,
    mistakes: [],
    audio: "off",
  });
  let progress = blank(),
    memoryOnly = false;
  try {
    const saved = JSON.parse(localStorage.getItem("enroque-stockfish-v3"));
    if (
      saved &&
      saved.version === 3 &&
      saved.items &&
      Array.isArray(saved.courses)
    )
      progress = { ...blank(), ...saved };
  } catch {}
  function save() {
    try {
      localStorage.setItem("enroque-stockfish-v3", JSON.stringify(progress));
    } catch {
      memoryOnly = true;
    }
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function activity() {
    if (!progress.days.includes(today())) progress.days.push(today());
    save();
    $("#streak").textContent = streak();
  }
  function streak() {
    let n = 0,
      d = new Date();
    if (!progress.days.includes(today())) d.setDate(d.getDate() - 1);
    while (
      progress.days.includes(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      )
    ) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function item(id) {
    return (
      progress.items[id] ||
      (progress.items[id] = {
        attempts: 0,
        failures: 0,
        solved: false,
        review: false,
        passes: 0,
      })
    );
  }
  function isDue(t) {
    const r = progress.items[t.id];
    return r?.review || (r?.nextReview && r.nextReview <= Date.now());
  }
  function solved(kind) {
    return TRAINING.filter(
      (t) =>
        (kind === "endgame" ? t.kind === "endgame" : true) &&
        progress.items[t.id]?.solved,
    ).length;
  }
  let page = "inicio",
    position = new Position(),
    selected = null,
    last = [],
    flipped = false,
    locked = false,
    complete = false,
    session = 0,
    replyTimer = null;
  let current = null,
    line = [],
    step = 0,
    trainee = "w",
    variantIndex = 0,
    courseIndex = 0,
    courseMode = "learn",
    courseSide = "w";
  let filter = {
      level: "all",
      theme: "all",
      status: "all",
      length: "multi",
      query: "",
    },
    practiceSide = "w",
    practiceMode = "bot",
    strength = "2",
    records = [],
    counted = false,
    hinted = false,
    failedThisRun = false;
  let wrongAtStep = 0,
    hintMove = null;
  let replayFen = Position.START,
    replayMoves = [],
    replayIndex = 0,
    replayAnalyses = [];
  let bankPage = 0,
    openingPage = 0,
    openingQuery = "",
    openingEco = "all",
    practiceInitial = Position.START,
    analysisMs = 2500;
  const stockfish = new window.StockfishClient();
  function analyze(fen, options = {}) {
    return stockfish.search(fen, options);
  }
  function cancel() {
    session++;
    wrongAtStep = 0;
    hintMove = null;
    clearTimeout(replyTimer);
    locked = false;
    selected = null;
    last = [];
    complete = false;
    window.speechSynthesis?.cancel();
    stockfish.cancel();
  }
  function toast(text) {
    let el = $("#voice-feedback");
    if (!el) {
      el = document.createElement("div");
      el.id = "voice-feedback";
      el.setAttribute("role", "status");
      document.body.append(el);
    }
    el.textContent = text;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (el.textContent = ""), 6000);
  }
  function speak(es, en) {
    if (progress.audio === "off") return;
    if (!("speechSynthesis" in window)) {
      toast(
        "Este navegador no ofrece lectura de voz. Puedes seguir con el texto.",
      );
      return;
    }
    const lang = progress.audio;
    const voices = speechSynthesis.getVoices();
    const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
    const voice = matches.find((v) => v.localService) || matches[0];
    if (!voice) {
      toast(
        `No hay voz ${lang === "es" ? "española" : "inglesa"} disponible. Instálala en los ajustes de voz del dispositivo para usarla sin conexión.`,
      );
      return;
    }
    if (!navigator.onLine && !voice.localService) {
      toast(
        "La voz disponible necesita Internet. Instala una voz local para escuchar sin conexión.",
      );
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lang === "en" ? en : es);
    utterance.lang = lang === "en" ? "en-US" : "es-ES";
    utterance.voice = voice;
    utterance.rate = 0.94;
    utterance.onerror = () =>
      toast(
        "No se pudo reproducir la voz. El entrenamiento sigue disponible con texto.",
      );
    speechSynthesis.speak(utterance);
  }
  function narrate(m, p) {
    const color = Position.color(p),
      capture = m.ep || position.stack.at(-1)?.b[m.to];
    const check = position.check();
    speak(
      `${color === "w" ? "Blancas" : "Negras"}: ${names.es[p.toLowerCase()]} ${capture ? "captura en" : "a"} ${Position.square(m.to)}${m.promotion ? ", corona como " + names.es[m.promotion] : ""}${check ? ". Jaque." : ""}`,
      `${color === "w" ? "White" : "Black"} ${names.en[p.toLowerCase()]} ${capture ? "captures on" : "to"} ${Position.square(m.to)}${m.promotion ? ", promotes to " + names.en[m.promotion] : ""}${check ? ". Check." : ""}`,
    );
  }
  function heading(tag, text, sub) {
    return `<div class="page-title"><div><span class="eyebrow">${tag}</span><h1>${text}</h1><p class="subtext">${sub}</p></div><span class="date-pill">✓ Sin conexión</span></div>`;
  }
  function stats() {
    return `<div class="stats">${[
      [
        solved("tactic").toLocaleString("es") +
          " / " +
          TRAINING.length.toLocaleString("es"),
        "Problemas resueltos",
        "⚡",
      ],
      [streak() + " días", "Racha de práctica", "♨"],
      [
        progress.courses.length + " / " + COURSE_PATHS.toLocaleString("es"),
        "Líneas · ambos colores",
        "♜",
      ],
      [
        solved("endgame") +
          " / " +
          TRAINING.filter((t) => t.kind === "endgame").length,
        "Problemas de finales",
        "♔",
      ],
    ]
      .map(
        ([v, t, i]) =>
          `<div class="stat"><span class="stat-icon">${i}</span><div><strong style="font-size:16px">${v}</strong><small>${t}</small></div></div>`,
      )
      .join("")}</div>`;
  }

  function home() {
    return (
      heading(
        "CADA JUGADA CUENTA",
        "Tu siguiente gran movimiento.",
        "Tu entrenamiento personal. Sin cuentas, sin conexión, a tu ritmo.",
      ) +
      `<section class="hero"><div class="hero-copy"><span class="eyebrow">APRENDE · PRACTICA · EVOLUCIONA</span><h2>Entrena tu mente.<br>Transforma tu juego.</h2><p>Combinaciones, aperturas y finales. Entiende cada jugada y vuelve más fuerte mañana.</p><a class="primary" href="#tactica">Elegir entrenamiento →</a><a class="primary" href="#practicar">Jugar una partida →</a></div><div class="hero-art" aria-hidden="true"><span class="pawn">♟</span><span class="big-knight">♞</span></div></section>${stats()}<div class="section-head"><div><h2>Construye tu entrenamiento</h2><p>Empieza por una idea y llévala hasta el final.</p></div></div><div class="library-grid">${[
        [
          "tactica",
          "♘",
          "Tácticas por niveles",
          "10.000 problemas reales · temas y dificultad",
        ],
        [
          "aperturas",
          "♟",
          "Un repertorio con sentido",
          "3.865 líneas ECO · blancas y negras",
        ],
        [
          "finales",
          "♔",
          "Convierte tu ventaja",
          "4.660 problemas de finales y laboratorio",
        ],
        [
          "repaso",
          "↶",
          "Aprende de tus fallos",
          "Repite lo que fallaste y consolida patrones",
        ],
        [
          "practicar",
          "♜",
          "Tu rival de entrenamiento",
          "Stockfish 17.1 · seis niveles y análisis",
        ],
        [
          "academia",
          "♗",
          "Ideas que cambian tu juego",
          "Ataque, defensa, finales y reglas",
        ],
      ]
        .map(
          ([url, icon, name, text]) =>
            `<a class="training-card" href="#${url}"><div class="card-art"><span>${icon}</span></div><div class="card-body"><h3>${name}</h3><p>${text}</p><span class="text-link">Explorar →</span></div></a>`,
        )
        .join(
          "",
        )}</div><p class="offline-note">Tu progreso se guarda en este navegador. Puedes exportarlo desde Mi progreso para llevarlo a otro dispositivo. El audio usa las voces disponibles en tu sistema.</p>`
    );
  }
  function bankData() {
    const review = page === "repaso",
      end = page === "finales";
    return TRAINING.filter(
      (t) =>
        (!filter.query ||
          t.id.toLowerCase().includes(filter.query.toLowerCase().trim())) &&
        (review ? isDue(t) : !end || t.kind === "endgame") &&
        (filter.level === "all" || t.level === filter.level) &&
        (filter.theme === "all" || t.themes.includes(filter.theme)) &&
        (filter.length !== "multi" || review || t.line.length >= 3) &&
        (filter.status === "all" ||
          (filter.status === "pending"
            ? !progress.items[t.id]?.solved
            : !!progress.items[t.id]?.solved)),
    ).sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
  }
  function bank() {
    const end = page === "finales",
      review = page === "repaso",
      base = TRAINING.filter((t) =>
        review ? isDue(t) : !end || t.kind === "endgame",
      );
    const themes = [...new Set(base.flatMap((t) => t.themes))].sort((a, b) =>
      a.localeCompare(b),
    );
    const data = bankData(),
      perPage = 24,
      pages = Math.max(1, Math.ceil(data.length / perPage));
    bankPage = Math.max(0, Math.min(bankPage, pages - 1));
    const cards = data.slice(bankPage * perPage, (bankPage + 1) * perPage);
    const core = [
      "Clavadas",
      "Ataques dobles",
      "Descubiertas",
      "Sacrificios",
      "Defensa",
      "Mates",
    ];
    const summary = review
      ? "Repeticiones pendientes y errores de tus partidas."
      : "Problemas de partidas reales de Lichess · soluciones verificadas · ratings de ejercicios, no títulos de jugadores.";
    return (
      heading(
        review
          ? "LOS ERRORES TAMBIÉN ENSEÑAN"
          : end
            ? "FINALES DE PARTIDAS REALES"
            : "ENTRENAMIENTO TÁCTICO",
        review
          ? "Vuelve, entiende, mejora."
          : end
            ? "Convierte la ventaja."
            : "Calcula. Decide. Comprueba.",
        summary,
      ) +
      (!review && !end
        ? `<div class="theme-shortcuts">${core.map((t) => `<button class="theme-shortcut ${filter.theme === t ? "active" : ""}" data-theme="${t}"><strong>${t}</strong><span>${base.filter((p) => p.themes.includes(t)).length} problemas</span></button>`).join("")}</div>`
        : "") +
      (end
        ? `<section class="endgame-banner"><div><h2>Laboratorio de finales</h2><p>Practica posiciones de mate y coronación contra la defensa real de Stockfish.</p></div><div class="controls">${ENDGAME_LABS.map((l, i) => `<button class="secondary" data-lab="${i}">${l.name}</button>`).join("")}</div></section>`
        : "") +
      `<div class="filters"><label class="filter">Buscar ID<input id="filter-query" value="${escapeHtml(filter.query || "")}" placeholder="Ej.: 00008"></label><label class="filter">Nivel<select id="filter-level"><option value="all">Todos los niveles</option>${Object.entries(
        levelNames,
      )
        .map(
          ([v, n]) =>
            `<option value="${v}" ${filter.level === v ? "selected" : ""}>${n}</option>`,
        )
        .join(
          "",
        )}</select></label><label class="filter">Tema<select id="filter-theme"><option value="all">Todos los temas</option>${themes.map((t) => `<option ${filter.theme === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><label class="filter">Extensión<select id="filter-length"><option value="multi" ${filter.length === "multi" ? "selected" : ""}>Varias decisiones</option><option value="all" ${filter.length === "all" ? "selected" : ""}>Todas las duraciones</option></select></label><label class="filter">Estado<select id="filter-status"><option value="all">Todos</option><option value="pending" ${filter.status === "pending" ? "selected" : ""}>Pendientes</option><option value="done" ${filter.status === "done" ? "selected" : ""}>Completados</option></select></label></div>
      <div class="section-head"><p>${data.length.toLocaleString("es")} problemas con estos filtros · página ${bankPage + 1} de ${pages}</p><button class="secondary" data-action="random-training" ${data.length ? "" : "disabled"}>Elegir uno al azar</button></div>
      ${
        cards.length
          ? `<div class="library-grid">${cards
              .map((t) => {
                const r = progress.items[t.id];
                return `<article class="training-card"><div class="card-art ${t.level === "avanzado" ? "blue" : t.level === "intermedio" ? "gold" : ""}"><span>${t.kind === "endgame" ? "♔" : t.theme === "Defensa" ? "♜" : "♘"}</span><small class="rating-badge">${t.rating} Lichess</small></div><div class="card-body"><span class="pill">${levelNames[t.level]}</span>${t.themes
                  .slice(0, 3)
                  .map((x) => `<span class="pill">${x}</span>`)
                  .join(
                    "",
                  )}<h3 class="training-title">${t.title}</h3><p>${Math.ceil(t.line.length / 2)} decisiones tuyas · ${t.line.length} medias jugadas<br>Juegan ${t.fen.split(" ")[1] === "w" ? "blancas" : "negras"}</p><p class="training-detail">${r?.solved ? "✓ Resuelto" : "Pendiente"}${r?.review ? " · Repasar" : ""}</p><button class="primary" data-train="${t.id}">Entrenar →</button></div></article>`;
              })
              .join("")}</div>`
          : '<div class="empty">No hay problemas con estos filtros. Selecciona todos los niveles o todos los temas.</div>'
      }
      <div class="pagination"><button class="secondary" data-action="bank-prev" ${bankPage === 0 ? "disabled" : ""}>← Anterior</button><span>${bankPage + 1} / ${pages}</span><button class="primary" data-action="bank-next" ${bankPage + 1 >= pages ? "disabled" : ""}>Siguiente →</button></div>`
    );
  }

  function shell(name, sub) {
    return (
      heading("UNA JUGADA CON INTENCIÓN", name, sub) +
      `<div class="board-layout"><div><div class="player-label"><span class="avatar small">♚</span><strong id="top-color"></strong><span id="top-player"></span></div><div id="board" class="board" role="group" aria-label="Tablero de ajedrez"></div><div class="player-label"><span class="avatar small">♔</span><strong id="bottom-color"></strong><span id="bottom-player"></span></div><div class="board-tools"><button class="secondary" data-action="flip">⇅ Girar tablero</button><button class="secondary" data-action="read-status">♫ Escuchar explicación</button></div></div><aside id="board-panel" class="panel board-panel-scroll"></aside></div>`
    );
  }
  function renderBoard() {
    const legal =
      selected !== null && !locked && !complete
        ? position.moves().filter((m) => m.from === selected)
        : [];
    const indices = Array.from({ length: 64 }, (_, i) =>
      flipped ? 63 - i : i,
    );
    const king = position.check()
      ? position.b.indexOf(position.turn === "w" ? "K" : "k")
      : -1;
    $("#board").innerHTML = indices
      .map((i, idx) => {
        const p = position.b[i],
          sq = Position.square(i);
        return `<button class="square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : ""} ${p && Position.color(p) === "w" ? "white-piece" : ""} ${selected === i ? "selected" : ""} ${legal.some((m) => m.to === i) ? "possible" : ""} ${last.includes(i) ? "last" : ""} ${king === i ? "check" : ""} ${hintMove?.from === i ? "hint-from" : ""} ${hintMove?.to === i ? "hint-to" : ""}" data-square="${i}" aria-label="${sq}${p ? " " + names.es[p.toLowerCase()] + " " + (Position.color(p) === "w" ? "blanco" : "negro") : " vacía"}" ${locked || complete || (current?.type === "course" && courseMode === "learn") || current?.type === "replay" ? "disabled" : ""}>${idx % 8 === 0 || Math.floor(idx / 8) === 7 ? `<small>${idx % 8 === 0 ? sq[1] : ""}${Math.floor(idx / 8) === 7 ? sq[0] : ""}</small>` : ""}${p ? symbols[p] : ""}</button>`;
      })
      .join("");
    $("#top-color").textContent = flipped ? "Blancas" : "Negras";
    $("#bottom-color").textContent = flipped ? "Negras" : "Blancas";
    $("#bottom-player").textContent =
      current?.type === "practice"
        ? practiceSide === (flipped ? "b" : "w")
          ? "Tú"
          : "Rival"
        : trainee === (flipped ? "b" : "w")
          ? "Tú entrenas"
          : "Rival de la línea";
    $("#top-player").textContent =
      current?.type === "practice" ? "Partida local" : "Entrenamiento guiado";
  }
  function setStatus(es, en = es, error = false) {
    const el = $("#status");
    if (el) {
      el.textContent = es;
      el.className = "status" + (error ? " error" : "");
    }
    currentStatus = { es, en };
  }
  let currentStatus = {
    es: "Elige un entrenamiento.",
    en: "Choose a training exercise.",
  };
  function englishTheme(t) {
    return (
      {
        Mates: "Checkmates",
        "Ataques dobles": "Double attacks",
        Defensa: "Defense",
        Clavadas: "Pins",
        Sacrificios: "Sacrifices",
        Descubiertas: "Discovered attacks",
        Finales: "Endgames",
      }[t.theme] || "Training"
    );
  }
  function beginTraining(id) {
    cancel();
    const t = TRAINING.find((t) => t.id === id);
    if (!t) return;
    current = { type: "exercise", exercise: t };
    position = new Position(t.fen);
    line = t.line;
    step = 0;
    trainee = position.turn;
    flipped = trainee === "b";
    hinted = false;
    failedThisRun = false;
    const r = item(id);
    r.attempts++;
    save();
    $("#content").innerHTML = shell(
      t.title,
      `${levelNames[t.level]} · ${t.rating} Lichess · ${t.theme} · juega con ${trainee === "w" ? "blancas" : "negras"}`,
    );
    $("#board-panel").innerHTML =
      `<span class="eyebrow">${t.kind === "endgame" ? "FINAL INTERACTIVO" : "TÁCTICA GUIADA"} · ${levelNames[t.level].toUpperCase()}</span><h2>${t.title}</h2><span class="pill">${t.theme}</span><div id="steps" class="step-track"></div><div id="status" class="status" role="status" aria-live="polite"></div><p class="line-tip">Resuelve la posición. Tras tres intentos fallidos, se marcarán origen y destino. El rival responde con la defensa de la solución. Las alternativas se contrastan con Stockfish antes de rechazarlas.</p><div class="controls"><button class="secondary" data-action="hint">✦ Pista</button><button class="secondary" data-action="solution">Ver próximo movimiento</button></div><p id="hint-text" hidden>${t.hint}</p><div class="move-list" id="moves"></div><div class="controls"><button class="secondary" data-action="retry">↶ Reiniciar</button><button class="primary" data-action="next-training">Siguiente →</button></div><p class="notice">Fuente: Lichess · problema ${t.sourceId}. Completar con pista se registra como repaso pendiente. Las etiquetas y el rating pertenecen al ejercicio.</p>`;
    updateTraining();
    setStatus(
      `Tu turno: ${Math.ceil(line.length / 2)} decisiones para completar el ejercicio.`,
      `Your turn. ${Math.ceil(line.length / 2)} decisions to complete this ${englishTheme(t).toLowerCase()} exercise.`,
    );
    speak(currentStatus.es, currentStatus.en);
    renderBoard();
  }
  function updateTraining() {
    if ($("#steps"))
      $("#steps").innerHTML = line
        .map(
          (m, i) =>
            `<span class="step-dot ${i < step ? "done" : ""}" title="Paso ${i + 1}"></span>`,
        )
        .join("");
    if ($("#moves")) $("#moves").textContent = recordsForLine();
  }
  function moveText(m, before) {
    const p = before.b[m.from];
    return `${p.toLowerCase() === "p" ? "" : p.toUpperCase()}${Position.square(m.from)}${before.b[m.to] || m.ep ? "×" : "–"}${Position.square(m.to)}${m.promotion ? "=" + m.promotion.toUpperCase() : ""}${m.castle ? " (enroque)" : ""}`;
  }
  function recordsForLine() {
    const p = new Position(
      current?.type === "exercise" ? current.exercise.fen : Position.START,
    );
    const text = [];
    for (let i = 0; i < step; i++) {
      const m = p.moves().find((m) => Position.uci(m) === line[i]);
      if (!m) break;
      text.push(`${p.full}${p.turn === "w" ? "." : "…"} ${moveText(m, p)}`);
      p.make(m);
    }
    return text.join("\n") || "La combinación empieza contigo.";
  }
  function markComplete() {
    complete = true;
    locked = false;
    selected = null;
    if (current.type === "exercise") {
      const t = current.exercise,
        r = item(t.id);
      r.solved = true;
      r.review = hinted || failedThisRun;
      r.passes = !hinted && !failedThisRun ? r.passes + 1 : 0;
      r.nextReview = r.review
        ? Date.now()
        : Date.now() + [1, 3, 7][Math.min(r.passes - 1, 2)] * 86400000;
      if (t.sourceMistake !== undefined && progress.mistakes[t.sourceMistake])
        progress.mistakes[t.sourceMistake].reviewed = !r.review;
      activity();
      setStatus(
        "✓ Ejercicio completado. " +
          t.explain +
          (r.review ? " Vuelve a intentarlo sin ayuda para consolidarlo." : ""),
        `Exercise complete. You followed the full ${englishTheme(t).toLowerCase()} combination. ${r.review ? "Try again without help to strengthen this pattern." : "Well done. Your next review has been scheduled."}`,
      );
    } else if (current.type === "course") {
      const key = `${COURSES.openings[courseIndex].variants[variantIndex].id}:${courseSide}`;
      if (courseMode === "train" && !progress.courses.includes(key))
        progress.courses.push(key);
      activity();
      setStatus(
        courseMode === "train"
          ? "✓ Variante completada con " +
              (courseSide === "w" ? "blancas" : "negras") +
              ". Cambia de lado o explora otra variante."
          : "✓ Recorrido terminado. Cambia a «Practicar» para jugar tú las decisiones.",
        courseMode === "train"
          ? "Variation completed. Switch sides or explore another line."
          : "Walkthrough complete. Select practice mode to play the moves yourself.",
      );
    }
    updateTraining();
    renderBoard();
    speak(currentStatus.es, currentStatus.en);
  }
  function nextExpected() {
    const code = line[step],
      m = position.moves().find((m) => Position.uci(m) === code);
    if (!m) return null;
    const p = position.b[m.from];
    return {
      es: `${names.es[p.toLowerCase()]} de ${Position.square(m.from)} a ${Position.square(m.to)}${m.promotion ? ", corona como " + names.es[m.promotion] : ""}`,
      en: `${names.en[p.toLowerCase()]} from ${Position.square(m.from)} to ${Position.square(m.to)}${m.promotion ? ", promote to " + names.en[m.promotion] : ""}`,
    };
  }
  function applyLineReply() {
    if (step >= line.length) {
      markComplete();
      return;
    }
    locked = true;
    selected = null;
    renderBoard();
    const token = session;
    replyTimer = setTimeout(() => {
      if (token !== session) return;
      const m = position.moves().find((m) => Position.uci(m) === line[step]);
      if (!m) {
        setStatus(
          "No se pudo reproducir la línea. Reinicia el ejercicio.",
          "Could not continue the line. Restart the exercise.",
          true,
        );
        locked = false;
        return;
      }
      position.make(m);
      last = [m.from, m.to];
      step++;
      locked = false;
      updateTraining();
      if (step >= line.length) markComplete();
      else {
        setStatus(
          `El rival respondió. Tu decisión ${Math.floor(step / 2) + 1} de ${Math.ceil(line.length / 2)}.`,
          `The opponent has replied. Your decision ${Math.floor(step / 2) + 1} of ${Math.ceil(line.length / 2)}.`,
        );
        renderBoard();
        speak(currentStatus.es, currentStatus.en);
      }
    }, 650);
  }
  function openingsLibrary() {
    const aliases = {
      italiana: "italian",
      española: "ruy lopez",
      siciliana: "sicilian",
      francesa: "french",
      "gambito de dama": "queen's gambit",
      inglesa: "english",
      londres: "london",
      "india de rey": "king's indian",
    };
    const q = aliases[openingQuery.toLowerCase()] || openingQuery.toLowerCase(),
      data = COURSES.openings
        .map((o, i) => ({ o, i }))
        .filter(({ o }) =>
          o.variants.some(
            (v) =>
              (openingEco === "all" || v.eco[0] === openingEco) &&
              (!q ||
                v.name.toLowerCase().includes(q) ||
                v.eco.toLowerCase().includes(q)),
          ),
        );
    const pages = Math.max(1, Math.ceil(data.length / 18));
    openingPage = Math.min(openingPage, pages - 1);
    return (
      heading(
        "REPERTORIO CON CLASIFICACIÓN ECO",
        "Estudia el plan, no solo la jugada.",
        `${OPENING_LINES.length.toLocaleString("es")} líneas de aperturas y variantes. Practica cada lado y revisa las ideas con Stockfish.`,
      ) +
      `<div class="filters"><label class="filter">Buscar apertura o ECO<input id="opening-search" value="${escapeHtml(openingQuery)}" placeholder="Sicilian, italiana, C50…"></label><label class="filter">Volumen ECO<select id="opening-eco"><option value="all">Todos</option>${"ABCDE"
        .split("")
        .map(
          (c) => `<option ${openingEco === c ? "selected" : ""}>${c}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="primary" data-action="opening-search">Buscar</button></div><p class="notice">Los nombres oficiales de las variantes se conservan en inglés. Las instrucciones y el audio se pueden usar en español. Un nombre de apertura identifica una línea, no obliga al rival a seguirla.</p>
      <p class="training-detail">${data.length} familias encontradas · página ${openingPage + 1} de ${pages}</p><div class="library-grid">${data
        .slice(openingPage * 18, (openingPage + 1) * 18)
        .map(
          ({ o, i }) =>
            `<article class="training-card"><div class="card-art ${o.color}"><span>${o.icon}</span></div><div class="card-body"><span class="tag">${o.variants[0].eco} · ${o.variants.length} variantes</span><h3>${o.name}</h3><p>${o.variants
              .slice(0, 3)
              .map((v) => v.name.replace(o.name + ": ", ""))
              .join(
                " · ",
              )}</p><button class="primary" data-course="${i}">Elegir variante →</button></div></article>`,
        )
        .join(
          "",
        )}</div><div class="pagination"><button class="secondary" data-action="opening-prev" ${openingPage === 0 ? "disabled" : ""}>← Anterior</button><span>${openingPage + 1} / ${pages}</span><button class="primary" data-action="opening-next" ${openingPage + 1 === pages ? "disabled" : ""}>Siguiente →</button></div>`
    );
  }
  function escapeHtml(text) {
    return String(text).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function beginCourse(i, variant = 0, side = "w", trainingMode = "learn") {
    cancel();
    courseIndex = i;
    variantIndex = variant;
    courseSide = side;
    courseMode = trainingMode;
    current = { type: "course" };
    position = new Position();
    trainee = side;
    flipped = side === "b";
    step = 0;
    line = COURSES.openings[i].variants[variant].line;
    if (
      trainingMode === "train" &&
      !line.some((_, n) => n % 2 === (side === "w" ? 0 : 1))
    ) {
      courseMode = trainingMode = "learn";
      toast(
        "Esta línea no contiene decisiones de ese color. Elige una variante más larga para practicar.",
      );
    }
    const o = COURSES.openings[i];
    $("#content").innerHTML = shell(
      o.name,
      "Explora las variantes y entrena las decisiones de cada color.",
    );
    $("#board-panel").innerHTML =
      `<span class="eyebrow">REPERTORIO PERSONAL</span><h2>${o.name}</h2><p>${o.description}</p>${OPENING_PLANS[o.name] ? `<p class="line-tip">${OPENING_PLANS[o.name].plan}</p><p class="notice"><strong>Atención:</strong> ${OPENING_PLANS[o.name].risk}</p>` : ""}<label class="settings">Variante<select id="course-variant">${o.variants.map((v, j) => `<option value="${j}" ${j === variant ? "selected" : ""}>${v.name}</option>`).join("")}</select></label><label class="settings">Tu color<select id="course-side"><option value="w" ${side === "w" ? "selected" : ""}>Blancas</option><option value="b" ${side === "b" ? "selected" : ""}>Negras</option></select></label><label class="settings">Modo<select id="course-mode"><option value="learn" ${trainingMode === "learn" ? "selected" : ""}>Aprender</option><option value="train" ${trainingMode === "train" ? "selected" : ""}>Practicar</option></select></label><div id="status" class="status" role="status" aria-live="polite"></div><div id="steps" class="step-track"></div><div id="moves" class="move-list"></div><div class="controls">${trainingMode === "learn" ? '<button class="secondary" data-action="course-prev">← Anterior</button><button class="primary" data-action="course-next">Siguiente →</button>' : '<button class="secondary" data-action="course-hint">✦ Pista</button><button class="secondary" data-action="course-retry">Reiniciar</button>'}</div><p class="notice">Una línea de repertorio puede admitir otras buenas jugadas. En «Practicar» sigue la variante elegida; el rival reproduce su parte.</p>`;
    setStatus(
      trainingMode === "learn"
        ? "Avanza con los botones para entender el plan."
        : "Juega las decisiones de tu color sobre el tablero.",
      trainingMode === "learn"
        ? "Use the buttons to explore this opening line."
        : "Play the moves for your chosen side on the board.",
    );
    updateTraining();
    renderBoard();
    if (trainingMode === "train" && trainee !== position.turn) applyLineReply();
  }
  function courseIdea() {
    const o = COURSES.openings[courseIndex],
      v = o.variants[variantIndex];
    if (step === 0) return;
    const u = line[step - 1],
      p = new Position();
    for (let i = 0; i < step - 1; i++) p.play(line[i]);
    const m = p.moves().find((m) => Position.uci(m) === u),
      piece = p.b[m.from].toLowerCase();
    let idea = m.castle
      ? "El enroque pone al rey a salvo y conecta las torres."
      : p.b[m.to]
        ? "El cambio transforma la estructura: revisa qué líneas se abren."
        : piece === "p"
          ? "El avance de peón gana espacio o disputa una casilla central."
          : piece === "n" || piece === "b"
            ? "Desarrolla una pieza menor y observa las casillas que controla."
            : "Coordina la pieza con el resto del ejército; comprueba la seguridad del rey.";
    setStatus(
      `${v.san[step - 1]}. ${idea} ${variantIndex === 0 && o.notes[step - 1] ? o.notes[step - 1] : ""}`,
      `Move ${v.san[step - 1]}. ${m.castle ? "Castling protects the king and connects the rooks." : p.b[m.to] ? "This exchange changes the pawn structure and opens lines." : piece === "p" ? "This pawn move gains space or challenges key squares." : "Develop and coordinate your pieces. Check the safety of both kings."}`,
    );
  }
  function practice() {
    cancel();
    current = { type: "practice" };
    position = new Position(practiceInitial);
    trainee = practiceSide;
    flipped = practiceSide === "b";
    records = [];
    counted = false;
    $("#content").innerHTML = shell(
      "Pon tus ideas en juego.",
      "Rival y análisis calculados en tu dispositivo. Sin conexión y sin cuentas.",
    );
    $("#board-panel").innerHTML =
      `<span class="eyebrow">LABORATORIO DE AJEDREZ</span><h2>Juega, revisa, entiende.</h2><label class="settings">Modo<select id="practice-mode"><option value="bot" ${practiceMode === "bot" ? "selected" : ""}>Rival automático</option><option value="free" ${practiceMode === "free" ? "selected" : ""}>Tablero libre</option></select></label><label class="settings">Tu color<select id="practice-side"><option value="w" ${practiceSide === "w" ? "selected" : ""}>Blancas</option><option value="b" ${practiceSide === "b" ? "selected" : ""}>Negras</option></select></label><label class="settings">Stockfish<select id="strength">${["Iniciación", "Club I", "Club II", "Avanzado", "Experto", "Máxima fuerza"].map((n, i) => `<option value="${i + 1}" ${strength === String(i + 1) ? "selected" : ""}>${n} · habilidad ${[0, 4, 8, 12, 16, 20][i]}</option>`).join("")}</select></label><label class="settings">Tiempo de cálculo<select id="analysis-time">${[1000, 2500, 5000, 10000].map((ms) => `<option value="${ms}" ${analysisMs === ms ? "selected" : ""}>${ms / 1000} segundos</option>`).join("")}</select></label><div id="status" class="status" role="status" aria-live="polite"></div><div id="moves" class="move-list"></div><div class="controls"><button class="secondary" data-action="undo">↶ Deshacer</button><button class="secondary" data-action="new-game">Nueva partida</button><button class="primary" data-action="analyze">Analizar posición</button></div><div id="analysis" class="analysis-result">Después de tu jugada verás una comparación con la alternativa del motor.</div><div class="controls"><button class="secondary" data-action="game-review">Revisar mis jugadas</button><button class="secondary" data-action="export-game">Exportar PGN</button><button class="secondary" data-action="import-pgn">Importar PGN</button><button class="secondary" data-action="import-fen">Cargar FEN</button></div><p class="engine-note">Stockfish 17.1 lite (NNUE), ejecutado localmente. Los análisis usan fuerza máxima y hasta tres líneas; el nivel elegido solo debilita al rival. Aumenta el tiempo para un análisis más profundo. La habilidad del motor no equivale a un Elo certificado.</p><p class="voice-notice">Cambiar de color o de modo inicia una partida nueva.</p>`;
    updatePractice();
    renderBoard();
    if (practiceMode === "bot" && position.turn !== practiceSide) botTurn();
  }
  function gameStatus() {
    const legal = position.moves();
    if (!legal.length)
      return position.check()
        ? {
            es: `Jaque mate. Ganan ${position.turn === "w" ? "negras" : "blancas"}.`,
            en: `Checkmate. ${position.turn === "w" ? "Black" : "White"} wins.`,
            end: true,
          }
        : { es: "Tablas por ahogado.", en: "Draw by stalemate.", end: true };
    if (position.draw())
      return {
        es: "Tablas por repetición, regla de 50 movimientos o material insuficiente.",
        en: "Draw by repetition, the fifty-move rule, or insufficient material.",
        end: true,
      };
    return {
      es: `Turno de ${position.turn === "w" ? "blancas" : "negras"}.${position.check() ? " ¡Jaque!" : ""}`,
      en: `${position.turn === "w" ? "White" : "Black"} to move.${position.check() ? " Check!" : ""}`,
      end: false,
    };
  }
  function updatePractice() {
    if (!current || current.type !== "practice") return;
    const state = gameStatus();
    setStatus(
      locked ? "Calculando en tu dispositivo…" : state.es,
      locked ? "Calculating on your device." : state.en,
    );
    $("#moves").textContent = records.length
      ? records
          .map(
            (r, i) => `${Math.floor(i / 2) + 1}${i % 2 ? "…" : "."} ${r.text}`,
          )
          .join("\n")
      : "Todavía no hay movimientos.";
    if (state.end && !counted) {
      counted = true;
      progress.games++;
      activity();
    }
    return state;
  }
  function options() {
    const skill = [0, 4, 8, 12, 16, 20][
      Math.max(0, Math.min(5, Number(strength) - 1))
    ];
    return { ms: analysisMs, skill, multiPV: 1 };
  }

  function scoreText(score) {
    return Math.abs(score) > 99000
      ? score > 0
        ? "Mate a favor"
        : "Mate en contra"
      : (score >= 0 ? "+" : "") + (score / 100).toFixed(2) + " peones";
  }
  function pvText(fen, pv) {
    const p = new Position(fen),
      out = [];
    for (const u of pv.slice(0, 8)) {
      const m = p.moves().find((m) => Position.uci(m) === u);
      if (!m) break;
      out.push(moveText(m, p));
      p.make(m);
    }
    return out.join(" → ");
  }
  function appendMove(m, own = false) {
    wrongAtStep = 0;
    hintMove = null;
    const before = position.fen(),
      color = position.turn,
      piece = position.b[m.from],
      text = moveText(m, position);
    position.make(m);
    last = [m.from, m.to];
    records.push({
      uci: Position.uci(m),
      before,
      after: position.fen(),
      color,
      text,
      own,
    });
    activity();
    return piece;
  }
  async function analyzePlayed(
    before,
    after,
    color,
    uci,
    token,
    history = null,
  ) {
    const beforeResult = await analyze(before, {
      depth: 30,
      ms: analysisMs,
      multiPV: 3,
      ...(history
        ? { initialFen: history.initialFen, moves: history.moves }
        : {}),
    });
    if (token !== session) return;
    const afterResult = await analyze(after, {
      depth: 30,
      ms: analysisMs,
      multiPV: 3,
      ...(history
        ? { initialFen: history.initialFen, moves: [...history.moves, uci] }
        : {}),
    });
    if (token !== session) return;
    const loss = Math.max(0, beforeResult.score + afterResult.score),
      label =
        loss >= 250
          ? "Error importante"
          : loss >= 120
            ? "Error"
            : loss >= 60
              ? "Imprecisión"
              : "Jugada razonable";
    const entry = {
      before,
      after,
      color,
      uci,
      best: beforeResult.move,
      loss,
      label,
      engine: "Stockfish 17.1",
      alternatives: beforeResult.lines,
      depth: Math.min(beforeResult.depth, afterResult.depth),
      date: new Date().toISOString(),
      pv: beforeResult.pv,
    };
    const record = records.findLast(
      (r) => r.before === before && r.uci === uci,
    );
    if (record) record.analysis = entry;
    if (loss >= 60) {
      progress.mistakes.unshift(entry);
      progress.mistakes = progress.mistakes.slice(0, 100);
      save();
    }
    if ($("#analysis"))
      $("#analysis").innerHTML =
        `<h3>${label} · Stockfish 17.1</h3><span class="eval">Pérdida estimada: ${(loss / 100).toFixed(2)} peones</span><p>Alternativa calculada: ${pvText(before, beforeResult.pv)}.</p><p>Profundidad completada: ${entry.depth} · Stockfish 17.1. Los análisis más largos pueden refinar la evaluación.</p><div class="analysis-lines">${beforeResult.lines.map((x, i) => `<div class="analysis-line"><strong>${i + 1}. ${scoreText(x.score)}</strong><br>${pvText(before, x.pv)}</div>`).join("")}</div>${loss >= 60 ? '<button class="secondary" data-action="last-mistake">Practicar esta posición</button>' : ""}`;
    return entry;
  }
  async function playPractice(m) {
    const token = session,
      own = practiceMode === "free" || position.turn === practiceSide,
      before = position.fen(),
      color = position.turn,
      uci = Position.uci(m);
    const piece = appendMove(m, own);
    selected = null;
    renderBoard();
    narrate(m, piece);
    locked = true;
    renderBoard();
    updatePractice();
    $("#analysis").textContent = "Comparando tu jugada con una alternativa…";
    try {
      await analyzePlayed(before, position.fen(), color, uci, token, {
        initialFen: practiceInitial,
        moves: records.slice(0, -1).map((r) => r.uci),
      });
      if (token !== session) return;
      locked = false;
      updatePractice();
      renderBoard();
      if (!gameStatus().end && practiceMode === "bot") await botTurn();
    } catch (error) {
      if (token !== session || error.message === "cancelled") return;
      locked = false;
      setStatus(
        error.message,
        "The local engine is unavailable. Try free-board mode.",
        true,
      );
      renderBoard();
    }
  }
  async function botTurn() {
    if (
      current?.type !== "practice" ||
      practiceMode !== "bot" ||
      position.turn === practiceSide ||
      gameStatus().end
    )
      return;
    locked = true;
    selected = null;
    renderBoard();
    updatePractice();
    const token = session;
    try {
      const result = await analyze(position.fen(), {
        ...options(),
        keys: position.keys,
        initialFen: practiceInitial,
        moves: records.map((r) => r.uci),
      });
      if (token !== session) return;
      const m = position.moves().find((m) => Position.uci(m) === result.move);
      if (m) {
        appendMove(m);
        renderBoard();
      }
      locked = false;
      updatePractice();
      renderBoard();
      if (gameStatus().end) speak(currentStatus.es, currentStatus.en);
    } catch (error) {
      if (token !== session || error.message === "cancelled") return;
      locked = false;
      setStatus(
        error.message,
        "The local engine could not calculate a move.",
        true,
      );
      renderBoard();
    }
  }
  async function analyzePosition() {
    if (locked) return;
    locked = true;
    renderBoard();
    const token = session,
      fen = position.fen();
    $("#analysis").textContent = "Analizando esta posición…";
    try {
      const r = await analyze(fen, {
        depth: 40,
        ms: analysisMs,
        multiPV: 3,
        keys: position.keys,
        initialFen: current.type === "replay" ? replayFen : practiceInitial,
        moves:
          current.type === "replay"
            ? replayMoves.slice(0, replayIndex)
            : records.map((r) => r.uci),
      });
      if (token !== session) return;
      $("#analysis").innerHTML =
        `<h3>Evaluación para ${position.turn === "w" ? "blancas" : "negras"}</h3><span class="eval">${scoreText(r.score)}</span><p>Línea calculada: ${pvText(fen, r.pv) || "No hay jugadas legales."}</p><p>${r.nodes} nodos · profundidad ${r.depth} · ${r.ms} ms · Stockfish 17.1.</p><div class="analysis-lines">${r.lines.map((x, i) => `<div class="analysis-line"><strong>${i + 1}. ${scoreText(x.score)}</strong><br>${pvText(fen, x.pv)}</div>`).join("")}</div>`;
      locked = false;
      updatePractice();
      renderBoard();
    } catch (e) {
      if (token !== session || e.message === "cancelled") return;
      locked = false;
      $("#analysis").textContent = e.message;
      renderBoard();
    }
  }
  function promotionDialog(color) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      let choice = null;
      d.innerHTML =
        '<h2>Elige tu coronación</h2><div class="promotion">' +
        ["q", "r", "b", "n"]
          .map(
            (t) =>
              `<button data-promotion="${t}" class="secondary" aria-label="${names.es[t]}">${symbols[color === "w" ? t.toUpperCase() : t]}</button>`,
          )
          .join("") +
        '</div><button class="secondary" data-dismiss>Cancelar</button>';
      d.onclick = (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        choice = b.dataset.promotion || null;
        d.close();
      };
      d.onclose = () => {
        d.remove();
        resolve(choice);
      };
      document.body.append(d);
      d.showModal();
    });
  }
  async function squareClick(to) {
    if (
      locked ||
      complete ||
      !current ||
      current.type === "replay" ||
      (current.type === "course" && courseMode === "learn")
    )
      return;
    if (
      current.type === "practice" &&
      practiceMode === "bot" &&
      position.turn !== practiceSide
    )
      return;
    const piece = position.b[to];
    if (piece && Position.color(piece) === position.turn) {
      selected = to;
      renderBoard();
      return;
    }
    if (selected === null) return;
    let moves = position
      .moves()
      .filter((m) => m.from === selected && m.to === to);
    if (!moves.length) {
      if (
        current.type === "exercise" ||
        current.type === "practice" ||
        (current.type === "course" && courseMode === "train")
      )
        failedAttempt(false);
      else {
        selected = null;
        renderBoard();
      }
      return;
    }
    const token = session;
    let m = moves[0];
    if (moves.some((m) => m.promotion)) {
      const choice = await promotionDialog(position.turn);
      if (!choice || session !== token) return;
      m = moves.find((m) => m.promotion === choice);
    }
    if (!m) return;
    if (current.type === "practice") {
      await playPractice(m);
      return;
    }
    const code = Position.uci(m);
    if (code !== line[step]) {
      position.make(m);
      let alternateMate =
        current.type === "exercise" &&
        current.exercise.goal === "mate" &&
        position.check() &&
        !position.moves().length;
      position.undo();
      if (
        !alternateMate &&
        current.type === "exercise" &&
        current.exercise.sourceId
      ) {
        const accepted = await verifyAlternative(m);
        if (accepted === null) return;
        alternateMate = accepted;
      }
      if (!alternateMate) {
        failedAttempt(true);
        return;
      }
    }
    const p = position.b[m.from];
    position.make(m);
    last = [m.from, m.to];
    selected = null;
    wrongAtStep = 0;
    hintMove = null;
    step++;
    activity();
    if (
      current.type === "exercise" &&
      position.check() &&
      !position.moves().length
    ) {
      markComplete();
      return;
    }
    updateTraining();
    renderBoard();
    narrate(m, p);
    if (step >= line.length) {
      markComplete();
      return;
    }
    setStatus(
      "Bien. Ahora responde el rival.",
      "Good. The opponent will reply.",
    );
    applyLineReply();
  }
  async function verifyAlternative(m) {
    const token = session,
      before = position.fen(),
      test = new Position(before);
    test.make(m);
    const after = test.fen();
    locked = true;
    selected = null;
    setStatus(
      "Contrastando tu alternativa con Stockfish…",
      "Checking your alternative with Stockfish.",
    );
    renderBoard();
    try {
      const best = await analyze(before, { ms: 1800, depth: 32, multiPV: 3 });
      if (token !== session) return null;
      const reply = await analyze(after, { ms: 1800, depth: 32, multiPV: 1 });
      if (token !== session) return null;
      locked = false;
      if (best.depth < 12 || reply.depth < 12) {
        setStatus(
          "El cálculo aún no es suficientemente profundo para aceptar esta alternativa. Puedes seguir la solución original o aumentar el tiempo de análisis en una partida.",
          "The search is too shallow to verify this alternative. Follow the original solution or investigate it in analysis.",
          true,
        );
        renderBoard();
        return null;
      }
      const validMate =
        best.scoreType === "mate" &&
        best.mate > 0 &&
        reply.scoreType === "mate" &&
        reply.mate < 0;
      const validAdvantage =
        best.scoreType === "cp" &&
        -reply.score >= Math.max(50, best.score - 25);
      if (!validMate && !validAdvantage) {
        renderBoard();
        return false;
      }
      const pv = [],
        sim = new Position(after);
      const max = validMate
        ? reply.pv.length
        : Math.max(2, line.length - step - 1);
      for (const u of reply.pv.slice(0, max)) {
        if (!sim.play(u)) break;
        pv.push(u);
        if (!sim.moves().length) break;
      }
      if (validMate && (!sim.check() || sim.moves().length)) {
        setStatus(
          "Stockfish considera prometedora la alternativa, pero no mostró el mate completo. Continúa la solución original para terminar el ejercicio.",
          "The alternative looks promising, but the complete mate was not verified. Continue the original solution.",
          true,
        );
        renderBoard();
        return null;
      }
      if (!validMate && pv.length % 2 === 1) pv.pop();
      if (!validMate && pv.length < 2) {
        renderBoard();
        return null;
      }
      line = [...line.slice(0, step), Position.uci(m), ...pv];
      current.alternative = true;
      setStatus(
        "Alternativa aceptada por Stockfish. Continúa contra la defensa calculada.",
        "Alternative accepted by Stockfish. Continue against the calculated defense.",
      );
      return true;
    } catch (error) {
      if (token !== session || error.message === "cancelled") return null;
      locked = false;
      setStatus(
        "No se pudo verificar la alternativa: " + error.message,
        "The alternative could not be verified.",
        true,
      );
      renderBoard();
      return null;
    }
  }
  function openImport() {
    $("#lesson-content").innerHTML =
      '<h2>Importar una partida PGN</h2><p>Pega la partida o selecciona un archivo. El análisis se hace con Stockfish en este dispositivo.</p><textarea id="pgn-text" class="export-box" placeholder="1. e4 e5 2. Nf3 Nc6 …"></textarea><input id="pgn-file" type="file" accept=".pgn,.txt"><div class="controls"><button class="primary" data-load-pgn>Importar y revisar</button></div><p id="pgn-error" class="notice"></p>';
    $("#pgn-file").onchange = async (e) => {
      if (e.target.files[0]) {
        if (e.target.files[0].size > 1024 * 1024) {
          $("#pgn-error").textContent = "Máximo 1 MB por partida.";
          return;
        }
        $("#pgn-text").value = await e.target.files[0].text();
      }
    };
    $("#lesson").showModal();
  }
  function importPGN(text) {
    const parser = new window.ChessRules();
    parser.loadPgn(text);
    const hist = parser.history({ verbose: true });
    if (!hist.length) throw new Error("El PGN no contiene movimientos.");
    if (hist.length > 600)
      throw new Error("Máximo 600 medias jugadas por partida.");
    replayFen = parser.getHeaders().FEN || Position.START;
    replayMoves = hist.map((m) => m.from + m.to + (m.promotion || ""));
    replayIndex = 0;
    replayAnalyses = [];
    cancel();
    current = { type: "replay" };
    position = new Position(replayFen);
    trainee = position.turn;
    flipped = false;
    $("#content").innerHTML = shell(
      "Revisa tu partida.",
      "Recorre el PGN y analiza una posición o la partida completa con Stockfish.",
    );
    $("#board-panel").innerHTML =
      '<span class="eyebrow">ANÁLISIS DE PARTIDA · STOCKFISH</span><h2>Una decisión cada vez.</h2><div id="status" class="status"></div><div class="controls"><button class="secondary" data-action="replay-prev">← Anterior</button><button class="primary" data-action="replay-next">Siguiente →</button></div><div id="replay-list" class="replay-moves"></div><label class="settings">Tiempo por posición<select id="analysis-time"><option value="1000">1 segundo</option><option value="2500" selected>2,5 segundos</option><option value="5000">5 segundos</option><option value="10000">10 segundos</option></select></label><div class="controls"><button class="primary" data-action="analyze">Analizar posición</button><button class="secondary" data-action="analyze-pgn">Analizar partida</button><button class="secondary" data-action="cancel-pgn">Detener análisis</button></div><div id="analysis" class="analysis-result">Selecciona una posición o analiza toda la partida.</div><div id="game-analysis-list"></div><button class="secondary" data-action="replay-play">Practicar desde aquí</button>';
    $("#lesson").close();
    renderReplay();
  }
  function renderReplay() {
    position = new Position(replayFen);
    for (const u of replayMoves.slice(0, replayIndex)) position.play(u);
    last = position.stack.length
      ? [
          Position.index(replayMoves[replayIndex - 1].slice(0, 2)),
          Position.index(replayMoves[replayIndex - 1].slice(2, 4)),
        ]
      : [];
    setStatus(
      `Posición ${replayIndex} de ${replayMoves.length}. ${position.turn === "w" ? "Blancas" : "Negras"} al turno.`,
      `Position ${replayIndex} of ${replayMoves.length}. ${position.turn === "w" ? "White" : "Black"} to move.`,
    );
    const p = new Position(replayFen);
    $("#replay-list").innerHTML = replayMoves
      .map((u, i) => {
        const m = p.moves().find((m) => Position.uci(m) === u),
          text = `${p.full}${p.turn === "w" ? "." : "…"} ${moveText(m, p)}`;
        p.make(m);
        return `<button class="secondary ${i + 1 === replayIndex ? "active" : ""}" data-replay-to="${i + 1}">${text}</button>`;
      })
      .join("");
    renderBoard();
  }
  async function analyzePGN() {
    if (locked) return;
    locked = true;
    const token = session;
    renderBoard();
    let p = new Position(replayFen);
    replayAnalyses = [];
    $("#game-analysis-list").textContent =
      "Analizando. Puedes detener el proceso y conservar los resultados parciales.";
    try {
      for (let i = 0; i < replayMoves.length; i++) {
        if (token !== session) return;
        const before = p.fen(),
          color = p.turn,
          u = replayMoves[i];
        p.play(u);
        setStatus(
          `Stockfish: analizando jugada ${i + 1} de ${replayMoves.length}…`,
          `Stockfish is analyzing move ${i + 1} of ${replayMoves.length}.`,
        );
        const entry = await analyzePlayed(before, p.fen(), color, u, token, {
          initialFen: replayFen,
          moves: replayMoves.slice(0, i),
        });
        if (token !== session) return;
        replayAnalyses.push(entry);
        $("#game-analysis-list").innerHTML = replayAnalyses
          .map(
            (a, j) =>
              `<div class="mistake-row"><div><strong>${j + 1}. ${a.uci} · ${a.label}</strong><p>${(a.loss / 100).toFixed(2)} peones · profundidad ${a.depth}</p></div><button class="secondary" data-replay-to="${j + 1}">Ver</button></div>`,
          )
          .join("");
      }
      locked = false;
      setStatus(
        "Análisis terminado. Los errores importantes están guardados para repasar.",
        "Analysis complete. Important errors have been saved for review.",
      );
      renderBoard();
    } catch (error) {
      if (token !== session || error.message === "cancelled") return;
      locked = false;
      setStatus(error.message, "Analysis could not finish.", true);
      renderBoard();
    }
  }
  function exportPGN() {
    const c = new window.ChessRules(practiceInitial);
    c.setHeader("Event", "Entrenamiento Enroque");
    for (const r of records)
      c.move({
        from: r.uci.slice(0, 2),
        to: r.uci.slice(2, 4),
        promotion: r.uci[4],
      });
    download(
      "enroque-partida.pgn",
      c.pgn({ maxWidth: 80 }),
      "application/x-chess-pgn",
    );
  }
  function importFEN() {
    $("#lesson-content").innerHTML =
      '<h2>Entrenar una posición FEN</h2><p>Pega el FEN completo. Jugarás con el color que tiene el turno.</p><textarea id="fen-text" class="export-box"></textarea><button class="primary" data-load-fen>Cargar posición</button><p id="fen-error" class="notice"></p>';
    $("#fen-text").value = position.fen();
    $("#lesson").showModal();
  }
  function revealMoveHint() {
    const code = line[step];
    if (!code || complete) return;
    hinted = true;
    hintMove = {
      from: Position.index(code.slice(0, 2)),
      to: Position.index(code.slice(2, 4)),
      promotion: code[4] || null,
    };
    const from = code.slice(0, 2),
      to = code.slice(2, 4),
      promotion = code[4] ? ` y corona como ${names.es[code[4]]}` : "";
    setStatus(
      `Ayuda: mueve de ${from} a ${to}${promotion}. Las casillas de origen y destino están marcadas; tú haces el movimiento.`,
      `Hint: move from ${from} to ${to}${code[4] ? ", promote to " + names.en[code[4]] : ""}. The source and destination squares are highlighted. Play the move.`,
    );
    renderBoard();
    speak(currentStatus.es, currentStatus.en);
  }
  async function failedAttempt(legal) {
    selected = null;
    wrongAtStep++;
    if (current.type === "exercise") {
      const r = item(current.exercise.id);
      r.failures++;
      r.review = true;
      r.nextReview = Date.now();
      failedThisRun = true;
      activity();
    }
    if (wrongAtStep >= 3) {
      if (current.type === "practice") {
        locked = true;
        const token = session;
        setStatus(
          "Buscando una ayuda para este movimiento…",
          "Finding a hint for this move.",
        );
        renderBoard();
        try {
          const result = await analyze(position.fen(), {
            ms: 1200,
            depth: 24,
            multiPV: 1,
          });
          if (token !== session) return;
          locked = false;
          if (result.move) {
            const code = result.move;
            hintMove = {
              from: Position.index(code.slice(0, 2)),
              to: Position.index(code.slice(2, 4)),
              promotion: code[4],
            };
            setStatus(
              `Ayuda: mueve de ${code.slice(0, 2)} a ${code.slice(2, 4)}. Las dos casillas están marcadas.`,
              `Hint: move from ${code.slice(0, 2)} to ${code.slice(2, 4)}. Both squares are highlighted.`,
            );
            renderBoard();
            speak(currentStatus.es, currentStatus.en);
          }
        } catch (e) {
          if (token !== session) return;
          locked = false;
          setStatus(
            "No se pudo calcular la ayuda: " + e.message,
            "Could not calculate the hint.",
            true,
          );
          renderBoard();
        }
      } else revealMoveHint();
      return;
    }
    setStatus(
      `${legal ? "Ese movimiento no resuelve la combinación." : "Ese destino no es un movimiento legal para la pieza."} Intento ${wrongAtStep} de 3. Al tercer fallo verás de dónde a dónde mover.`,
      `${legal ? "That move does not solve the combination." : "That destination is not legal for this piece."} Attempt ${wrongAtStep} of 3. After the third failed attempt, the source and destination squares will be highlighted.`,
      true,
    );
    renderBoard();
    speak(currentStatus.es, currentStatus.en);
  }
  const lessonEnglish = [
    [
      "The board and the pieces",
      "The board has sixty four squares. Keep a light square at your right hand corner. Pawns move forward and capture diagonally. Knights jump in an L shape. Bishops move diagonally, rooks along ranks and files, and the queen combines both. The king moves one square and must never move into check.",
    ],
    [
      "The three opening principles",
      "Control the center. Develop knights and bishops instead of moving the same piece repeatedly. Castle to protect your king. Avoid bringing the queen out too early. Understand the plan before memorizing moves.",
    ],
    [
      "Double attacks, pins, and skewers",
      "Look for checks, captures, and threats for both sides. A double attack threatens two targets. A pin restricts a piece because a more valuable piece is behind it. A skewer attacks the valuable piece first. A discovered attack opens a line by moving another piece.",
    ],
    [
      "How to defend",
      "Identify the exact threat before choosing a response. Against check, move the king, capture the attacker, or block the line. A knight check cannot be blocked. Trade attacking pieces when that reduces pressure. Avoid weakening the pawns in front of your king.",
    ],
    [
      "Endgames: activate your king",
      "In endgames the king becomes an active piece. Use opposition in pawn endings. Create passed pawns. Rooks usually work well behind passed pawns. Watch for stalemate: a player without legal moves who is not in check draws the game.",
    ],
    [
      "Special rules",
      "Castling requires an unmoved king and rook, an empty path, and no attacked square on the kings route. A pawn reaching the last rank promotes. En passant is available only immediately after an opposing pawn advances two squares. Repetition, insufficient material, and the fifty move rule can draw a game.",
    ],
  ];
  function academy() {
    return (
      heading(
        "ENTIENDE ANTES DE MEMORIZAR",
        "Tu academia de ajedrez.",
        "Seis lecciones con lectura en español y audio en español o inglés.",
      ) +
      `<div class="library-grid">${COURSES.lessons.map((l, i) => `<article class="training-card"><div class="card-art"><span>${l.icon}</span></div><div class="card-body"><span class="tag">${l.level}</span><h3>${l.title}</h3><p>${l.body.split(".")[0]}.</p><button class="primary" data-lesson="${i}">${progress.read.includes(i) ? "Repasar" : "Aprender"} →</button></div></article>`).join("")}</div>`
    );
  }
  function showLesson(i) {
    const l = COURSES.lessons[i];
    $("#lesson-content").innerHTML =
      `<span class="eyebrow">ACADEMIA · ${l.level.toUpperCase()}</span><h2>${l.title}</h2><button class="secondary lesson-speech" data-speak-lesson="${i}">♫ Escuchar lección</button><p>${l.body}</p><ul>${l.items.map((t) => `<li>${t}</li>`).join("")}</ul><button class="primary" data-complete-lesson="${i}">${progress.read.includes(i) ? "✓ Completada" : "Marcar como completada"}</button>`;
    $("#lesson").showModal();
  }
  function mistakesList(all = false) {
    const list = progress.mistakes
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => all || !m.reviewed);
    if (!list.length)
      return '<p class="notice">Aún no tienes errores de partida pendientes. El análisis de tus jugadas añadirá posiciones aquí.</p>';
    return `<h2 style="margin-top:28px">Errores de tus partidas</h2><p class="notice">Estimaciones del motor local. Revisa la alternativa, no una supuesta verdad absoluta.</p>${list
      .slice(0, 30)
      .map(
        ({ m, i }) =>
          `<div class="mistake-row"><div><strong>${m.label} · ${m.color === "w" ? "blancas" : "negras"}</strong><p>Jugada ${m.uci} · pérdida estimada ${(m.loss / 100).toFixed(2)} peones · profundidad ${m.depth}${m.reviewed ? " · ✓ repasado" : ""}</p></div><button class="secondary" data-mistake="${i}">Practicar →</button></div>`,
      )
      .join("")}`;
  }
  function beginMistake(i) {
    const m = progress.mistakes[i];
    if (!m) return;
    const test = new Position(m.before);
    const legal = [];
    for (const u of m.pv.slice(0, 7)) {
      if (!test.play(u)) break;
      legal.push(u);
      if (!test.moves().length) break;
    }
    if (!legal.length) {
      toast("Esta posición no tiene una línea reproducible.");
      return;
    }
    const synthetic = {
      id: "review-" + i,
      title: "Revisa tu decisión: " + m.label,
      level: "intermedio",
      theme: "Defensa",
      fen: m.before,
      line: legal,
      hint:
        "La primera alternativa calculada es " +
        legal[0] +
        ". Compara su propósito con tu jugada " +
        m.uci +
        ".",
      explain:
        "Has recorrido la alternativa calculada. La evaluación era aproximada; revisa las amenazas y la actividad de las piezas.",
      goal: "line",
      sourceMistake: i,
    };
    cancel();
    current = { type: "exercise", exercise: synthetic };
    position = new Position(m.before);
    line = legal;
    step = 0;
    trainee = position.turn;
    flipped = trainee === "b";
    hinted = false;
    failedThisRun = false;
    item(synthetic.id).attempts++;
    $("#content").innerHTML = shell(
      synthetic.title,
      "Una oportunidad de aprender de tu propia partida.",
    );
    $("#board-panel").innerHTML =
      `<h2>Una decisión mejor.</h2><p>Tu jugada anterior fue ${m.uci}. La alternativa calculada empieza en ${m.best}.</p><div id="status" class="status"></div><div id="steps" class="step-track"></div><p id="hint-text" hidden>${synthetic.hint}</p><div id="moves" class="move-list"></div><div class="controls"><button class="secondary" data-action="hint">Pista</button><button class="secondary" data-action="solution">Ver próximo movimiento</button><button class="secondary" data-action="review-list">Volver a repasos</button></div><p class="notice">Línea calculada, no una solución única. Cada análisis tiene límites de profundidad.</p>`;
    setStatus(
      "Prueba la alternativa del motor y sigue las respuestas.",
      "Try the engine alternative and follow the replies.",
    );
    updateTraining();
    renderBoard();
  }
  function progressPage() {
    const total =
        solved("tactic") + progress.courses.length + progress.read.length,
      target = TRAINING.length + COURSE_PATHS + 6;
    const due = TRAINING.filter(isDue).length;
    return (
      heading(
        "TU TRABAJO, MEDIDO CON CONTEXTO",
        "Entrena con continuidad.",
        "Tu progreso es local. Exporta una copia para continuar en otro dispositivo.",
      ) +
      stats() +
      `<section class="panel"><h2>Tu recorrido</h2><p>${total} actividades completadas · ${progress.games} partidas terminadas · ${due} repasos pendientes.</p><div class="progress-bar"><div style="width:${(total / target) * 100}%"></div></div><div class="progress-list">${Object.entries(
        levelNames,
      )
        .map(([level, name]) => {
          const items = TRAINING.filter((t) => t.level === level);
          return `<div class="progress-item"><span>${name}</span><strong>${items.filter((t) => progress.items[t.id]?.solved).length} / ${items.length}</strong></div>`;
        })
        .join("")}${[
        "Clavadas",
        "Ataques dobles",
        "Descubiertas",
        "Sacrificios",
        "Defensa",
        "Mates",
      ]
        .map((theme) => {
          const items = TRAINING.filter((t) => t.themes.includes(theme));
          return `<div class="progress-item"><span>${theme}</span><strong>${items.filter((t) => progress.items[t.id]?.solved).length} / ${items.length}</strong></div>`;
        })
        .join(
          "",
        )}</div><div class="controls"><button class="primary" data-action="export-progress">Exportar progreso</button><button class="secondary" data-action="import-progress">Importar progreso</button><button class="secondary" data-action="reset-progress">Borrar progreso</button></div><input id="progress-file" type="file" accept="application/json,.json" hidden><p class="notice">El rating de un problema procede de Lichess. No es una evaluación de tu Elo ni un título de jugador. El repaso programa intervalos de 1, 3 y 7 días después de un acierto sin ayuda.</p>${memoryOnly ? '<p class="status error">El almacenamiento está bloqueado. Exporta antes de cerrar.</p>' : ""}${mistakesList(true)}</section>`
    );
  }

  function download(name, text, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function parseProgress(data) {
    if (
      !data ||
      data.version !== 3 ||
      typeof data.items !== "object" ||
      !Array.isArray(data.courses) ||
      !Array.isArray(data.read) ||
      !Array.isArray(data.days)
    )
      throw new Error("El archivo no es una copia de progreso de Enroque.");
    const clean = blank(),
      known = new Set(TRAINING.map((t) => t.id));
    for (const [id, r] of Object.entries(data.items)) {
      if (!known.has(id) || !r || typeof r !== "object") continue;
      clean.items[id] = {
        attempts: Math.max(0, Number(r.attempts) || 0),
        failures: Math.max(0, Number(r.failures) || 0),
        solved: r.solved === true,
        review: r.review === true,
        passes: Math.max(0, Number(r.passes) || 0),
        nextReview: Number(r.nextReview) || 0,
      };
    }
    clean.courses = [
      ...new Set(
        data.courses.filter(
          (v) =>
            typeof v === "string" &&
            OPENING_LINES.some(
              (r) =>
                v === r.id + ":w" || (r.line.length >= 2 && v === r.id + ":b"),
            ),
        ),
      ),
    ];
    clean.read = [
      ...new Set(
        data.read.filter((v) => Number.isInteger(v) && v >= 0 && v < 6),
      ),
    ];
    clean.days = [
      ...new Set(
        data.days.filter(
          (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
        ),
      ),
    ];
    clean.games = Math.max(0, Number(data.games) || 0);
    clean.audio = ["off", "es", "en"].includes(data.audio) ? data.audio : "off";
    for (const m of (Array.isArray(data.mistakes) ? data.mistakes : []).slice(
      0,
      100,
    )) {
      try {
        if (
          !m ||
          typeof m.before !== "string" ||
          !Array.isArray(m.pv) ||
          !["w", "b"].includes(m.color) ||
          ![
            "Error importante",
            "Error",
            "Imprecisión",
            "Jugada razonable",
          ].includes(m.label)
        )
          continue;
        const p = new Position(m.before);
        if (
          p.b.length !== 64 ||
          p.b.filter((x) => x === "K").length !== 1 ||
          p.b.filter((x) => x === "k").length !== 1 ||
          !["w", "b"].includes(p.turn) ||
          !Number.isFinite(p.half) ||
          !Number.isFinite(p.full)
        )
          continue;
        const pv = [];
        for (const u of m.pv.slice(0, 20)) {
          if (
            typeof u !== "string" ||
            !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u) ||
            !p.play(u)
          )
            break;
          pv.push(u);
        }
        if (
          !pv.length ||
          !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.uci) ||
          !Number.isFinite(m.loss) ||
          m.loss < 0
        )
          continue;
        clean.mistakes.push({
          before: m.before,
          color: m.color,
          uci: m.uci,
          best: pv[0],
          pv,
          loss: m.loss,
          label: m.label,
          depth: Math.max(0, Math.min(99, Number(m.depth) || 0)),
          reviewed: m.reviewed === true,
        });
      } catch {}
    }
    return clean;
  }
  function route() {
    if (location.protocol === "file:") return;
    if (!TRAINING.length || !OPENING_LINES.length) {
      $("#content").innerHTML =
        '<div class="error-box"><h2>Faltan los bancos de entrenamiento</h2><p>Copia las carpetas data y engine junto a index.html e inicia INICIAR.bat.</p></div>';
      return;
    }
    cancel();
    page = location.hash.slice(1) || "inicio";
    current = null;
    flipped = false;
    filter = {
      level: "all",
      theme: "all",
      status: "all",
      length: "multi",
      query: "",
    };
    bankPage = 0;
    document
      .querySelectorAll("nav a")
      .forEach((a) => a.classList.toggle("active", a.dataset.page === page));
    $("#crumb").textContent =
      {
        inicio: "Mi entrenamiento",
        practicar: "Jugar y practicar",
        tactica: "Tácticas",
        aperturas: "Aperturas",
        finales: "Finales",
        repaso: "Repasar fallos",
        academia: "Academia",
        progreso: "Mi progreso",
      }[page] || "Mi entrenamiento";
    if (page === "practicar") {
      practiceInitial = Position.START;
      practice();
    } else if (["tactica", "finales", "repaso"].includes(page))
      $("#content").innerHTML =
        bank() + (page === "repaso" ? mistakesList() : "");
    else if (page === "aperturas") $("#content").innerHTML = openingsLibrary();
    else if (page === "academia") $("#content").innerHTML = academy();
    else if (page === "progreso") $("#content").innerHTML = progressPage();
    else $("#content").innerHTML = home();
    window.scrollTo(0, 0);
    if (window.matchMedia("(max-width:700px)").matches)
      document
        .querySelector("nav a.active")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function courseStep(forward) {
    if (locked) return;
    if (forward && step < line.length) {
      const m = position.play(line[step]);
      if (!m) return;
      step++;
      last = [m.from, m.to];
      courseIdea();
      updateTraining();
      renderBoard();
      speak(currentStatus.es, currentStatus.en);
    } else if (!forward && step > 0) {
      position.undo();
      step--;
      last = [];
      complete = false;
      courseIdea();
      if (step === 0)
        setStatus(
          "Posición inicial. Avanza para empezar.",
          "Starting position. Move forward to begin.",
        );
      updateTraining();
      renderBoard();
    }
    if (step === line.length)
      setStatus(
        "Recorrido completo. Selecciona Practicar y juega la variante con el color que prefieras.",
        "Walkthrough complete. Choose practice mode and train either side.",
      );
  }
  function showTextModal(title, text) {
    $("#lesson-content").innerHTML =
      `<h2>${title}</h2><textarea class="export-box" readonly></textarea><p class="notice">Puedes seleccionar y copiar este texto.</p>`;
    $("#lesson-content textarea").value = text;
    $("#lesson").showModal();
  }
  $("#content").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.square !== undefined) {
      squareClick(Number(b.dataset.square));
      return;
    }
    if (b.dataset.theme) {
      filter.theme = b.dataset.theme;
      bankPage = 0;
      $("#content").innerHTML = bank();
      return;
    }
    if (b.dataset.lab !== undefined) {
      const lab = ENDGAME_LABS[Number(b.dataset.lab)];
      practiceInitial = lab.fen;
      practiceSide = lab.side;
      practiceMode = "bot";
      strength = "6";
      practice();
      $("#board-panel").insertAdjacentHTML(
        "afterbegin",
        `<div class="lab-objective"><strong>${lab.name}</strong><p>${lab.goal}</p></div>`,
      );
      return;
    }
    if (b.dataset.train) {
      beginTraining(b.dataset.train);
      return;
    }
    if (b.dataset.course !== undefined) {
      beginCourse(Number(b.dataset.course));
      return;
    }
    if (b.dataset.lesson !== undefined) {
      showLesson(Number(b.dataset.lesson));
      return;
    }
    if (b.dataset.mistake !== undefined) {
      beginMistake(Number(b.dataset.mistake));
      return;
    }
    const action = b.dataset.action;
    if (
      b.dataset.replayTo !== undefined &&
      current?.type === "replay" &&
      !locked
    ) {
      replayIndex = Number(b.dataset.replayTo);
      renderReplay();
      return;
    }
    if (action === "import-pgn") {
      openImport();
      return;
    }
    if (action === "import-fen") {
      importFEN();
      return;
    }
    if (action === "export-game") {
      exportPGN();
      return;
    }
    if (action === "replay-prev" && !locked) {
      replayIndex = Math.max(0, replayIndex - 1);
      renderReplay();
      return;
    }
    if (action === "replay-next" && !locked) {
      replayIndex = Math.min(replayMoves.length, replayIndex + 1);
      renderReplay();
      return;
    }
    if (action === "replay-play" && !locked) {
      practiceInitial = position.fen();
      practiceSide = position.turn;
      practiceMode = "bot";
      practice();
      return;
    }
    if (action === "analyze-pgn") {
      analyzePGN();
      return;
    }
    if (action === "cancel-pgn") {
      cancel();
      setStatus(
        "Análisis detenido. Los resultados parciales se conservan.",
        "Analysis stopped. Partial results are preserved.",
      );
      renderBoard();
      return;
    }
    if (action === "bank-prev" || action === "bank-next") {
      bankPage += action === "bank-next" ? 1 : -1;
      $("#content").innerHTML = bank();
      window.scrollTo(0, 0);
      return;
    }
    if (action === "random-training") {
      const data = bankData();
      if (data.length)
        beginTraining(data[Math.floor(Math.random() * data.length)].id);
      return;
    }
    if (action === "opening-search") {
      openingQuery = $("#opening-search").value.trim().slice(0, 120);
      openingEco = $("#opening-eco").value;
      openingPage = 0;
      $("#content").innerHTML = openingsLibrary();
      return;
    }
    if (action === "opening-prev" || action === "opening-next") {
      openingPage += action === "opening-next" ? 1 : -1;
      $("#content").innerHTML = openingsLibrary();
      window.scrollTo(0, 0);
      return;
    }
    if (action === "flip") {
      flipped = !flipped;
      renderBoard();
    }
    if (action === "read-status") speak(currentStatus.es, currentStatus.en);
    if (action === "retry" && current?.type === "exercise") {
      if (current.exercise.sourceMistake !== undefined)
        beginMistake(current.exercise.sourceMistake);
      else beginTraining(current.exercise.id);
    }
    if (action === "next-training") {
      const pool = bankData();
      const index = pool.findIndex((t) => t.id === current.exercise.id);
      if (pool.length) beginTraining(pool[(index + 1) % pool.length].id);
    }
    if (action === "hint" && !complete) {
      hinted = true;
      $("#hint-text").hidden = false;
      const t = current.exercise;
      speak(
        t.hint,
        `Hint. ${nextExpected()?.en || "The exercise is complete."}`,
      );
    }
    if (action === "solution" && !complete) {
      revealMoveHint();
      return;
      hinted = true;
      const hint = nextExpected();
      if (hint) {
        setStatus(
          "Próximo movimiento: " + hint.es + ". Hazlo en el tablero.",
          "Next move: " + hint.en + ". Play it on the board.",
        );
        speak(currentStatus.es, currentStatus.en);
      }
    }
    if (action === "course-next") courseStep(true);
    if (action === "course-prev") courseStep(false);
    if (action === "course-retry")
      beginCourse(courseIndex, variantIndex, courseSide, courseMode);
    if (action === "course-hint" && !complete) {
      revealMoveHint();
      return;
      const hint = nextExpected();
      if (hint) {
        setStatus("Próximo movimiento: " + hint.es, "Next move: " + hint.en);
        speak(currentStatus.es, currentStatus.en);
      }
    }
    if (action === "new-game") {
      if (
        !records.length ||
        confirm("¿Iniciar una partida nueva? La partida actual se cerrará.")
      )
        practice();
    }
    if (action === "undo" && current?.type === "practice") {
      cancel();
      const n =
        practiceMode === "bot" && position.turn === practiceSide ? 2 : 1;
      for (let i = 0; i < n && records.length; i++) {
        position.undo();
        records.pop();
      }
      if (
        practiceMode === "bot" &&
        position.turn !== practiceSide &&
        records.length
      ) {
        position.undo();
        records.pop();
      }
      last = [];
      $("#analysis").textContent =
        "Posición recuperada. Los análisis anteriores siguen guardados en Mi progreso.";
      updatePractice();
      renderBoard();
      if (practiceMode === "bot" && position.turn !== practiceSide) botTurn();
    }
    if (action === "analyze") analyzePosition();
    if (action === "game-review") {
      const reviewed = records.filter((r) => r.analysis);
      showTextModal(
        "Revisión de tus jugadas",
        reviewed.length
          ? reviewed
              .map(
                (r) =>
                  `${r.text}: ${r.analysis.label}. Pérdida estimada ${(r.analysis.loss / 100).toFixed(2)} peones. Alternativa ${r.analysis.best}. Profundidad ${r.analysis.depth}.`,
              )
              .join("\n\n")
          : "Todavía no hay jugadas analizadas. Juega una jugada para empezar.",
      );
    }
    if (action === "last-mistake" && progress.mistakes.length) beginMistake(0);
    if (action === "review-list") {
      location.hash = "#repaso";
      if (page === "repaso") route();
    }
    if (action === "export-game") {
      const text =
        "Enroque · partida local\nFEN inicial: " +
        practiceInitial +
        "\n\nMovimientos UCI:\n" +
        records.map((r) => r.uci).join(" ") +
        "\n\nFEN actual: " +
        position.fen();
      download("enroque-partida.txt", text);
    }
    if (action === "export-progress")
      download(
        "enroque-progreso.json",
        JSON.stringify(progress, null, 2),
        "application/json",
      );
    if (action === "import-progress") $("#progress-file").click();
    if (
      action === "reset-progress" &&
      confirm(
        "¿Borrar todo el progreso de este navegador? Exporta una copia antes si deseas conservarlo.",
      )
    ) {
      progress = blank();
      save();
      $("#audio-lang").value = "off";
      $("#streak").textContent = "0";
      route();
    }
  });
  $("#content").addEventListener("change", async (e) => {
    const id = e.target.id;
    if (id.startsWith("filter-")) {
      filter[id.replace("filter-", "")] = e.target.value;
      bankPage = 0;
      $("#content").innerHTML =
        bank() + (page === "repaso" ? mistakesList() : "");
    }
    if (id === "opening-eco") {
      openingEco = e.target.value;
      openingQuery = $("#opening-search").value;
      openingPage = 0;
      $("#content").innerHTML = openingsLibrary();
    }
    if (id.startsWith("course-")) {
      const vi = Number($("#course-variant").value),
        side = $("#course-side").value,
        cm = $("#course-mode").value;
      beginCourse(courseIndex, vi, side, cm);
    }
    if (id === "strength") strength = e.target.value;
    if (id === "analysis-time") analysisMs = Number(e.target.value);
    if (id === "practice-side" || id === "practice-mode") {
      if (
        records.length &&
        !confirm("Cambiar esta opción inicia una partida nueva. ¿Continuar?")
      ) {
        e.target.value = id === "practice-side" ? practiceSide : practiceMode;
        return;
      }
      practiceSide = $("#practice-side").value;
      practiceMode = $("#practice-mode").value;
      practice();
    }
    if (id === "progress-file" && e.target.files[0]) {
      try {
        if (e.target.files[0].size > 10 * 1024 * 1024)
          throw new Error("El archivo es demasiado grande. Máximo 10 MB.");
        const clean = parseProgress(JSON.parse(await e.target.files[0].text()));
        if (confirm("¿Reemplazar el progreso actual por esta copia?")) {
          progress = clean;
          save();
          $("#audio-lang").value = progress.audio;
          $("#streak").textContent = streak();
          route();
          toast("Progreso importado.");
        }
      } catch (error) {
        toast("No se pudo importar: " + error.message);
      }
    }
  });
  $("#lesson").addEventListener("click", (e) => {
    if (e.target.closest(".close")) {
      $("#lesson").close();
      window.speechSynthesis?.cancel();
    }
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-load-pgn")) {
      try {
        importPGN($("#pgn-text").value);
      } catch (error) {
        $("#pgn-error").textContent =
          "No se pudo importar el PGN: " + error.message;
      }
      return;
    }
    if (b.hasAttribute("data-load-fen")) {
      try {
        const fen = $("#fen-text").value.trim();
        const checked = new window.ChessRules(fen),
          test = new Position(fen);
        if (test.check(test.turn === "w" ? "b" : "w"))
          throw new Error(
            "El rey del bando que acaba de mover no puede estar en jaque.",
          );
        practiceInitial = checked.fen();
        practiceSide = checked.turn();
        practiceMode = "bot";
        $("#lesson").close();
        practice();
      } catch (error) {
        $("#fen-error").textContent = "FEN no válido: " + error.message;
      }
      return;
    }
    if (b.dataset.completeLesson !== undefined) {
      const i = Number(b.dataset.completeLesson);
      if (!progress.read.includes(i)) progress.read.push(i);
      activity();
      $("#lesson").close();
      route();
    }
    if (b.dataset.speakLesson !== undefined) {
      const i = Number(b.dataset.speakLesson),
        l = COURSES.lessons[i];
      speak(
        l.title + ". " + l.body + " " + l.items.join(". "),
        lessonEnglish[i].join(". "),
      );
    }
  });
  $("#lesson").addEventListener("close", () =>
    window.speechSynthesis?.cancel(),
  );
  $("#audio-lang").value = progress.audio;
  $("#audio-lang").addEventListener("change", (e) => {
    progress.audio = e.target.value;
    save();
    window.speechSynthesis?.cancel();
    if (progress.audio !== "off")
      speak(
        "Audio en español activado. Usa el botón Escuchar explicación para repetir una indicación.",
        "English audio enabled. Use the read explanation button to hear an instruction again.",
      );
  });
  $("#audio-stop").onclick = () => window.speechSynthesis?.cancel();
  $("#help").onclick = () => {
    $("#lesson-content").innerHTML =
      '<span class="eyebrow">ENTRENAMIENTO PERSONAL SIN CONEXIÓN</span><h2>Tu club, a tu ritmo.</h2><p>10.000 problemas de partidas reales, 4.660 problemas de finales y 3.865 líneas ECO para ambos colores. En las líneas guiadas juegas tu parte y el rival responde. Las pistas cuentan como ayuda: repasa después sin ellas.</p><p>El rival y el análisis calculan en este dispositivo. El análisis usa Stockfish 17.1. El audio usa voces del sistema: instala una voz española o inglesa para escuchar sin conexión.</p><p>En Mi progreso puedes exportar una copia e importarla en otro dispositivo. La página no envía datos a ningún servidor.</p>';
    $("#lesson").showModal();
  };
  document.querySelector("nav").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a && a.hash === location.hash) {
      e.preventDefault();
      route();
    }
  });
  window.addEventListener("hashchange", route);
  $("#streak").textContent = streak();
  route();
})();
