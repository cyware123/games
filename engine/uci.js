/* Stockfish 17.1 adapter: one serialized UCI queue, full-strength analysis. */
(() => {
  class StockfishClient {
    constructor() {
      this.worker = null;
      this.queue = [];
      this.active = null;
      this.ready = null;
      this.generation = 0;
    }
    createWorkerURL() {
      const embedded = window.ENROQUE_ENGINE;
      if (!embedded?.source || !embedded?.wasmBase64)
        throw new Error(
          "Falta engine/embedded.js. Conserva la carpeta completa junto a index.html.",
        );
      if (!window.ENROQUE_ENGINE_URLS) {
        const decoded = atob(embedded.wasmBase64);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++)
          bytes[i] = decoded.charCodeAt(i);
        const wasmURL = URL.createObjectURL(
          new Blob([bytes], { type: "application/wasm" }),
        );
        const scriptURL = URL.createObjectURL(
          new Blob([embedded.source], { type: "text/javascript" }),
        );
        // The upstream worker accepts its WASM URL in the hash. Both blobs are
        // created by this document; no fetch of file:// assets is needed.
        window.ENROQUE_ENGINE_URLS = { wasmURL, scriptURL };
      }
      const { scriptURL, wasmURL } = window.ENROQUE_ENGINE_URLS;
      return scriptURL + "#" + encodeURIComponent(wasmURL);
    }
    boot() {
      if (this.ready) return this.ready;
      const generation = this.generation;
      this.ready = new Promise((resolve, reject) => {
        let settled = false;
        this.bootReject = reject;
        this.bootTimer = null;
        const fail = (message) => {
          if (generation !== this.generation) return;
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(new Error(message));
          }
          this.rejectAll(message);
        };
        const timer = setTimeout(
          () =>
            fail(
              "Stockfish no terminó de cargar. Comprueba que engine/embedded.js está completo.",
            ),
          30000,
        );
        this.bootTimer = timer;
        try {
          this.worker = new Worker(this.createWorkerURL());
          this.worker.onerror = () =>
            fail(
              "No se pudo cargar Stockfish. Abre index.html en una versión actualizada de Chrome, Edge o Firefox y conserva engine/embedded.js.",
            );
          this.worker.onmessage = (e) => {
            const text = String(e.data);
            if (text === "uciok") {
              this.worker.postMessage("setoption name Threads value 1");
              this.worker.postMessage("setoption name Hash value 32");
              this.worker.postMessage("setoption name UCI_ShowWDL value true");
              this.worker.postMessage("isready");
            }
            if (text === "readyok" && !settled) {
              settled = true;
              clearTimeout(timer);
              this.bootReject = null;
              resolve();
              return;
            }
            this.receive(text);
          };
          this.worker.postMessage("uci");
        } catch (e) {
          fail("El navegador no permite cargar el motor local: " + e.message);
        }
      });
      return this.ready;
    }
    receive(text) {
      const job = this.active;
      if (!job) return;
      if (
        /^info .*\bscore (cp|mate) /.test(text) &&
        /\bpv /.test(text) &&
        !/\b(lowerbound|upperbound)\b/.test(text)
      ) {
        const field = (name, def = 0) =>
          Number(
            text.match(new RegExp("(?:^| )" + name + " (-?\\d+)"))?.[1] ?? def,
          );
        const match = text.match(/\bscore (cp|mate) (-?\d+)/),
          value = Number(match[2]),
          mate = match[1] === "mate" ? value : null;
        const result = {
          score:
            mate === null
              ? value
              : Math.sign(mate || -1) * (100000 - Math.abs(mate)),
          mate,
          scoreType: match[1],
          depth: field("depth"),
          nodes: field("nodes"),
          pv: text.split(" pv ")[1].trim().split(/\s+/),
          multipv: field("multipv", 1),
          wdl:
            text
              .match(/\bwdl (\d+) (\d+) (\d+)/)
              ?.slice(1)
              .map(Number) || null,
        };
        job.lines.set(result.multipv, result);
      }
      if (text.startsWith("bestmove ")) {
        clearTimeout(job.timeout);
        const first = job.lines.get(1);
        const move = text.split(" ")[1];
        const result = {
          ...(first || {
            score: 0,
            mate: null,
            scoreType: "cp",
            depth: 0,
            nodes: 0,
            pv: [],
          }),
          move: move === "(none)" || move === "0000" ? null : move,
          lines: [...job.lines.values()].sort((a, b) => a.multipv - b.multipv),
          ms: Date.now() - job.started,
          engine: "Stockfish 17.1 lite",
        };
        this.active = null;
        job.resolve(result);
        this.pump();
      }
    }
    async search(fen, options = {}) {
      const generation = this.generation;
      try {
        await this.boot();
      } catch (error) {
        if (generation === this.generation) this.cancel(error.message);
        throw error;
      }
      if (generation !== this.generation) throw new Error("cancelled");
      return new Promise((resolve, reject) => {
        this.queue.push({ fen, options, resolve, reject });
        this.pump();
      });
    }
    pump() {
      if (this.active || !this.worker || !this.queue.length) return;
      const job = this.queue.shift();
      this.active = job;
      job.lines = new Map();
      job.started = Date.now();
      const ms = Math.max(150, Math.min(30000, Number(job.options.ms) || 2500));
      job.timeout = setTimeout(() => {
        this.cancel(
          "Stockfish no respondió dentro del límite. Reinicia el cálculo.",
        );
      }, ms + 12000);
      this.worker.postMessage(
        "setoption name Skill Level value " + (job.options.skill ?? 20),
      );
      this.worker.postMessage("setoption name UCI_LimitStrength value false");
      this.worker.postMessage(
        "setoption name MultiPV value " +
          Math.max(1, Math.min(3, job.options.multiPV || 1)),
      );
      this.worker.postMessage(
        "position fen " +
          (job.options.initialFen || job.fen) +
          (job.options.moves?.length
            ? " moves " + job.options.moves.join(" ")
            : ""),
      );
      this.worker.postMessage(
        "go movetime " +
          ms +
          (job.options.depth
            ? " depth " + Math.max(1, Math.min(60, job.options.depth))
            : ""),
      );
    }
    rejectAll(message) {
      if (this.active) {
        clearTimeout(this.active.timeout);
        this.active.reject(new Error(message));
        this.active = null;
      }
      for (const job of this.queue) job.reject(new Error(message));
      this.queue = [];
    }
    cancel(message = "cancelled") {
      this.generation++;
      clearTimeout(this.bootTimer);
      if (this.bootReject) {
        this.bootReject(new Error(message));
        this.bootReject = null;
      }
      this.rejectAll(message);
      this.worker?.terminate();
      this.worker = null;
      this.ready = null;
    }
  }
  window.StockfishClient = StockfishClient;
})();
