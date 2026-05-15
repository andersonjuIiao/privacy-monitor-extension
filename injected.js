// injected.js

(function () {
  "use strict";
  if (window.__privacyMonitorInjected) return;
  window.__privacyMonitorInjected = true;

  function report(api, method) {
    let stack = "";
    try { stack = new Error().stack || ""; } catch (e) {}
    try {
      window.postMessage({
        __privacyMonitor: true,
        type: "FINGERPRINT",
        api: api,
        method: method,
        stack: stack
      }, "*");
    } catch (e) {}
  }

  /* ---------- CANVAS ---------- */
  try {
    const protoC = HTMLCanvasElement.prototype;

    const origToDataURL = protoC.toDataURL;
    protoC.toDataURL = function () {
      report("canvas", "toDataURL");
      return origToDataURL.apply(this, arguments);
    };

    const origToBlob = protoC.toBlob;
    if (typeof origToBlob === "function") {
      protoC.toBlob = function () {
        report("canvas", "toBlob");
        return origToBlob.apply(this, arguments);
      };
    }

    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function () {
      report("canvas", "getImageData");
      return origGetImageData.apply(this, arguments);
    };
  } catch (e) {}

  /* ---------- WEBGL ---------- */
  try {
    function hookWebGL(proto, label) {
      if (!proto) return;

      const origGetParameter = proto.getParameter;
      proto.getParameter = function (p) {
        report("webgl", label + ".getParameter:" + p);
        return origGetParameter.call(this, p);
      };

      const origGetExtension = proto.getExtension;
      proto.getExtension = function (name) {
        if (name === "WEBGL_debug_renderer_info") {
          report("webgl", label + ".WEBGL_debug_renderer_info");
        }
        return origGetExtension.call(this, name);
      };

      const origGetSupported = proto.getSupportedExtensions;
      if (typeof origGetSupported === "function") {
        proto.getSupportedExtensions = function () {
          report("webgl", label + ".getSupportedExtensions");
          return origGetSupported.call(this);
        };
      }
    }

    if (window.WebGLRenderingContext)
      hookWebGL(WebGLRenderingContext.prototype, "WebGL");
    if (window.WebGL2RenderingContext)
      hookWebGL(WebGL2RenderingContext.prototype, "WebGL2");
  } catch (e) {}

  /* ---------- AUDIO ---------- */
  try {
    const ctxClasses = [];
    if (window.AudioContext)              ctxClasses.push(["AudioContext", AudioContext]);
    if (window.webkitAudioContext)        ctxClasses.push(["webkitAudioContext", webkitAudioContext]);
    if (window.OfflineAudioContext)       ctxClasses.push(["OfflineAudioContext", OfflineAudioContext]);
    if (window.webkitOfflineAudioContext) ctxClasses.push(["webkitOfflineAudioContext", webkitOfflineAudioContext]);

    ctxClasses.forEach(([name, Klass]) => {
      try {
        const proto = Klass.prototype;

        const origOsc = proto.createOscillator;
        if (typeof origOsc === "function") {
          proto.createOscillator = function () {
            report("audio", name + ".createOscillator");
            return origOsc.apply(this, arguments);
          };
        }

        const origCmp = proto.createDynamicsCompressor;
        if (typeof origCmp === "function") {
          proto.createDynamicsCompressor = function () {
            report("audio", name + ".createDynamicsCompressor");
            return origCmp.apply(this, arguments);
          };
        }

        const origAnalyser = proto.createAnalyser;
        if (typeof origAnalyser === "function") {
          proto.createAnalyser = function () {
            report("audio", name + ".createAnalyser");
            return origAnalyser.apply(this, arguments);
          };
        }
      } catch (e) {}
    });
  } catch (e) {}

})();