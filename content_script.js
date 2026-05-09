// content_script.js

function coletarWebStorage() {
  const items = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      items.push({
        tipo: "localStorage",
        chave: key,
        tamanho: value ? value.length : 0
      });
    }
  } catch (e) {}

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key);
      items.push({
        tipo: "sessionStorage",
        chave: key,
        tamanho: value ? value.length : 0
      });
    }
  } catch (e) {}

  return items;
}

function injetarDetectoresFingerprinting() {
  const script = document.createElement("script");
  script.textContent = `
    (function() {
      function notificar(evento) {
        window.postMessage({ tipo: "fingerprint", evento: evento }, "*");
      }

      try {
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
          notificar("Canvas: toDataURL");
          return origToDataURL.apply(this, arguments);
        };
      } catch(e) {}

      try {
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function() {
          notificar("Canvas: getImageData");
          return origGetImageData.apply(this, arguments);
        };
      } catch(e) {}

      try {
        const origGetParameterWebGL = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 37445 || param === 37446) {
            notificar("WebGL: getParameter (renderer/vendor)");
          }
          return origGetParameterWebGL.apply(this, arguments);
        };
      } catch(e) {}

      try {
        const origGetParameterWebGL2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 37445 || param === 37446) {
            notificar("WebGL2: getParameter (renderer/vendor)");
          }
          return origGetParameterWebGL2.apply(this, arguments);
        };
      } catch(e) {}

      try {
        const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
        if (OrigAudioContext) {
          const origCreateOscillator = OrigAudioContext.prototype.createOscillator;
          OrigAudioContext.prototype.createOscillator = function() {
            notificar("AudioContext: createOscillator");
            return origCreateOscillator.apply(this, arguments);
          };

          const origCreateDynamics = OrigAudioContext.prototype.createDynamicsCompressor;
          OrigAudioContext.prototype.createDynamicsCompressor = function() {
            notificar("AudioContext: createDynamicsCompressor");
            return origCreateDynamics.apply(this, arguments);
          };
        }
      } catch(e) {}

      try {
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type) {
          if (type === "webgl" || type === "experimental-webgl" || type === "webgl2") {
            notificar("WebGL: getContext (" + type + ")");
          }
          return origGetContext.apply(this, arguments);
        };
      } catch(e) {}

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