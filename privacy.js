// privacy.js - Background Script

const tabData = {};

function initTab(tabId) {
  tabData[tabId] = {
    thirdPartyDomains: [],
    hijackingThreats: [],
    fingerprintingCalls: [],
    cookies: { firstParty: [], thirdParty: [] },
    storageItems: [],
    privacyScore: 100
  };
}

function getRootDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

function calcularScore(data) {
  let score = 100;

  const tp = data.thirdPartyDomains.length;
  if (tp >= 10) score -= 30;
  else if (tp >= 5) score -= 20;
  else if (tp >= 1) score -= 10;

  const cookiesTotal = data.cookies.firstParty.length + data.cookies.thirdParty.length;
  if (cookiesTotal >= 10) score -= 20;
  else if (cookiesTotal >= 5) score -= 10;
  else if (cookiesTotal >= 1) score -= 5;

  const cookiesTp = data.cookies.thirdParty.length;
  if (cookiesTp >= 5) score -= 20;
  else if (cookiesTp >= 1) score -= 10;

  if (data.fingerprintingCalls.length >= 1) score -= 20;

  if (data.hijackingThreats.length >= 1) score -= 20;

  return Math.max(0, score);
}

// Detecta dominios de terceira parte
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, url, type, originUrl } = details;
    if (tabId < 0 || !originUrl) return;
    if (!tabData[tabId]) initTab(tabId);

    const requestDomain = getRootDomain(url);
    const originDomain = getRootDomain(originUrl);

    if (requestDomain && originDomain && requestDomain !== originDomain) {
      const already = tabData[tabId].thirdPartyDomains.find(
        (d) => d.domain === requestDomain && d.type === type
      );
      if (!already) {
        tabData[tabId].thirdPartyDomains.push({ domain: requestDomain, type, url });
      }
    }

    tabData[tabId].privacyScore = calcularScore(tabData[tabId]);
  },
  { urls: ["<all_urls>"] }
);

// Detecta cookies ao receber headers de resposta
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const { tabId, url, responseHeaders } = details;
    if (tabId < 0 || !tabData[tabId]) return;

    const pageDomain = getRootDomain(url);

    responseHeaders.forEach((header) => {
      if (header.name.toLowerCase() === "set-cookie") {
        const cookieStr = header.value;
        const nameMatch = cookieStr.match(/^([^=]+)=/);
        const name = nameMatch ? nameMatch[1].trim() : "desconhecido";
        const isSession = !/max-age|expires/i.test(cookieStr);
        const cookieDomain = getRootDomain(url);
        const isThirdParty = cookieDomain && pageDomain && cookieDomain !== pageDomain;

        const cookieObj = {
          name,
          domain: cookieDomain,
          session: isSession,
          type: isSession ? "sessao" : "persistente"
        };

        if (isThirdParty) {
          tabData[tabId].cookies.thirdParty.push(cookieObj);
        } else {
          tabData[tabId].cookies.firstParty.push(cookieObj);
        }
      }
    });

    tabData[tabId].privacyScore = calcularScore(tabData[tabId]);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Detecta redirecionamentos suspeitos
browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const { tabId, url, redirectUrl } = details;
    if (tabId < 0 || !tabData[tabId]) return;

    const originDomain = getRootDomain(url);
    const redirectDomain = getRootDomain(redirectUrl);

    if (originDomain && redirectDomain && originDomain !== redirectDomain) {
      tabData[tabId].hijackingThreats.push(
        `Redirecionamento de ${originDomain} para ${redirectDomain}`
      );
      tabData[tabId].privacyScore = calcularScore(tabData[tabId]);
    }
  },
  { urls: ["<all_urls>"] }
);

// Recebe mensagens do content script e do popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : -1;

  if (message.action === "fingerprintDetectado") {
    if (tabId >= 0 && tabData[tabId]) {
      if (!tabData[tabId].fingerprintingCalls.includes(message.evento)) {
        tabData[tabId].fingerprintingCalls.push(message.evento);
        tabData[tabId].privacyScore = calcularScore(tabData[tabId]);
      }
    }
    return false;
  }

  if (message.action === "storageColetado") {
    if (tabId >= 0 && tabData[tabId]) {
      tabData[tabId].storageItems = message.items.map(
        (i) => `${i.tipo} | ${i.chave} | ${i.tamanho} bytes`
      );
      tabData[tabId].privacyScore = calcularScore(tabData[tabId]);
    }
    return false;
  }

  if (message.action === "getData") {
    const id = message.tabId;
    if (!tabData[id]) initTab(id);
    sendResponse(tabData[id]);
    return true;
  }
});

// Limpa dados quando uma nova pagina carrega
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    initTab(tabId);
  }
});

// Limpa dados quando a aba e fechada
browser.tabs.onRemoved.addListener((tabId) => {
  delete tabData[tabId];
});