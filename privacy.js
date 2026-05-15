// privacy.js - Background Script

"use strict";

const tabData = new Map();

function newTabRecord() {
  return {
    url: "",
    mainDomain: "",
    thirdPartyDomains: new Map(),
    cookies: {
      firstParty: [],
      thirdParty: [],
      session: [],
      persistent: [],
      superCookies: []
    },
    storage: {
      localStorage: { items: {}, totalBytes: 0, count: 0 },
      sessionStorage: { items: {}, totalBytes: 0, count: 0 },
      indexedDB: [],
      domain: ""
    },
    fingerprinting: {
      canvas: 0, webgl: 0, audio: 0, details: []
    },
    hijacking: {
      suspiciousScripts: [],
      redirects: []
    },
    cookieSyncing: [],
    requestCount: 0,
    privacyScore: 100
  };
}

function getTabData(tabId) {
  if (!tabData.has(tabId)) tabData.set(tabId, newTabRecord());
  return tabData.get(tabId);
}

/* ---------- Helpers de dominio ---------- */
function getHostname(url) {
  try { return new URL(url).hostname; } catch (e) { return ""; }
}

const MULTI_PART_TLDS = new Set([
  "co.uk", "com.br", "co.jp", "com.au", "co.in", "com.mx",
  "com.ar", "co.kr", "com.sg", "co.za", "ac.uk", "gov.br", "edu.br"
]);

function getBaseDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const last2 = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

/* ---------- webNavigation: reset por navegacao ---------- */
browser.webNavigation.onDOMContentLoaded.addListener((details) => {
  if (details.frameId !== 0) return;
  const current = tabData.get(details.tabId);
  const newDomain = getBaseDomain(getHostname(details.url));
  if (current && current.mainDomain === newDomain) return;
  const fresh = newTabRecord();
  fresh.url = details.url;
  fresh.mainDomain = newDomain;
  tabData.set(details.tabId, fresh);
});

/* ---------- webRequest: dominios de terceira parte ---------- */
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const data = getTabData(details.tabId);
    data.requestCount++;

    const reqHost = getHostname(details.url);
    const reqBase = getBaseDomain(reqHost);
    if (!data.mainDomain || !reqBase) return;
    if (reqBase === data.mainDomain) return;

    if (!data.thirdPartyDomains.has(reqHost)) {
      data.thirdPartyDomains.set(reqHost, {
        baseDomain: reqBase,
        types: new Set(),
        count: 0,
        urls: []
      });
    }
    const entry = data.thirdPartyDomains.get(reqHost);
    entry.types.add(details.type || "other");
    entry.count++;
    if (entry.urls.length < 3) entry.urls.push(details.url);
  },
  { urls: ["<all_urls>"] }
);

/* ---------- webRequest: cookies, supercookies e cookie syncing ---------- */
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const data = getTabData(details.tabId);
    const reqHost = getHostname(details.url);
    const reqBase = getBaseDomain(reqHost);
    const isThirdParty =
      data.mainDomain && reqBase && reqBase !== data.mainDomain;

    let etagValue = null;
    let hstsValue = null;

    for (const header of details.responseHeaders || []) {
      const name = (header.name || "").toLowerCase();
      const value = header.value || "";

      if (name === "set-cookie") {
        const partes = value.split(";").map((p) => p.trim());
        const primeiraParte = partes[0];
        const igualIdx = primeiraParte.indexOf("=");
        const nomeCookie = igualIdx >= 0
          ? primeiraParte.substring(0, igualIdx).trim()
          : primeiraParte.trim();

        const temExpires  = partes.some((p) => p.toLowerCase().startsWith("expires="));
        const temMaxAge   = partes.some((p) => p.toLowerCase().startsWith("max-age="));
        const httpOnly    = partes.some((p) => p.toLowerCase() === "httponly");
        const secure      = partes.some((p) => p.toLowerCase() === "secure");
        const isPersistent = temExpires || temMaxAge;

        const cookieObj = {
          name: nomeCookie,
          domain: reqHost,
          baseDomain: reqBase,
          isThirdParty,
          isPersistent,
          httpOnly,
          secure
        };

        if (isThirdParty) data.cookies.thirdParty.push(cookieObj);
        else data.cookies.firstParty.push(cookieObj);

        if (isPersistent) data.cookies.persistent.push(cookieObj);
        else data.cookies.session.push(cookieObj);
      }

      if (name === "etag") etagValue = value;
      if (name === "strict-transport-security") hstsValue = value;
    }

    // Supercookies: ETag e HSTS de terceiros
    if (etagValue && isThirdParty) {
      data.cookies.superCookies.push({
        type: "ETag",
        domain: reqHost,
        baseDomain: reqBase,
        header: etagValue.slice(0, 80)
      });
    }
    if (hstsValue && isThirdParty) {
      data.cookies.superCookies.push({
        type: "HSTS",
        domain: reqHost,
        baseDomain: reqBase,
        header: hstsValue.slice(0, 80)
      });
    }

    // Cookie syncing: parametros de sincronismo em URLs de terceiros
    if (isThirdParty) {
      try {
        const u = new URL(details.url);
        for (const [k, v] of u.searchParams) {
          if (
            /(^|_)(uid|user_id|tracking_id|sync|partner_id|gdpr|consent|tdid|ssp|dsp)(_|$)/i.test(k) &&
            v && v.length >= 6
          ) {
            data.cookieSyncing.push({
              domain: reqHost,
              baseDomain: reqBase,
              param: k,
              valuePreview: v.slice(0, 40)
            });
            break;
          }
        }
      } catch (e) {}
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

/* ---------- webRequest: redirects suspeitos ---------- */
browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const data = getTabData(details.tabId);
    const fromBase = getBaseDomain(getHostname(details.url));
    const toBase   = getBaseDomain(getHostname(details.redirectUrl));
    if (!fromBase || !toBase || fromBase === toBase) return;

    const suspicious =
      data.mainDomain &&
      toBase !== data.mainDomain &&
      details.type === "main_frame";

    data.hijacking.redirects.push({
      from: details.url.slice(0, 200),
      to: details.redirectUrl.slice(0, 200),
      fromBase,
      toBase,
      type: details.type,
      suspicious
    });
  },
  { urls: ["<all_urls>"] }
);

/* ---------- Privacy Score ---------- */
function calcularScore(data) {
  let score = 100;

  const tpHits = data.thirdPartyDomains.size;
  score -= Math.min(tpHits * 2, 30);

  const tpc = data.cookies.thirdParty.length;
  score -= Math.min(tpc, 15);

  const sc = data.cookies.superCookies.length;
  score -= Math.min(sc * 5, 20);

  let fpCats = 0;
  if (data.fingerprinting.canvas > 0) fpCats++;
  if (data.fingerprinting.webgl  > 0) fpCats++;
  if (data.fingerprinting.audio  > 0) fpCats++;
  score -= fpCats * 10;

  const csCount = data.cookieSyncing.length;
  score -= Math.min(csCount * 3, 15);

  const hjCount = data.hijacking.suspiciousScripts.length;
  score -= Math.min(hjCount * 5, 20);

  const srCount = data.hijacking.redirects.filter((r) => r.suspicious).length;
  score -= Math.min(srCount * 3, 15);

  return Math.max(0, Math.min(100, score));
}

/* ---------- Serializacao para o popup ---------- */
function serialize(d) {
  return {
    url: d.url,
    mainDomain: d.mainDomain,
    thirdPartyDomains: Array.from(d.thirdPartyDomains.entries()).map(([host, e]) => ({
      domain: host,
      baseDomain: e.baseDomain,
      types: Array.from(e.types),
      count: e.count,
      urls: e.urls
    })),
    cookies: d.cookies,
    storage: d.storage,
    fingerprinting: d.fingerprinting,
    hijacking: d.hijacking,
    cookieSyncing: d.cookieSyncing,
    requestCount: d.requestCount,
    privacyScore: calcularScore(d)
  };
}

/* ---------- Mensagens ---------- */
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab && msg && msg.type === "GET_TAB_DATA") {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (!tabs[0]) { sendResponse(null); return; }
      sendResponse(serialize(getTabData(tabs[0].id)));
    });
    return true;
  }

  if (!sender.tab) return;
  const data = getTabData(sender.tab.id);

  if (msg.type === "STORAGE_REPORT") {
    data.storage = msg.payload;
  } else if (msg.type === "FINGERPRINT") {
    if (msg.api === "canvas") data.fingerprinting.canvas++;
    else if (msg.api === "webgl") data.fingerprinting.webgl++;
    else if (msg.api === "audio") data.fingerprinting.audio++;
    if (data.fingerprinting.details.length < 60) {
      data.fingerprinting.details.push({
        api: msg.api,
        method: msg.method,
        stackHead: (msg.stack || "").split("\n").slice(0, 2).join(" | ").slice(0, 200)
      });
    }
  } else if (msg.type === "SUSPICIOUS_SCRIPT") {
    data.hijacking.suspiciousScripts.push(msg.payload);
  }
});

browser.tabs.onRemoved.addListener((tabId) => tabData.delete(tabId));

console.log("[PrivacyMonitor] background carregado");