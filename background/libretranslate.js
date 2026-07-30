(function () {
  var libreTranslateBase = "http://127.0.0.1:5000";
  
  /**
   * Traduce testo usando LibreTranslate locale
   * @param {string} text - Testo da tradurre
   * @param {string} targetLang - Lingua target (es. 'en', 'it', 'fr')
   * @param {string} [sourceLang='auto'] - Lingua sorgente (default auto-detection)
   */
  window.libreTranslateTranslate = function (text, targetLang, sourceLang) {
    return ajaxPost(libreTranslateBase + "/translate", {
      q: text,
      source: sourceLang || "auto",
      target: targetLang,
      format: "text"
    }, "json")
    .then(function (response) {
      var result = JSON.parse(response);
      if (result.error) throw new Error(result.error);
      return result.translatedText || result;
    });
  };

  /**
   * Ottiene lingue supportate da LibreTranslate
   */
  window.libreTranslateLanguages = function () {
    return ajaxGet(libreTranslateBase + "/languages")
      .then(function (response) {
        return JSON.parse(response);
      });
  };

  /**
   * Verifica se il servizio LibreTranslate è raggiungibile
   */
  window.libreTranslateReady = function () {
    return ajaxGet(libreTranslateBase + "/")
      .then(function () {
        return true;
      })
      .catch(function (err) {
        console.warn("LibreTranslate unavailable:", err);
        return false;
      });
  };
})();
