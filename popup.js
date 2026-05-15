// popup.js
"use strict";

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
  }
  return e;
}

function clear(id) {
  const node = document.getElementById(id);
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

function empty(msg) {
  return el("div", { class: "empty" }, msg || "Nenhum dado.");
}

function fmtBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.dataset.panel === t);
    });
  });
});

/* ---------- Score ---------- */
function renderScore(data) {
  const score = data.privacyScore ?? 100;
  const box = document.getElementById("score-box");

  let cls, label;
  if (score >= 80) { cls = "good";   label = "Boa privacidade"; }
  else if (score >= 60) { cls = "medium"; label = "Privacidade moderada"; }
  else if (score >= 40) { cls = "bad";    label = "Privacidade ruim"; }
  else                  { cls = "critic"; label = "Privacidade critica"; }

  box.className = cls;
  box.textContent = "Privacy Score: " + score + "/100 - " + label;
}

/* ---------- Dominios ---------- */
function renderDomains(data) {
  const domains = data.thirdPartyDomains || [];
  document.getElementById("badge-domains").textContent = domains.length;
  clear("domains-list");
  const list = document.getElementById("domains-list");

  if (!domains.length) {
    list.appendChild(empty("Nenhum dominio de terceira parte detectado."));
    return;
  }

  domains
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .forEach((d) => {
      const types = (d.types || []).map((t) => el("span", { class: "tag info" }, t));
      const row = el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, d.domain || d.baseDomain || "-"),
        el("div", { class: "row-meta" }, [
          ...types,
          document.createTextNode(" " + (d.count || 1) + " req")
        ])
      ]);
      list.appendChild(row);
    });
}

/* ---------- Cookies ---------- */
function renderCookies(data) {
  const fp = data.cookies?.firstParty  || [];
  const tp = data.cookies?.thirdParty  || [];
  const se = data.cookies?.session     || [];
  const pe = data.cookies?.persistent  || [];
  const sc = data.cookies?.superCookies || [];

  document.getElementById("badge-cookies").textContent = fp.length + tp.length;
  document.getElementById("c-first").textContent   = fp.length;
  document.getElementById("c-third").textContent   = tp.length;
  document.getElementById("c-session").textContent = se.length;
  document.getElementById("c-persist").textContent = pe.length;

  clear("cookies-list");
  const list = document.getElementById("cookies-list");
  const all = fp.concat(tp);

  if (!all.length) {
    list.appendChild(empty("Nenhum cookie detectado."));
  } else {
    all.slice(0, 100).forEach((c) => {
      const tags = [
        el("span", { class: "tag " + (c.isThirdParty ? "warn" : "ok") },
          c.isThirdParty ? "3a parte" : "1a parte"),
        el("span", { class: "tag" }, c.isPersistent ? "persistente" : "sessao")
      ];
      if (c.httpOnly) tags.push(el("span", { class: "tag" }, "HttpOnly"));
      if (c.secure)   tags.push(el("span", { class: "tag" }, "Secure"));
      list.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, (c.name || "?") + "@" + (c.domain || "-")),
        el("div", { class: "row-meta" }, tags)
      ]));
    });
  }

  clear("super-list");
  const superList = document.getElementById("super-list");
  if (!sc.length) {
    superList.appendChild(empty("Nenhum supercookie identificado."));
  } else {
    sc.forEach((s) => {
      superList.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, [
          el("span", { class: "tag warn" }, s.type),
          document.createTextNode(" " + (s.domain || "-"))
        ]),
        el("div", { class: "row-meta" }, s.header || "")
      ]));
    });
  }
}

/* ---------- Storage ---------- */
function renderStorage(data) {
  const ls  = data.storage?.localStorage   || { items: {}, totalBytes: 0, count: 0 };
  const ss  = data.storage?.sessionStorage || { items: {}, totalBytes: 0, count: 0 };
  const idb = data.storage?.indexedDB      || [];

  const lsCount = ls.count || Object.keys(ls.items || {}).length;
  const ssCount = ss.count || Object.keys(ss.items || {}).length;

  document.getElementById("badge-storage").textContent = lsCount + ssCount + idb.length;
  document.getElementById("ls-count").textContent  = lsCount;
  document.getElementById("ss-count").textContent  = ssCount;
  document.getElementById("idb-count").textContent = idb.length;

  function fillList(id, items) {
    clear(id);
    const node = document.getElementById(id);
    const keys = Object.keys(items || {});
    if (!keys.length) {
      node.appendChild(empty("(vazio)"));
      return;
    }
    keys.forEach((k) => {
      node.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, k),
        el("div", { class: "row-meta" }, fmtBytes(items[k]))
      ]));
    });
  }

  fillList("ls-list", ls.items);
  fillList("ss-list", ss.items);

  clear("idb-list");
  const idbNode = document.getElementById("idb-list");
  if (!idb.length) {
    idbNode.appendChild(empty("(nenhum banco IndexedDB)"));
  } else {
    idb.forEach((b) => {
      idbNode.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, b.name || "(sem nome)"),
        el("div", { class: "row-meta" }, "v" + (b.version || "?"))
      ]));
    });
  }
}

/* ---------- Fingerprinting ---------- */
function renderFingerprint(data) {
  const fp = data.fingerprinting || { canvas: 0, webgl: 0, audio: 0, details: [] };
  const total = fp.canvas + fp.webgl + fp.audio;

  document.getElementById("badge-fp").textContent = total;
  document.getElementById("fp-canvas").textContent = fp.canvas;
  document.getElementById("fp-webgl").textContent  = fp.webgl;
  document.getElementById("fp-audio").textContent  = fp.audio;

  clear("fp-list");
  const list = document.getElementById("fp-list");
  const details = fp.details || [];

  if (!details.length) {
    list.appendChild(empty("Nenhuma chamada de fingerprinting detectada."));
    return;
  }

  details.slice(-50).reverse().forEach((ev) => {
    list.appendChild(el("div", { class: "row" }, [
      el("div", { class: "row-domain" }, "[" + ev.api + "] " + ev.method),
      el("div", { class: "row-meta" }, ev.stackHead || "")
    ]));
  });
}

/* ---------- Hijacking ---------- */
function renderHijack(data) {
  const scripts = data.hijacking?.suspiciousScripts || [];
  const redirs  = data.hijacking?.redirects         || [];
  const sync    = data.cookieSyncing                || [];
  const suspRedirs = redirs.filter((r) => r.suspicious);

  document.getElementById("badge-hijack").textContent =
    scripts.length + suspRedirs.length + sync.length;

  document.getElementById("badge-scripts").textContent = scripts.length;
  document.getElementById("badge-redirs").textContent  = redirs.length;
  document.getElementById("badge-sync").textContent    = sync.length;

  clear("hijack-scripts");
  const sList = document.getElementById("hijack-scripts");
  if (!scripts.length) {
    sList.appendChild(empty("Nenhum script externo suspeito."));
  } else {
    scripts.forEach((s) => {
      sList.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, s.src || "-"),
        el("div", { class: "row-meta" }, "motivo: " + (s.reason || "-"))
      ]));
    });
  }

  clear("hijack-redirs");
  const rList = document.getElementById("hijack-redirs");
  if (!redirs.length) {
    rList.appendChild(empty("Sem redirects cross-domain."));
  } else {
    redirs.forEach((r) => {
      const tag = el("span",
        { class: "tag " + (r.suspicious ? "warn" : "ok") },
        r.suspicious ? "suspeito" : "ok"
      );
      rList.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" },
          (r.fromBase || "-") + " -> " + (r.toBase || "-")),
        el("div", { class: "row-meta" }, [
          tag,
          document.createTextNode(" tipo=" + (r.type || "-"))
        ])
      ]));
    });
  }

  clear("sync-list");
  const syncList = document.getElementById("sync-list");
  if (!sync.length) {
    syncList.appendChild(empty("Sem indicios de cookie syncing."));
  } else {
    sync.slice(0, 50).forEach((s) => {
      syncList.appendChild(el("div", { class: "row" }, [
        el("div", { class: "row-domain" }, s.domain || "-"),
        el("div", { class: "row-meta" }, (s.param || "") + "=" + (s.valuePreview || ""))
      ]));
    });
  }
}

/* ---------- Load ---------- */
function load() {
  browser.runtime.sendMessage({ type: "GET_TAB_DATA" }).then((data) => {
    if (!data) {
      document.getElementById("domain").textContent = "Sem dados";
      return;
    }
    document.getElementById("domain").textContent = data.url || data.mainDomain || "-";
    renderScore(data);
    renderDomains(data);
    renderCookies(data);
    renderStorage(data);
    renderFingerprint(data);
    renderHijack(data);
  }).catch((err) => {
    document.getElementById("domain").textContent = "Erro: " + err.message;
  });
}

document.getElementById("refresh-btn").addEventListener("click", load);
document.addEventListener("DOMContentLoaded", load);