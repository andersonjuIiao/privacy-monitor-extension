// privacy.js - Background Script

// Armazena dados por aba
const tabData = {};

function initTab(tabId) {
  tabData[tabId] = {
    thirdPartyDomains: [],
    hijackingThreats: [],
    fingerprintingCalls: [],
    cookies: { firstParty: [], thirdParty: [] }
  };
}

// Extrai o domínio raiz de uma URL
function getRootDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

// Detecta domínios de terceira parte
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
        tabData[tabId].thirdPartyDomains.push({
          domain: requestDomain,
          type: type,
          url: url
        });
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Limpa dados quando uma nova página carrega
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    initTab(tabId);
  }
});

// Limpa dados quando a aba é fechada
browser.tabs.onRemoved.addListener((tabId) => {
  delete tabData[tabId];
});

// Responde ao popup com os dados da aba ativa
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getData") {
    const tabId = message.tabId;
    sendResponse(tabData[tabId] || initTab(tabId) || tabData[tabId]);
  }
});