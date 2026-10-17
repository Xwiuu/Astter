import sys
import os
import urllib.request
import urllib.error
import json

WHISPER_PROMPT = (
    "Transcrição de conversa e ditado em português do Brasil, mantendo gírias, pontuação correta e termos técnicos."
)

HALLUCINATIONS = {
    '...', '.', '..', '', 'Né?', 'Né', 'né', 'né?', 'Né.', 'né.',
    'Obrigado por assistir!', 'Obrigado por assistir.', 'Subtitles by',
    'Legendas por', 'Sônia Ruberti', 'Amém', 'Amém.', 'É isso.', 'É isso',
    'Você', 'você', 'Tchau.', 'Tchau!', 'Muito obrigado.', 'Obrigado.',
    'Bye!', 'Thanks for watching!', 'Thank you.'
}

def load_groq_keys():
    keys = []
    env_keys = os.environ.get('GROQ_API_KEYS', '')
    if env_keys:
        for k in env_keys.split(','):
            k = k.strip()
            if k and k.startswith('gsk_') and k not in keys:
                keys.append(k)

    single_env = os.environ.get('GROQ_API_KEY', '')
    if single_env and single_env.startswith('gsk_') and single_env not in keys:
        keys.append(single_env)

    candidates = [
        os.path.join(os.path.dirname(__file__), '.env'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),
        os.path.expanduser('~/.config/astter/.env')
    ]

    for p in candidates:
        if os.path.isfile(p):
            try:
                with open(p, 'r', encoding='utf-8') as ef:
                    for line in ef:
                        line = line.strip()
                        if line.startswith('#'):
                            continue
                        if '=' in line:
                            var, val = line.split('=', 1)
                            var = var.strip()
                            val = val.strip(' "\'')
                            if var in ('GROQ_API_KEYS', 'GROQ_API_KEY', 'VITE_GROQ_API_KEY'):
                                for k in val.split(','):
                                    k = k.strip()
                                    if k and k.startswith('gsk_') and k not in keys:
                                        keys.append(k)
            except Exception:
                pass

    return keys

def get_next_key_order(keys):
    if not keys:
        return []
    state_file = '/tmp/flow_groq_key_idx.txt'
    idx = 0
    try:
        if os.path.exists(state_file):
            with open(state_file, 'r') as f:
                idx = int(f.read().strip())
    except Exception:
        idx = 0

    ordered = [keys[(idx + i) % len(keys)] for i in range(len(keys))]

    try:
        with open(state_file, 'w') as f:
            f.write(str((idx + 1) % len(keys)))
    except Exception:
        pass

    return ordered

def build_payload(audio_data, model_name):
    boundary = '----WebKitFormBoundaryAstterDesktop'
    body = [
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="file"; filename="audio.webm"',
        b'Content-Type: audio/webm',
        b'',
        audio_data,
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="model"',
        b'',
        model_name.encode('utf-8'),
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="language"',
        b'',
        b'pt',
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="prompt"',
        b'',
        WHISPER_PROMPT.encode('utf-8'),
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="temperature"',
        b'',
        b'0.0',
        f'--{boundary}--'.encode(),
        b''
    ]
    return b'\r\n'.join(body), boundary

def transcribe(audio_path):
    if not os.path.isfile(audio_path):
        return ""

    with open(audio_path, 'rb') as f:
        audio_data = f.read()

    if len(audio_data) < 250:
        return ""

    keys = load_groq_keys()
    if not keys:
        sys.stderr.write("❌ [Astter Groq] Nenhuma chave GROQ_API_KEY encontrada no ambiente ou .env\n")
        return ""

    ordered_keys = get_next_key_order(keys)
    models = ['whisper-large-v3-turbo', 'whisper-large-v3']

    for key in ordered_keys:
        key_masked = key[:8] + "..." + key[-4:]
        for model in models:
            payload, boundary = build_payload(audio_data, model)
            req = urllib.request.Request(
                'https://api.groq.com/openai/v1/audio/transcriptions',
                data=payload,
                headers={
                    'Authorization': f'Bearer {key}',
                    'Content-Type': f'multipart/form-data; boundary={boundary}',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
                }
            )

            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    text = data.get('text', '').strip()

                    if text in HALLUCINATIONS or len(text) < 2:
                        return ""

                    sys.stderr.write(f"✓ [Astter Groq] Transcrito com sucesso ({model} | Chave: {key_masked})\n")
                    return text

            except urllib.error.HTTPError as e:
                if e.code == 429:
                    sys.stderr.write(f"⚠️ [Astter Groq] Rate Limit (429) na chave {key_masked}. Alternando para próxima chave do pool...\n")
                    break  # Tenta a próxima chave do pool
                elif e.code == 404 and model == 'whisper-large-v3-turbo':
                    sys.stderr.write(f"⚠️ [Astter Groq] Modelo turbo indisponível na chave {key_masked}, tentando whisper-large-v3...\n")
                    continue
                else:
                    sys.stderr.write(f"⚠️ [Astter Groq] Erro HTTP {e.code} ({e.reason}) na chave {key_masked}.\n")
                    break
            except Exception as e:
                sys.stderr.write(f"⚠️ [Astter Groq] Erro de conexão com chave {key_masked}: {e}\n")
                break

    sys.stderr.write("❌ [Astter Groq] Todas as chaves da Groq falharam ou atingiram limite.\n")
    return ""

if __name__ == '__main__':
    if len(sys.argv) > 1:
        result = transcribe(sys.argv[1])
        if result:
            print(result)
