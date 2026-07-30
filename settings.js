// settings.js — salvataggio immediato, stile originale

document.addEventListener('DOMContentLoaded', () => {
    let speedSlider = document.getElementById('speedSlider');
    let volumeSlider = document.getElementById('volumeSlider');
    let selectTTS = document.getElementById('engineSelect');
    let ttsEngineSelect = document.getElementById('ttsEngineSelect');
    let translatorSelect = document.getElementById('translatorSelect');

    let speechSettings = {};

    // ---- CARICA IMPOSTAZIONI SALVATE ----
    browser.storage.local.get('speechSettings').then(result => {
        if (result.speechSettings) {
            speechSettings = result.speechSettings;
        } else {
            speechSettings = {
                speechSpeed: 2.3,
                speechVolume: 1.0,
                speechVoice: null,
                ttsEngine: 'sherpa',
                sherpaUrl: 'http://127.0.0.1:8000',
                translatorEngine: 'libretranslate',
                libreTranslateUrl: 'http://127.0.0.1:5000',
                translationBuffer: 3,
                syncDelay: 2,
                enableVideoPause: true
            };
        }

        // Popola campi esistenti
        speedSlider.value = speechSettings.speechSpeed || 2.3;
        volumeSlider.value = speechSettings.speechVolume || 1.0;
        document.getElementById('speedValue').textContent = speedSlider.value + 'x';
        document.getElementById('volumeValue').textContent = Math.round(volumeSlider.value * 100) + '%';

        // Popola nuovi campi
        if (ttsEngineSelect) {
            ttsEngineSelect.value = speechSettings.ttsEngine || 'sherpa';
            updateSectionsVisibility();
        }
        if (translatorSelect) {
            translatorSelect.value = speechSettings.translatorEngine || 'libretranslate';
            updateSectionsVisibility();
        }

        const sherpaUrlInput = document.getElementById('sherpaUrl');
        if (sherpaUrlInput) sherpaUrlInput.value = speechSettings.sherpaUrl || 'http://127.0.0.1:8000';
        const libreUrlInput = document.getElementById('libreTranslateUrl');
        if (libreUrlInput) libreUrlInput.value = speechSettings.libreTranslateUrl || 'http://127.0.0.1:5000';

        const bufferSlider = document.getElementById('translationBufferSlider');
        if (bufferSlider) {
            bufferSlider.value = speechSettings.translationBuffer || 3;
            document.getElementById('translationBufferValue').textContent = bufferSlider.value;
        }
        const syncSlider = document.getElementById('syncDelaySlider');
        if (syncSlider) {
            syncSlider.value = speechSettings.syncDelay || 2;
            document.getElementById('syncDelayValue').textContent = syncSlider.value;
        }
        const pauseCheckbox = document.getElementById('enableVideoPause');
        if (pauseCheckbox) pauseCheckbox.checked = speechSettings.enableVideoPause !== false;

        // Popola voci
        populateTTSEngines();
    });

    // ---- EVENT LISTENERS: salvano immediatamente come l'originale ----

    speedSlider.addEventListener('input', () => {
        document.getElementById('speedValue').textContent = speedSlider.value + 'x';
        speechSettings.speechSpeed = parseFloat(speedSlider.value);
        saveSpeechSettings();
    });

    volumeSlider.addEventListener('input', () => {
        document.getElementById('volumeValue').textContent = Math.round(volumeSlider.value * 100) + '%';
        speechSettings.speechVolume = parseFloat(volumeSlider.value);
        saveSpeechSettings();
    });

    if (ttsEngineSelect) {
        ttsEngineSelect.addEventListener('change', () => {
            speechSettings.ttsEngine = ttsEngineSelect.value;
            saveSpeechSettings();
            updateSectionsVisibility();
            populateTTSEngines();
        });
    }

    if (translatorSelect) {
        translatorSelect.addEventListener('change', () => {
            speechSettings.translatorEngine = translatorSelect.value;
            saveSpeechSettings();
            updateSectionsVisibility();
        });
    }

    selectTTS.addEventListener('change', (e) => {
        speechSettings.speechVoice = e.target.value;
        saveSpeechSettings();
        // Invia a content script come faceva l'originale
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) browser.tabs.sendMessage(tabs[0].id, { sender: 'settings', voice: e.target.value });
        });
    });

    // Sherpa URL
    const sherpaUrlInput = document.getElementById('sherpaUrl');
    if (sherpaUrlInput) {
        sherpaUrlInput.addEventListener('change', () => {
            speechSettings.sherpaUrl = sherpaUrlInput.value;
            saveSpeechSettings();
        });
    }

    // LibreTranslate URL
    const libreUrlInput = document.getElementById('libreTranslateUrl');
    if (libreUrlInput) {
        libreUrlInput.addEventListener('change', () => {
            speechSettings.libreTranslateUrl = libreUrlInput.value;
            saveSpeechSettings();
        });
    }

    // Buffer slider
    const bufferSlider = document.getElementById('translationBufferSlider');
    if (bufferSlider) {
        bufferSlider.addEventListener('input', () => {
            document.getElementById('translationBufferValue').textContent = bufferSlider.value;
            speechSettings.translationBuffer = parseInt(bufferSlider.value);
            saveSpeechSettings();
        });
    }

    // Sync delay slider
    const syncSlider = document.getElementById('syncDelaySlider');
    if (syncSlider) {
        syncSlider.addEventListener('input', () => {
            document.getElementById('syncDelayValue').textContent = syncSlider.value;
            speechSettings.syncDelay = parseInt(syncSlider.value);
            saveSpeechSettings();
        });
    }

    // Checkbox pause
    const pauseCheckbox = document.getElementById('enableVideoPause');
    if (pauseCheckbox) {
        pauseCheckbox.addEventListener('change', () => {
            speechSettings.enableVideoPause = pauseCheckbox.checked;
            saveSpeechSettings();
        });
    }

    // Test buttons
    const testSherpaBtn = document.getElementById('testSherpaBtn');
    if (testSherpaBtn) testSherpaBtn.addEventListener('click', testSherpa);
    const testLibreBtn = document.getElementById('testLibreBtn');
    if (testLibreBtn) testLibreBtn.addEventListener('click', testLibre);

    // ---- FUNZIONI ----

    function saveSpeechSettings() {
        browser.storage.local.set({ speechSettings });
    }

    function updateSectionsVisibility() {
        const ttsChoice = ttsEngineSelect ? ttsEngineSelect.value : 'sherpa';
        const trChoice = translatorSelect ? translatorSelect.value : 'libretranslate';

        // Mostra Sherpa URL solo se TTS = sherpa
        const sherpaSection = document.getElementById('sherpaSettings');
        if (sherpaSection) sherpaSection.classList.toggle('hidden', ttsChoice !== 'sherpa');

        // Mostra LibreTranslate URL solo se traduttore = libretranslate
        const libreSection = document.getElementById('libreTranslateSettings');
        if (libreSection) libreSection.classList.toggle('hidden', trChoice !== 'libretranslate');
    }

    async function testSherpa() {
        const url = document.getElementById('sherpaUrl').value;
        const el = document.getElementById('sherpaStatus');
        el.className = 'status';
        el.textContent = 'Testing...';
        try {
            const r = await fetch(url + '/');
            if (r.ok) { el.textContent = 'OK!'; el.classList.add('ok'); }
            else throw new Error('HTTP ' + r.status);
        } catch (e) { el.textContent = 'Errore: ' + e.message; el.classList.add('error'); }
    }

    async function testLibre() {
        const url = document.getElementById('libreTranslateUrl').value;
        const el = document.getElementById('libreStatus');
        el.className = 'status';
        el.textContent = 'Testing...';
        try {
            const r = await fetch(url + '/');
            if (r.ok) { el.textContent = 'OK!'; el.classList.add('ok'); }
            else throw new Error('HTTP ' + r.status);
        } catch (e) { el.textContent = 'Errore: ' + e.message; el.classList.add('error'); }
    }

    // ---- POPOLA VOCI TTS (dinamico per engine) ----

    async function populateTTSEngines() {
        const select = document.getElementById('engineSelect');
        select.innerHTML = '';

        const ttsChoice = ttsEngineSelect ? ttsEngineSelect.value : speechSettings.ttsEngine || 'sherpa';
        let voices = [];

        if (ttsChoice === 'sherpa') {
            try {
                const url = speechSettings.sherpaUrl || 'http://127.0.0.1:8000';
                const r = await fetch(url + '/voices');
                if (r.ok) voices = await r.json();
            } catch (e) { /* fallback sotto */ }
            if (!voices.length) {
                voices = [
                    { displayName: 'Sherpa Italian Paola', lang: 'it', id: 'it_IT-paola-medium' },
                    { displayName: 'Sherpa Italian Riccardo', lang: 'it', id: 'it_IT-riccardo-x_low' }
                ];
            }
        } else if (ttsChoice === 'google') {
            voices = [
                { displayName: 'GoogleTranslate Italian', lang: 'it', id: 'GoogleTranslate_it' },
                { displayName: 'GoogleTranslate English', lang: 'en', id: 'GoogleTranslate_en' },
                { displayName: 'GoogleTranslate Spanish', lang: 'es', id: 'GoogleTranslate_es' },
                { displayName: 'GoogleTranslate French', lang: 'fr', id: 'GoogleTranslate_fr' },
                { displayName: 'GoogleTranslate German', lang: 'de', id: 'GoogleTranslate_de' },
                { displayName: 'GoogleTranslate Japanese', lang: 'ja', id: 'GoogleTranslate_ja' },
                { displayName: 'GoogleTranslate Chinese', lang: 'zh-CN', id: 'GoogleTranslate_zh-CN' }
            ];
        } else if (ttsChoice === 'browser') {
            if ('speechSynthesis' in window) {
                let synthVoices = window.speechSynthesis.getVoices();
                if (!synthVoices.length) {
                    await new Promise(res => {
                        window.speechSynthesis.onvoiceschanged = () => res();
                        setTimeout(res, 1500);
                    });
                    synthVoices = window.speechSynthesis.getVoices();
                }
                voices = synthVoices.map(v => ({
                    displayName: v.name, lang: v.lang, id: v.voiceURI || v.name
                }));
            }
        }

        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.text = `${v.displayName} (${v.lang})`;
            opt.value = v.id;
            select.add(opt);
        });

        if (speechSettings.speechVoice) {
            select.value = speechSettings.speechVoice;
        }
    }
});