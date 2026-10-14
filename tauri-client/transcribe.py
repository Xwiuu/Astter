import sys
import os
import urllib.request
import json

def transcribe(audio_path):
    if not os.path.isfile(audio_path):
        return ""
    
    with open(audio_path, 'rb') as f:
        audio_data = f.read()

    if len(audio_data) < 200:
        return ""

    boundary = '----WebKitFormBoundaryFlowWisprDesktop'
    body = []
    body.extend([
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="file"; filename="audio.webm"',
        b'Content-Type: audio/webm',
        b'',
        audio_data,
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="model"',
        b'',
        b'whisper-large-v3',
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="language"',
        b'',
        b'pt',
        f'--{boundary}'.encode(),
        b'Content-Disposition: form-data; name="temperature"',
        b'',
        b'0.0',
        f'--{boundary}--'.encode(),
        b''
    ])
    payload = b'\r\n'.join(body)

    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        candidates = [
            os.path.join(os.path.dirname(__file__), '.env'),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),
            os.path.expanduser('~/.config/aion/.env')
        ]
        for p in candidates:
            if os.path.isfile(p):
                try:
                    with open(p, 'r') as ef:
                        for line in ef:
                            line = line.strip()
                            if line.startswith('GROQ_API_KEY=') or line.startswith('VITE_GROQ_API_KEY='):
                                api_key = line.split('=', 1)[1].strip(' "\'')
                                break
                except Exception:
                    pass
            if api_key:
                break

    if not api_key:
        sys.stderr.write("No GROQ_API_KEY found in environment or .env\n")
        return ""

    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        data=payload,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Flow/1.6.1147'
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            text = data.get('text', '').strip()
            hallucinations = [
                '...', '.', '..', '', 'Né?', 'Né', 'né', 'né?', 'Né.', 'né.',
                'Obrigado por assistir!', 'Obrigado por assistir.', 'Subtitles by',
                'Legendas por', 'Sônia Ruberti', 'Amém', 'Amém.', 'É isso.', 'É isso',
                'Você', 'você', 'Tchau.', 'Tchau!'
            ]
            if text in hallucinations or len(text) < 2:
                return ""
            return text
    except Exception as e:
        sys.stderr.write(f"Groq transcription error: {e}\n")
        return ""

if __name__ == '__main__':
    if len(sys.argv) > 1:
        result = transcribe(sys.argv[1])
        print(result)
