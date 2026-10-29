/* Diagnóstico temprano: evita una pantalla vacía por archivos incompletos. */
(() => {
  function notice(message) {
    const show = () => {
      let el = document.getElementById("boot-error");
      if (!el) {
        el = document.createElement("div");
        el.id = "boot-error";
        el.className = "server-warning";
        document.body.prepend(el);
      }
      const p = document.createElement("p");
      p.textContent = message;
      el.append(p);
    };
    document.body
      ? show()
      : document.addEventListener("DOMContentLoaded", show, { once: true });
  }
  window.addEventListener(
    "error",
    (event) => {
      if (
        event.target?.tagName === "SCRIPT" ||
        event.target?.tagName === "LINK"
      )
        notice(
          "No se pudo cargar " +
            (event.target.src || event.target.href) +
            ". Copia el proyecto completo, incluidas data, engine y vendor.",
        );
      else if (event.message)
        notice(
          "Error: " +
            event.message +
            " · línea " +
            event.lineno +
            ". Comprueba que app.js se copió completo.",
        );
    },
    true,
  );
  document.addEventListener("DOMContentLoaded", () => {
    if (location.protocol === "file:") {
      const content = document.getElementById("content");
      if (content)
        content.innerHTML =
          '<section class="server-warning"><h2>Inicia Enroque desde INICIAR.bat</h2><p>Stockfish necesita un servidor local para cargar el motor. No requiere Internet ni una cuenta.</p><p>En Windows, cierra esta página y abre <strong>INICIAR.bat</strong> dentro de la carpeta del proyecto. Se abrirá el navegador automáticamente.</p><p>En macOS o Linux ejecuta:</p><code>python3 -m http.server 8765</code><p>Después abre http://127.0.0.1:8765. Conserva las carpetas data, engine y vendor junto al HTML.</p></section>';
    }
    if (
      !getComputedStyle(document.documentElement)
        .getPropertyValue("--green")
        .trim()
    )
      notice(
        "Faltan estilos. Reemplaza style.css con el archivo completo del proyecto.",
      );
  });
})();
