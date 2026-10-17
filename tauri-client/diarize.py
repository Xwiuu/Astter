#!/usr/bin/env python3
"""
Diarização local pós-reunião: separa as vozes dos participantes remotos
(canal de áudio do sistema) em falantes distintos usando pyannote.audio.

Uso: diarize-venv/bin/python diarize.py <caminho_para_wav>
Saída (stdout): JSON {"turns": [{"start": 1.2, "end": 4.5, "speaker": 0}, ...]}
                ou {"error": "motivo"} em caso de falha (token ausente, etc).
"""
import sys
import os
import json
import wave


def load_wav_as_waveform(wav_path):
    """Lê um WAV PCM16 mono/estéreo manualmente (stdlib `wave`) e devolve um
    dict {'waveform': torch.Tensor, 'sample_rate': int}, evitando depender do
    torchcodec (que precisa de libs FFmpeg do sistema nem sempre presentes)."""
    import torch
    with wave.open(wav_path, 'rb') as wf:
        channels = wf.getnchannels()
        sample_rate = wf.getframerate()
        sample_width = wf.getsampwidth()
        raw = wf.readframes(wf.getnframes())

    if sample_width != 2:
        raise ValueError(f"unsupported sample width: {sample_width} bytes (esperado PCM16)")

    import array
    samples = array.array('h')
    samples.frombytes(raw)
    tensor = torch.frombuffer(samples, dtype=torch.int16).clone().float() / 32768.0
    if channels > 1:
        tensor = tensor.view(-1, channels).t()
    else:
        tensor = tensor.view(1, -1)
    return {"waveform": tensor, "sample_rate": sample_rate}


def load_hf_token():
    env_candidates = [
        os.path.join(os.path.dirname(__file__), '.env'),
        os.path.join(os.path.dirname(__file__), '..', '.env'),
        os.path.join(os.path.expanduser('~'), '.config/aion/.env'),
    ]
    for env_path in env_candidates:
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, _, val = line.partition('=')
                    key = key.strip()
                    val = val.strip().strip('"\'')
                    if key in ('HUGGINGFACE_TOKEN', 'HF_TOKEN') and val:
                        return val
    return os.environ.get('HUGGINGFACE_TOKEN') or os.environ.get('HF_TOKEN')


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing_wav_path"}))
        sys.exit(1)

    wav_path = sys.argv[1]
    if not os.path.exists(wav_path):
        print(json.dumps({"error": "wav_not_found"}))
        sys.exit(1)

    token = load_hf_token()
    if not token:
        print(json.dumps({"error": "missing_hf_token"}))
        sys.exit(1)

    try:
        from pyannote.audio import Pipeline
    except ImportError as e:
        print(json.dumps({"error": "pyannote_not_installed", "detail": str(e)}))
        sys.exit(1)

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=token
        )
    except Exception as e:
        print(json.dumps({"error": "pipeline_load_failed", "detail": str(e)}))
        sys.exit(1)

    try:
        audio_input = load_wav_as_waveform(wav_path)
    except Exception as e:
        print(json.dumps({"error": "wav_read_failed", "detail": str(e)}))
        sys.exit(1)

    try:
        diarization = pipeline(audio_input)
    except Exception as e:
        print(json.dumps({"error": "diarization_failed", "detail": str(e)}))
        sys.exit(1)

    annotation = diarization.exclusive_speaker_diarization

    speaker_order = []
    turns = []
    for segment, _, speaker_label in annotation.itertracks(yield_label=True):
        if speaker_label not in speaker_order:
            speaker_order.append(speaker_label)
        turns.append({
            "start": round(segment.start, 3),
            "end": round(segment.end, 3),
            "speaker": speaker_order.index(speaker_label)
        })

    print(json.dumps({"turns": turns}))


if __name__ == '__main__':
    main()
