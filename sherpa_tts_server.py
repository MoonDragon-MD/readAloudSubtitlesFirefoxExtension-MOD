#!/usr/bin/env python3
"""
Sherpa-TTS Server (no Flask, usa http.server stdlib)
Carica automaticamente modelli Piper-VITS da ./models/
Avvia: python sherpa_tts_server.py
Visita: http://127.0.0.1:8000/
"""

import http.server
import json
import io
import wave
import os
import sys
import urllib.parse
from pathlib import Path

try:
    import sherpa_onnx
except ImportError:
    print("ERRORE: pip install sherpa-onnx")
    sys.exit(1)

MODELS_DIR = Path("./models")
tts_cache = {}  # voice_id -> (OfflineTts instance, sample_rate)


def scan_models():
    """Trova tutte le sottocartelle con file .onnx e tokens.txt"""
    models = []
    if not MODELS_DIR.exists():
        print(f"[!] Cartella {MODELS_DIR.resolve()} non esiste")
        return models

    for d in sorted(MODELS_DIR.iterdir()):
        if not d.is_dir():
            continue
        onnx_files = list(d.glob("*.onnx"))
        tokens = d / "tokens.txt"
        if not onnx_files or not tokens.exists():
            continue

        espeak = d / "espeak-ng-data"
        voice_id = d.name
        lang = voice_name = voice_id.split("_")[0]  # es. it_IT-... -> it
        models.append({
            "id": voice_id,
            "displayName": f"Piper {voice_id}",
            "lang": lang,
            "onnx": str(onnx_files[0]),
            "tokens": str(tokens),
            "data_dir": str(espeak) if espeak.exists() else "",
        })
    return models


def get_tts(model_info):
    """Carica o recupera dalla cache un'istanza TTS"""
    vid = model_info["id"]
    if vid in tts_cache:
        return tts_cache[vid]

    print(f"[*] Caricamento modello: {vid} ...")
    try:
        vits_cfg = sherpa_onnx.OfflineTtsVitsModelConfig(
            model=model_info["onnx"],
            tokens=model_info["tokens"],
            data_dir=model_info["data_dir"],
            num_threads=4,
            provider="cpu",
            debug=False,
        )
        cfg = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(vits=vits_cfg),
            noise_scale=0.667,
            noise_scale_w=0.8,
            length_scale=1.0,
        )
        tts = sherpa_onnx.OfflineTts(cfg)
        tts_cache[vid] = tts
        print(f"[+] Modello caricato: {vid} (sample_rate={tts.sample_rate})")
        return tts
    except Exception as e:
        print(f"[!] Errore caricamento {vid}: {e}")
        return None


def generate_wav(tts, text, speed):
    """Genera audio WAV da testo"""
    audio = tts.generate(text, sid=0, speed=speed)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(tts.sample_rate)
        # Converte float32 -> int16
        import numpy as np
        samples = np.clip(audio.samples, -1.0, 1.0)
        samples = (samples * 32767).astype("<i2").tobytes()
        wf.writeframes(samples)
    buf.seek(0)
    return buf


class TtsHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_wav(self, wav_buf):
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(wav_buf.read())

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "":
            models = scan_models()
            self._send_json({"status": "ok", "models": len(models)})

        elif path == "/voices":
            models = scan_models()
            self._send_json([{
                "id": m["id"],
                "displayName": m["displayName"],
                "lang": m["lang"]
            } for m in models])

        elif path == "/tts":
            text = qs.get("text", [""])[0]
            voice = qs.get("voice", [""])[0]
            lang = qs.get("lang", ["it"])[0]
            speed = float(qs.get("speed", ["1.0"])[0])

            if not text.strip():
                self._send_json({"error": "Testo vuoto"}, 400)
                return

            models = scan_models()
            model = None
            # Cerca per voice ID
            if voice:
                model = next((m for m in models if m["id"] == voice), None)
            # Fallback: per lingua
            if not model:
                model = next((m for m in models if m["lang"] == lang), None)
            # Fallback: primo disponibile
            if not model and models:
                model = models[0]

            if not model:
                self._send_json({"error": "Nessun modello trovato"}, 404)
                return

            tts = get_tts(model)
            if not tts:
                self._send_json({"error": "Errore caricamento modello"}, 500)
                return

            try:
                wav_buf = generate_wav(tts, text, speed)
                self._send_wav(wav_buf)
            except Exception as e:
                self._send_json({"error": str(e)}, 500)

        else:
            self._send_json({"error": "Not found"}, 404)

    def log_message(self, fmt, *args):
        # Log minimale
        print(f"[{self.command}] {self.path}")


def main():
    print("=" * 50)
    print("  Sherpa-TTS Server (no Flask)")
    print(f"  Models dir: {MODELS_DIR.resolve()}")
    print("=" * 50)

    models = scan_models()
    print(f"  Trovati {len(models)} modelli:")
    for m in models:
        print(f"    - {m['id']} ({m['lang']})")

    if not models:
        print("[!] Nessun modello trovato in ./models/")
        print("[!] Crea la cartella models/ con i modelli Piper-VITS")

    print("-" * 50)
    print("  Server: http://127.0.0.1:8000")
    print("=" * 50)

    server = http.server.HTTPServer(("127.0.0.1", 8000), TtsHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server fermato")
        server.server_close()


if __name__ == "__main__":
    main()
