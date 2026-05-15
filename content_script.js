// content_script.js

(function () {
  "use strict";

  /* ---- Injeta o hooker no contexto da pagina ---- */
  try {
    const s = document.createElement("script");
    s.src = browser.runtime.getURL("injected.js");
    s.async = false;
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn("[PrivacyMonitor] falha ao injetar:", e);
  }

  /* ---- Recebe eventos de fingerprinting do contexto da pagina ---- */
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__privacyMonitor !== true) return;
    if (d.type === "FINGERPRINT") {
      browser.runtime.sendMessage({
        type: "FINGERPRINT",
        api: d.api,
        method: d.method,
        stack: d.stack
      }).catch(() => {});
    }
  });

  /* ---- Coleta Web Storage ---- */
  function collectStorage(storage) {
    const items = {};
    let totalBytes = 0;
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        const v = storage.getItem(k) || "";
        items[k] = v.length;
        totalBytes += k.length + v.length;
      }
    } catch (e) {}
    return { items, totalBytes, count: Object.keys(items).length };
  }

  function reportStorage() {
    const ls = collectStorage(window.localStorage);
    const ss = collectStorage(window.sessionStorage);

    const finishWith = (idbList) => {
      browser.runtime.sendMessage({
        type: "STORAGE_REPORT",
        payload: {
          localStorage: ls,
          sessionStorage: ss,
          indexedDB: idbList,
          domain: location.hostname
        }
      }).catch(() => {});
    };

    if (window.indexedDB && typeof indexedDB.databases === "function") {
      indexedDB.databases()
        .then((dbs) => finishWith((dbs || []).map((db) => ({
          name: db.name,
          version: db.version
        }))))
        .catch(() => finishWith([]));
    } else {
      finishWith([]);
    }
  }

  /* ---- Detecta scripts externos suspeitos ---- */
  function checkSuspiciousScripts() {
    const here = location.hostname;
    document.querySelectorAll("script[src]").forEach((s) => {
      try {
        const u = new URL(s.src, location.href);
        if (u.protocol === "data:" || u.protocol === "javascript:") {
          browser.runtime.sendMessage({
            type: "SUSPICIOUS_SCRIPT",
            payload: { src: s.src.slice(0, 200), reason: "protocolo-perigoso" }
          }).catch(() => {});
          return;
        }
        const isExternal = u.hostname && u.hostname !== here;
        const namePattern = /(hook\.js|\/beef\/|coinhive|cryptonight|miner|webcrypt|ransom|inject\.js|stealer|keylog)/i;
        if (isExternal && namePattern.test(u.href)) {
          browser.runtime.sendMessage({
            type: "SUSPICIOUS_SCRIPT",
            payload: {
              src: u.href.slice(0, 200),
              reason: "nome-suspeito",
              externalHost: u.hostname
            }
          }).catch(() => {});
        }
      } catch (e) {}
    });
  }

  /* ---- Triggers de coleta ---- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      checkSuspiciousScripts();
      setTimeout(reportStorage, 200);
    });
  } else {
    checkSuspiciousScripts();
    setTimeout(reportStorage, 200);
  }

  window.addEventListener("load", () => {
    setTimeout(reportStorage, 1500);
    setTimeout(checkSuspiciousScripts, 1500);
  });

})();