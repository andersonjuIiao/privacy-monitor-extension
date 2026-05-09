// content_script.js

function coletarWebStorage() {
  const items = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    items.push({
      tipo: "localStorage",
      chave: key,
      tamanho: value ? value.length : 0
    });
  }

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    items.push({
      tipo: "sessionStorage",
      chave: key,
      tamanho: value ? value.length : 0
    });
  }

  return items;
}

function injetarDetectoresFingerprinting() {
  const script = document.createElement("script");
  script.textContent = `
    (function() {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        window.postMessage({ tipo: "fingerprint", evento: "Canvas: toDataURL" }, "*");
        return origToDataURL.apply(this, arguments);
      };

      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function() {
        window.postMessage({ tipo: "fingerprint", evento: "Canvas: getImageData" }, "*");
        return origGetImageData.apply(this, arguments);
      };

      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445 || param === 37446) {
          window.postMessage({ tipo: "fingerprint", evento: "WebGL: getParameter (renderer/vendor)" }, "*");
        }
        return origGetParameter.apply(this, arguments);
      };

      const origCreateOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() {
        window.postMessage({ tipo: "fingerprint", evento: "AudioContext: createOscillator" }, "*");
        return origCreateOscillator.apply(this, arguments);
      };

      const origCreateDynamics = AudioContext.prototype.createDynamicsCompressor;
      AudioContext.prototype.createDynamicsCompressor = function() {
        window.postMessage({ tipo: "fingerprint", evento: "AudioContext: createDynamicsCompressor" }, "*");
        return origCreateDynamics.apply(this, arguments);
      };
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.tipo === "fingerprint") {
    browser.runtime.sendMessage({
      action: "fingerprintDetectado",
      evento: event.data.evento
    });
  }
});

function enviarDados() {
  const storageItems = coletarWebStorage();
  browser.runtime.sendMessage({
    action: "storageColetado",
    items: storageItems
  });
}

injetarDetectoresFingerprinting();
enviarDados();