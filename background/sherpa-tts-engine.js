function SherpaTtsEngine(serviceUrl) {
  var audio = document.createElement("AUDIO");
  var prefetchAudio;
  var isSpeaking = false;
  var speakPromise;
  var voicesLoaded = false;
  var sherpaVoices = [];
  
  this.ready = function () {
    return this.getVoices()
      .then(function (voices) {
        voicesLoaded = voices.length > 0;
        console.log("Sherpa-TTS initialized with", voices.length, "voices");
        return voicesLoaded;
      })
      .catch(function (err) {
        console.error("Failed to initialize Sherpa-TTS:", err);
        voicesLoaded = false;
        return false;
      });
  };

  this.speak = function (utterance, options, onEvent) {
    if (!options.volume) options.volume = 1;
    if (!options.rate) options.rate = 1;
    
    audio.volume = options.volume;
    // Nota: speed verrà applicato lato server Sherpa
    audio.defaultPlaybackRate = options.rate;
    
    audio.onplay = function () {
      onEvent({ type: 'start', charIndex: 0 });
      isSpeaking = true;
    };
    
    audio.onended = function () {
      onEvent({ type: 'end', charIndex: utterance.length });
      isSpeaking = false;
    };
    
    audio.onerror = function () {
      onEvent({ 
        type: "error", 
        errorMessage: audio.error ? audio.error.message : "Unknown audio error" 
      });
      isSpeaking = false;
    };
    
    speakPromise = Promise.resolve()
      .then(function () {
        if (prefetchAudio && prefetchAudio[0] == utterance && prefetchAudio[1] == options) {
          return prefetchAudio[2];
        } else {
          return getAudioUrl(utterance, options.lang, options.voice, options.rate);
        }
      })
      .then(function (url) {
        audio.src = url;
        return audio.play();
      })
      .catch(function (err) {
        onEvent({
          type: "error",
          errorMessage: err.name == "NotAllowedError" 
            ? JSON.stringify({ code: "error_user_gesture_required" }) 
            : err.message
        });
      });
  };

  this.isSpeaking = function (callback) {
    callback(isSpeaking);
  };

  this.prefetch = function (utterance, options) {
    getAudioUrl(utterance, options.lang, options.voice, options.rate)
      .then(function (url) {
        prefetchAudio = [utterance, options, url];
      })
      .catch(console.error);
  };

  this.setNextStartTime = function () {};

  this.getVoices = function () {
    if (voicesLoaded && sherpaVoices.length > 0) {
      return Promise.resolve(sherpaVoices);
    }
    
    // Recupera voci dal server Sherpa
    return ajaxGet(serviceUrl + "/voices")
      .then(function (response) {
        var remoteVoices = JSON.parse(response);
        
        if (!remoteVoices || remoteVoices.length === 0) {
          // Fallback se server non risponde
          sherpaVoices = [
            { voiceName: "Sherpa Default Italian (Paola)", lang: "it", voiceId: "paola" },
            { voiceName: "Sherpa Italian (Riccardo)", lang: "it", voiceId: "riccardo" },
            { voiceName: "Sherpa English", lang: "en", voiceId: "en" }
          ];
        } else {
          // Mappa le voci dal server
          sherpaVoices = remoteVoices.map(function (v) ({
            voiceName: v.displayName || v.name || "Sherpa " + (v.lang || "default"),
            lang: v.lang || "it",
            voiceId: v.id || v.name || "default"
          }));
        }
        
        return sherpaVoices;
      })
      .catch(function (err) {
        console.warn("Could not fetch Sherpa voices, using defaults:", err);
        sherpaVoices = [
          { voiceName: "Sherpa Italian Paola", lang: "it", voiceId: "paola" },
          { voiceName: "Sherpa Italian Riccardo", lang: "it", voiceId: "riccardo" }
        ];
        return sherpaVoices;
      });
  };

  function getAudioUrl(text, lang, voice, rate) {
    if (!text) {
      throw new Error("Missing text parameter");
    }
    
    var voiceId = voice ? (voice.voiceId || voice.voiceName || voice) : "default";
    
    return serviceUrl + "/tts?" + urlEncode({
      text: text,
      lang: lang || "it",
      voice: voiceId,
      speed: rate || 1.0
    });
  }
}