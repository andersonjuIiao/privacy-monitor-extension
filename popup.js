// popup.js

function getScoreClass(score) {
  if (score >= 70) return "good";
  if (score >= 40) return "medium";
  return "bad";
}

function getScoreLabel(score) {
  if (score >= 70) return "Boa privacidade";
  if (score >= 40) return "Privacidade moderada";
  return "Privacidade ruim";
}

function renderList(ulId, items, emptyMsg) {
  const ul = document.getElementById(ulId);
  if (!items || items.length === 0) {
    ul.innerHTML = `<li style="color:#888">${emptyMsg}</li>`;
    return;
  }
  ul.innerHTML = items.map(i => `<li>${i}</li>`).join("");
}

browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tabId = tabs[0].id;

  browser.runtime.sendMessage({ action: "getData", tabId }, (data) => {
    document.getElementById("loading").style.display = "none";
    document.getElementById("content").style.display = "block";

    if (!data) return;

    const scoreBox = document.getElementById("score-box");
    const score = data.privacyScore ?? 100;
    scoreBox.className = "score-box " + getScoreClass(score);
    scoreBox.textContent = `Privacy Score: ${score}/100 - ${getScoreLabel(score)}`;

    const tpItems = (data.thirdPartyDomains || []).map(
      d => `${d.domain} <span class="tag">${d.type}</span>`
    );
    renderList("third-party-list", tpItems, "Nenhum dominio de terceira parte detectado");

    renderList("hijacking-list", data.hijackingThreats || [], "Nenhuma ameaca detectada");

    const cookieItems = [
      ...(data.cookies?.firstParty || []).map(c => {
        let tags = `<span class="tag">1a parte</span> <span class="tag">${c.type}</span>`;
        if (c.httpOnly) tags += ` <span class="tag">HttpOnly</span>`;
        if (c.secure)   tags += ` <span class="tag">Secure</span>`;
        return `${c.name} ${tags}`;
      }),
      ...(data.cookies?.thirdParty || []).map(c => {
        let tags = `<span class="tag">3a parte</span> <span class="tag">${c.type}</span>`;
        if (c.httpOnly) tags += ` <span class="tag">HttpOnly</span>`;
        if (c.secure)   tags += ` <span class="tag">Secure</span>`;
        return `${c.name} ${tags}`;
      })
    ];
    renderList("cookies-list", cookieItems, "Nenhum cookie detectado");

    renderList("storage-list", data.storageItems || [], "Nenhum dado em Web Storage detectado");

    renderList("fingerprinting-list", data.fingerprintingCalls || [], "Nenhuma tentativa detectada");
  });
});