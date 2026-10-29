/* Stockfish 17.1 adapter: one serialized UCI queue, full-strength analysis. */
(() => {
  class StockfishClient {
    constructor(options = {}) {
      this.preferredMode = options.mode || "auto";
      this.activeMode = null;
      this.startupDiagnostics = [];
      this.worker = null;
      this.queue = [];
      this.active = null;
      this.ready = null;
      this.generation = 0;
    }
    createWorkerURL(mode) {
      const embedded = window.ENROQUE_ENGINE;
      if (!embedded)
        throw new Error(
          "Falta engine/embedded.js. Extrae la carpeta completa o abre el HTML portátil actualizado.",
        );
      window.ENROQUE_ENGINE_WORKERS ||= {};
      if (window.ENROQUE_ENGINE_WORKERS[mode])
        return window.ENROQUE_ENGINE_WORKERS[mode];
      let source;
      if (mode === "js") {
        if (!embedded.compatibilitySource)
          throw new Error(
            "Falta el motor de compatibilidad. Usa la versión actualizada del proyecto.",
          );
        source = "self.WebAssembly=undefined;\n" + embedded.compatibilitySource;
      } else {
        if (!embedded.source || !embedded.wasmBase64)
          throw new Error("Los datos del motor están incompletos.");
        const pattern = "u=function(n){r={locateFile:function(e)";
        if (embedded.source.split(pattern).length !== 2)
          throw new Error(
            "La interfaz de esta versión del motor no coincide con el adaptador.",
          );
        // Supply Emscripten wasmBinary directly. The worker never fetches a
        // file: or blob: URL for WASM, which avoids file-origin restrictions.
        const configured = embedded.source.replace(
          pattern,
          "u=function(n){r={wasmBinary:self.__ENROQUE_WASM,locateFile:function(e)",
        );
        source =
          'self.onmessage=function(event){if(event.data?.type!=="enroque-init")return;self.__ENROQUE_WASM=new Uint8Array(event.data.buffer);self.onmessage=null;(function(){\n' +
          configured +
          "\n})();};";
      }
      const url = URL.createObjectURL(
        new Blob([source], { type: "text/javascript" }),
      );
      window.ENROQUE_ENGINE_WORKERS[mode] = url;
      return url;
    }
    boot() {
      if (this.ready) return this.ready;
      this.startupDiagnostics = [];
      const generation = this.generation;
      this.ready = this.bootModes(generation);
      return this.ready;
    }
    async bootModes(generation) {
      const modes =
        this.preferredMode === "js"
          ? ["js"]
          : this.preferredMode === "wasm"
            ? ["wasm"]
            : ["wasm", "js"];
      for (const mode of modes) {
        try {
          await this.bootMode(mode, generation);
          return;
        } catch (error) {
          if (generation !== this.generation || error.message === "cancelled")
            throw new Error("cancelled");
          this.startupDiagnostics.push(
            (mode === "wasm" ? "WebAssembly" : "JavaScript") +
              ": " +
              error.message,
          );
          this.worker?.terminate();
          this.worker = null;
        }
      }
      throw new Error(
        "Stockfish no pudo iniciar. " + this.startupDiagnostics.join(" | "),
      );
    }
    bootMode(mode, generation) {
      return new Promise((resolve, reject) => {
        let settled = false,
          ownedWorker = null;
        this.bootReject = reject;
        const fail = (message) => {
          if (
            generation !== this.generation ||
            (ownedWorker && this.worker !== ownedWorker)
          )
            return;
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            this.bootReject = null;
            reject(new Error(message));
          } else {
            this.rejectAll(message);
            this.ready = null;
          }
          this.worker?.terminate();
          this.worker = null;
        };
        const timer = setTimeout(
          () => fail("El motor no terminó de iniciar dentro de 30 segundos."),
          30000,
        );
        this.bootTimer = timer;
        try {
          this.worker = new Worker(this.createWorkerURL(mode));
          ownedWorker = this.worker;
          this.worker.onerror = (event) => {
            event.preventDefault?.();
            fail(event.message || "El navegador detuvo el proceso del motor.");
          };
          this.worker.onmessage = (event) => {
            if (generation !== this.generation || this.worker !== ownedWorker)
              return;
            const text = String(event.data);
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
              this.activeMode = mode;
              window.dispatchEvent(
                new CustomEvent("enroque-engine-ready", {
                  detail: {
                    mode,
                    diagnostics: this.startupDiagnostics.slice(),
                  },
                }),
              );
              resolve();
              return;
            }
            this.receive(text);
          };
          if (mode === "wasm") {
            const decoded = atob(window.ENROQUE_ENGINE.wasmBase64),
              bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++)
              bytes[i] = decoded.charCodeAt(i);
            this.worker.postMessage(
              { type: "enroque-init", buffer: bytes.buffer },
              [bytes.buffer],
            );
          }
          this.worker.postMessage("uci");
        } catch (error) {
          fail(error.message);
        }
      });
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
          engine:
            this.activeMode === "js"
              ? "Stockfish 17.1 · compatibilidad JavaScript"
              : "Stockfish 17.1 lite",
          mode: this.activeMode,
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
