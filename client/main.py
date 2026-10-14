import io
import os
import shutil
import subprocess
import time
import wave
from dotenv import load_dotenv
import numpy as np
import requests
import sounddevice as sd

# Carregar variáveis de ambiente do .env
load_dotenv()
API_KEY = os.getenv("GROQ_API_KEY")

SAMPLE_RATE = 16000
CHANNELS = 1


def copy_to_clipboard(text: str):
    """Copia o texto automaticamente para a área de transferência do Linux (Wayland / X11)."""
    if not text:
        return
    try:
        if shutil.which("wl-copy"):
            subprocess.run(["wl-copy"], input=text.encode("utf-8"), check=False)
            print("📋 [Área de Transferência] Texto copiado com sucesso! (Cole com Ctrl+V)")
        elif shutil.which("xclip"):
            subprocess.run(["xclip", "-selection", "clipboard"], input=text.encode("utf-8"), check=False)
            print("📋 [Área de Transferência] Texto copiado com sucesso! (Cole com Ctrl+V)")
    except Exception as e:
        print(f"[!] Não foi possível copiar para a área de transferência: {e}")


def record_audio():
    print("\n🎤 [*] Gravando... Fale no microfone!")
    print("    [Pressione ENTER para finalizar a fala]")
    recording = []

    def callback(indata, frames, time_info, status):
        recording.append(indata.copy())

    try:
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, callback=callback):
            input()  # Aguarda o usuário apertar Enter para finalizar a gravação
            time.sleep(0.25)  # Respiro de 250ms para capturar a última sílaba sem cortes secos
    except KeyboardInterrupt:
        print("\n[*] Gravação cancelada.")
        return None

    if not recording:
        return None

    audio_data = np.concatenate(recording, axis=0)

    # Validar se gravou pelo menos 0.3 segundos de áudio real
    if len(audio_data) < SAMPLE_RATE * 0.3:
        print("[-] Áudio muito curto, ignorando.")
        return None

    # Adicionar padding suave de silêncio (150ms) no início e no fim para o Whisper contextualizar as bordas
    padding = np.zeros((int(SAMPLE_RATE * 0.15), CHANNELS), dtype=np.float32)
    audio_data = np.concatenate([padding, audio_data, padding], axis=0)

    return audio_data


def transcribe(audio_data):
    if not API_KEY:
        print("[-] ERRO: GROQ_API_KEY não encontrada no arquivo .env!")
        return ""

    model = os.getenv("GROQ_MODEL", "whisper-large-v3")
    print(f"⚡ [*] Enviando para a Groq ({model})...")
    t0 = time.time()

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)  # 16-bit PCM
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes((audio_data * 32767).astype(np.int16).tobytes())

    wav_io.seek(0)

    headers = {"Authorization": f"Bearer {API_KEY}"}
    files = {"file": ("audio.wav", wav_io, "audio/wav")}
    data = {
        "model": model,
        "language": "pt",
        "temperature": "0.0",
        "prompt": "Transcrição de áudio em português claro e natural, com pontuação correta."
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers,
            files=files,
            data=data,
            timeout=15
        )

        latency = (time.time() - t0) * 1000

        if response.status_code == 200:
            text = response.json().get("text", "").strip()
            print(f"✨ [Transcrito em {latency:.0f}ms]")
            return text
        else:
            print(f"[-] Erro na API Groq ({response.status_code}): {response.text}")
            return ""
    except Exception as e:
        print(f"[-] Falha na requisição: {e}")
        return ""


def main():
    model = os.getenv("GROQ_MODEL", "whisper-large-v3")
    print("=" * 55)
    print("🚀 Wispr Flow Linux - Cliente de Ditado (Modo Direto)")
    print("=" * 55)
    print(f"Motor de IA: Groq {model}")
    print("Ambiente: Fedora 44 (Wayland / PipeWire)")
    print("=" * 55)

    while True:
        try:
            cmd = input("\nPressione [ENTER] para ditar (ou 'q' para sair): ").strip()
            if cmd.lower() == "q":
                print("Encerrando cliente...")
                break

            audio = record_audio()
            if audio is not None and len(audio) > 0:
                text = transcribe(audio)
                if text:
                    print(f"\n💬 Transcrição:\n\"{text}\"\n")
                    copy_to_clipboard(text)
                    print("-" * 55)
        except (KeyboardInterrupt, EOFError):
            print("\nEncerrando cliente...")
            break


if __name__ == "__main__":
    main()
