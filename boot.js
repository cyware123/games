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
