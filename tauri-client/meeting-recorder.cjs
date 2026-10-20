// ========================================================
// FLOW MEETING RECORDER: Dual-Channel Linux Capture & Diarization
// ========================================================
// Captura simultânea via PipeWire:
// - Canal 0: Microfone Local (Sua voz / "Você")
// - Canal 1: Áudio do Sistema / Chamada (Participantes no Meet, Zoom, Teams)
//
// Transcrição ultra-rápida via Groq Whisper Large-v3 com
// separação determinística de oradores e estruturação com IA.
// ========================================================

const { spawn, exec, execSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const memory = require('./memory-manager.cjs');

class MeetingRecorder extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isRecording = false;
    this.isProcessingStop = false;
    this.client = '';
    this.startTime = null;
    this.micProcess = null;
    this.sysProcess = null;
    this.micBuffer = [];
    this.sysBuffer = [];
    this.fullSysAudioChunks = []; // Áudio completo do sistema (todos os participantes remotos), preservado para diarização pós-reunião
    this.micAudioLength = 0;
    this.sysAudioLength = 0;
    this.lastMicActivity = 0;
    this.lastSysActivity = 0;
    this.activeSpeaker = null; // 'Você' | 'Participante' | null
    this.meetingId = null;
    this.meetingTitle = 'Nova Reunião';
    this.attendees = ['Você', 'Participantes'];
    this.transcripts = []; // Array de { id, speaker, text, timestampMs, durationSec, channel }
    this.groqKeys = [];
    this.currentKeyIndex = 0;
    this.timerInterval = null;
    this.chunkCheckInterval = null;

    this.loadGroqKeys();
  }

  loadGroqKeys() {
    const keys = [];
    const envCandidates = [
      path.join(__dirname, '.env'),
      path.join(__dirname, '../.env'),
      path.join(os.homedir(), '.config/astter/.env')
    ];

    for (const envPath of envCandidates) {
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
            const [key, val] = trimmed.split('=', 2);
            const varName = key.trim();
            const cleanVal = val.trim().replace(/^["']|["']$/g, '');
            if (['GROQ_API_KEYS', 'GROQ_API_KEY', 'VITE_GROQ_API_KEY'].includes(varName)) {
              for (const k of cleanVal.split(',')) {
                const item = k.trim();
                if (item && item.startsWith('gsk_') && !keys.includes(item)) {
                  keys.push(item);
                }
              }
            }
          }
        } catch (_) {}
      }
    }
    this.groqKeys = keys;
    console.log(`🎙️ [MeetingRecorder] Chaves Groq carregadas: ${keys.length}`);
  }

  getGroqKey() {
    if (!this.groqKeys.length) return null;
    const key = this.groqKeys[this.currentKeyIndex % this.groqKeys.length];
    this.currentKeyIndex++;
    return key;
  }

  // Detecta o ID do sink ativo no PipeWire
  getActiveSinkId() {
    try {
      const output = execSync('wpctl status', { encoding: 'utf8', timeout: 800 });
      // Procura na seção Sinks a linha com asterisco '*'
      const sinksSection = output.split('Sinks:')[1]?.split('Sources:')[0] || '';
      for (const line of sinksSection.split('\n')) {
        if (line.includes('*')) {
          const match = line.match(/\*\s*(\d+)\./);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [MeetingRecorder] Erro ao buscar sink ativo com wpctl:', e.message);
    }
    return '0'; // default
  }

  // Detecta o ID da source (microfone) ativa no PipeWire
  getActiveSourceId() {
    try {
      const output = execSync('wpctl status', { encoding: 'utf8', timeout: 800 });
      const sourcesSection = output.split('Sources:')[1]?.split('Filters:')[0] || '';
      for (const line of sourcesSection.split('\n')) {
        if (line.includes('*')) {
          const match = line.match(/\*\s*(\d+)\./);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
    } catch (_) {}
    return '0';
  }

  start(options = {}) {
    if (this.isRecording) {
      console.warn('⚠️ [MeetingRecorder] Reunião já em andamento.');
      return false;
    }

    this.meetingId = options.id || `meeting_${Date.now()}`;
    this.meetingTitle = options.title || `Reunião ${new Date().toLocaleDateString('pt-BR')}`;
    this.attendees = options.attendees || ['Você'];
    this.client = (options.client || '').trim();
    this.transcripts = [];
    this.micBuffer = [];
    this.sysBuffer = [];
    this.fullSysAudioChunks = [];
    this.micAudioLength = 0;
    this.sysAudioLength = 0;
    this.startTime = Date.now();
    this.isRecording = true;

    const sinkId = this.getActiveSinkId();
    console.log(`🎙️ [MeetingRecorder] Iniciando gravação da reunião: "${this.meetingTitle}" (Sink ID: ${sinkId})`);

    // 1. Inicia captura do Microfone Local (Sua voz)
    // 16kHz mono 16-bit PCM RAW
    try {
      this.micProcess = spawn('pw-record', [
        '--rate', '16000',
        '--channels', '1',
        '--format', 's16',
        '-'
      ], { stdio: ['ignore', 'pipe', 'ignore'] });

      this.micProcess.stdout.on('data', (chunk) => {
        if (!this.isRecording) return;
        this.micBuffer.push(chunk);
        this.micAudioLength += chunk.length;
        const rms = this.calculateRMS(chunk);
        if (rms > 0.015) {
          this.lastMicActivity = Date.now();
          this.activeSpeaker = 'Você';
          this.emit('active-speaker', { speaker: 'Você', channel: 'mic' });
        }
        this.emit('audio-volume', { channel: 'mic', volume: Math.min(1, rms * 5) });
      });

      this.micProcess.on('error', (err) => {
        console.error('❌ [MeetingRecorder] Erro no processo do microfone:', err);
      });
    } catch (e) {
      console.error('❌ [MeetingRecorder] Falha ao iniciar pw-record mic:', e);
    }

    // 2. Inicia captura do Áudio do Sistema (Participantes remotos)
    try {
      const sysArgs = ['--rate', '16000', '--channels', '1', '--format', 's16'];
      if (sinkId && sinkId !== '0') {
        sysArgs.push('--target', sinkId);
      }
      sysArgs.push('-');

      this.sysProcess = spawn('pw-record', sysArgs, { stdio: ['ignore', 'pipe', 'ignore'] });

      this.sysProcess.stdout.on('data', (chunk) => {
        if (!this.isRecording) return;
        this.sysBuffer.push(chunk);
        this.fullSysAudioChunks.push(chunk);
        this.sysAudioLength += chunk.length;
        const rms = this.calculateRMS(chunk);
        if (rms > 0.015) {
          this.lastSysActivity = Date.now();
          if (Date.now() - this.lastMicActivity > 400) {
            this.activeSpeaker = 'Participante';
            this.emit('active-speaker', { speaker: 'Participante', channel: 'system' });
          }
        }
        this.emit('audio-volume', { channel: 'system', volume: Math.min(1, rms * 5) });
      });

      this.sysProcess.on('error', (err) => {
        console.error('❌ [MeetingRecorder] Erro no processo do áudio do sistema:', err);
      });
    } catch (e) {
      console.error('❌ [MeetingRecorder] Falha ao iniciar pw-record system:', e);
    }

    // Timer periódico de fatiamento e transcrição em tempo real (a cada 4 segundos)
    this.chunkCheckInterval = setInterval(() => {
      this.processAudioSlices();
    }, 4000);

    // Emissão de status para a interface
    this.emit('meeting-started', {
      id: this.meetingId,
      title: this.meetingTitle,
      startTime: this.startTime,
      attendees: this.attendees
    });

    return true;
  }

  calculateRMS(buffer) {
    if (!buffer || buffer.length === 0) return 0;
    let sum = 0;
    const sampleCount = Math.floor(buffer.length / 2);
    for (let i = 0; i < buffer.length - 1; i += 2) {
      const sample = buffer.readInt16LE(i) / 32768.0;
      sum += sample * sample;
    }
    return Math.sqrt(sum / Math.max(1, sampleCount));
  }

  // Processa fatias de áudio pendentes de ambos os canais
  async processAudioSlices() {
    if (!this.isRecording) return;

    // Processa fatia do Microfone se tiver dados suficientes (mínimo ~1.5s = 48000 bytes em 16kHz 16bit)
    if (this.micAudioLength >= 48000) {
      const micData = Buffer.concat(this.micBuffer);
      this.micBuffer = [];
      this.micAudioLength = 0;
      this.transcribeSlice(micData, 'Você', 'mic');
    }

    // Processa fatia do Sistema (Participantes) se tiver dados suficientes
    if (this.sysAudioLength >= 48000) {
      const sysData = Buffer.concat(this.sysBuffer);
      this.sysBuffer = [];
      this.sysAudioLength = 0;
      // Define speaker label baseado em participantes conhecidos ou 'Participante 1'
      const speakerLabel = this.attendees.length > 1 && this.attendees[1] !== 'Participantes' 
        ? this.attendees[1] 
        : 'Participante 1';
      this.transcribeSlice(sysData, speakerLabel, 'system');
    }
  }

  createWavHeader(dataLength, sampleRate = 16000, numChannels = 1, bitsPerSample = 16) {
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
  }

  async transcribeSlice(pcmBuffer, defaultSpeaker, channel) {
    if (!pcmBuffer || pcmBuffer.length < 16000) return;
    const wavHeader = this.createWavHeader(pcmBuffer.length);
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

    const tempWav = path.join(os.tmpdir(), `meeting_${Date.now()}_${channel}.wav`);
    fs.writeFileSync(tempWav, wavBuffer);

    const apiKey = this.getGroqKey();
    if (!apiKey) {
      try { fs.unlinkSync(tempWav); } catch (_) {}
      return;
    }

    // Executa curl multipart para a API Groq Whisper Large-v3
    const prompt = channel === 'mic' 
      ? "Sua fala na reunião em português do Brasil."
      : "Fala dos participantes remotos da chamada em português do Brasil.";

    const cmd = `curl -s -X POST "https://api.groq.com/openai/v1/audio/transcriptions" \
      -H "Authorization: Bearer ${apiKey}" \
      -F "file=@${tempWav}" \
      -F "model=whisper-large-v3" \
      -F "response_format=json" \
      -F "language=pt" \
      -F "prompt=${prompt}"`;

    exec(cmd, { timeout: 12000 }, (err, stdout) => {
      try { fs.unlinkSync(tempWav); } catch (_) {}
      if (err || !stdout) return;

      try {
        const res = JSON.parse(stdout);
        const text = (res.text || '').trim();
        if (text && text.length > 2 && !this.isHallucination(text)) {
          const timestampMs = Date.now() - this.startTime;
          const entry = {
            id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            speaker: defaultSpeaker,
            text,
            timestampMs,
            timeFormatted: this.formatTime(timestampMs),
            durationSec: Math.round(pcmBuffer.length / 32000),
            channel
          };
          this.transcripts.push(entry);
          console.log(`💬 [Meeting] [${entry.speaker}] ${entry.text}`);
          this.emit('transcript-turn', entry);
        }
      } catch (_) {}
    });
  }

  isHallucination(text) {
    const list = [
      'obrigado por assistir', 'legendas por', 'tchau', 'subtitles by',
      'amém', 'né', 'é isso', 'thanks for watching', 'bye'
    ];
    const clean = text.toLowerCase().replace(/[.,!?:;]/g, '').trim();
    return list.includes(clean);
  }

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Renomeia um participante em toda a reunião
  renameSpeaker(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    this.attendees = this.attendees.map(a => a === oldName ? newName : a);
    if (!this.attendees.includes(newName)) {
      this.attendees.push(newName);
    }
    this.transcripts.forEach(t => {
      if (t.speaker === oldName) {
        t.speaker = newName;
      }
    });
    this.emit('speakers-updated', { attendees: this.attendees, transcripts: this.transcripts });
  }

  addAttendee(name) {
    if (name && !this.attendees.includes(name)) {
      this.attendees.push(name);
      this.emit('speakers-updated', { attendees: this.attendees });
    }
  }

  async stop() {
    if (!this.isRecording) return null;
    this.isRecording = false;
    this.isProcessingStop = true;

    try {
      if (this.chunkCheckInterval) clearInterval(this.chunkCheckInterval);
      if (this.micProcess) {
        try { this.micProcess.kill('SIGINT'); } catch (_) {}
        this.micProcess = null;
      }
      if (this.sysProcess) {
        try { this.sysProcess.kill('SIGINT'); } catch (_) {}
        this.sysProcess = null;
      }

      const durationMs = Date.now() - this.startTime;
      console.log(`⏹️ [MeetingRecorder] Reunião finalizada. Duração: ${this.formatTime(durationMs)}. Processando fatias finais...`);

      // Processa qualquer resíduo nos buffers
      if (this.micBuffer.length > 0) {
        const micData = Buffer.concat(this.micBuffer);
        await this.transcribeSliceSync(micData, 'Você', 'mic');
      }
      if (this.sysBuffer.length > 0) {
        const sysData = Buffer.concat(this.sysBuffer);
        await this.transcribeSliceSync(sysData, this.attendees[1] || 'Participante 1', 'system');
      }

      // Diarização local pós-reunião: separa as vozes reais dos participantes remotos
      await this.runDiarization();

      // Estruturação por IA com Granola Prompt
      console.log(`🤖 [MeetingRecorder] Estruturando ata e notas com IA (Groq LLaMA)...`);
      const structuredNotes = await this.generateStructuredNotes();

      const meetingResult = {
        id: this.meetingId,
        title: structuredNotes.title || this.meetingTitle,
        summary: structuredNotes.summary,
        actionItems: structuredNotes.actionItems,
        keyTakeaways: structuredNotes.keyTakeaways,
        notesMarkdown: structuredNotes.fullMarkdown,
        attendees: structuredNotes.attendees || this.attendees,
        transcripts: this.transcripts,
        createdAt: this.startTime,
        durationMs,
        durationFormatted: this.formatTime(durationMs),
        client: this.client
      };

      // Salva em disco (Markdown e SQLite) e, se configurado, exporta cópia (.md/.pdf) para pasta local
      await this.saveMeetingToDisk(meetingResult);

      this.emit('meeting-finished', meetingResult);
      return meetingResult;
    } finally {
      this.isProcessingStop = false;
    }
  }

  // Roda a diarização local (pyannote.audio) sobre todo o áudio do sistema da reunião
  // e substitui o rótulo genérico "Participante 1" pelas vozes reais detectadas.
  async runDiarization() {
    if (!this.fullSysAudioChunks || this.fullSysAudioChunks.length === 0) return;
    const sysTranscripts = this.transcripts.filter(t => t.channel === 'system');
    if (sysTranscripts.length === 0) return;

    const pythonBin = path.join(__dirname, 'diarize-venv', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'diarize.py');
    if (!fs.existsSync(pythonBin) || !fs.existsSync(scriptPath)) return;

    const pcmData = Buffer.concat(this.fullSysAudioChunks);
    const wavHeader = this.createWavHeader(pcmData.length);
    const wavBuffer = Buffer.concat([wavHeader, pcmData]);
    const tempWav = path.join(os.tmpdir(), `meeting_${this.meetingId}_diarize.wav`);
    fs.writeFileSync(tempWav, wavBuffer);

    console.log('🗣️ [MeetingRecorder] Rodando diarização local (pyannote.audio)...');

    try {
      const durationSec = pcmData.length / 32000;
      // Inferência em CPU é mais lenta que tempo real; dá uma folga generosa proporcional à duração.
      const timeoutMs = Math.min(900000, Math.max(180000, durationSec * 4000));
      const stdout = await new Promise((resolve, reject) => {
        execFile(pythonBin, [scriptPath, tempWav], { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, out) => {
          if (err) return reject(err);
          resolve(out);
        });
      });

      const parsed = JSON.parse(stdout);
      if (parsed.error) {
        console.warn(`⚠️ [MeetingRecorder] Diarização indisponível (${parsed.error}). Mantendo rótulo genérico de participante.`);
        return;
      }

      const turns = parsed.turns || [];
      if (!turns.length) return;

      this.applyDiarizationLabels(turns, sysTranscripts);
      const voiceCount = new Set(turns.map(t => t.speaker)).size;
      console.log(`✓ [MeetingRecorder] Diarização concluída: ${voiceCount} voz(es) distinta(s) detectada(s) entre os participantes remotos.`);
    } catch (err) {
      console.warn('⚠️ [MeetingRecorder] Falha na diarização local:', err.message || err);
    } finally {
      try { fs.unlinkSync(tempWav); } catch (_) {}
    }
  }

  // Reatribui o speaker de cada trecho transcrito do canal de sistema com base
  // no turno de diarização (voz real) que mais se sobrepõe à sua janela de tempo.
  applyDiarizationLabels(turns, sysTranscripts) {
    const knownNames = this.attendees.slice(1).filter(a => a && a !== 'Participantes');
    const labelForSpeakerIndex = (idx) => knownNames[idx] || `Pessoa ${idx + 1}`;

    for (const entry of sysTranscripts) {
      const durationMs = (entry.durationSec || 0) * 1000;
      const windowStartMs = entry.timestampMs - durationMs;
      const windowEndMs = entry.timestampMs;

      let bestTurn = null;
      let bestOverlap = -Infinity;
      for (const turn of turns) {
        const turnStartMs = turn.start * 1000;
        const turnEndMs = turn.end * 1000;
        const overlap = Math.min(windowEndMs, turnEndMs) - Math.max(windowStartMs, turnStartMs);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestTurn = turn;
        }
      }
      if (bestTurn) {
        entry.speaker = labelForSpeakerIndex(bestTurn.speaker);
      }
    }

    const detectedLabels = [...new Set(sysTranscripts.map(t => t.speaker))];
    for (const label of detectedLabels) {
      if (!this.attendees.includes(label)) this.attendees.push(label);
    }
  }

  async transcribeSliceSync(pcmBuffer, defaultSpeaker, channel) {
    if (!pcmBuffer || pcmBuffer.length < 16000) return;
    const wavHeader = this.createWavHeader(pcmBuffer.length);
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
    const tempWav = path.join(os.tmpdir(), `meeting_final_${Date.now()}_${channel}.wav`);
    fs.writeFileSync(tempWav, wavBuffer);

    const apiKey = this.getGroqKey();
    if (!apiKey) {
      try { fs.unlinkSync(tempWav); } catch (_) {}
      return;
    }

    const cmd = `curl -s -X POST "https://api.groq.com/openai/v1/audio/transcriptions" \
      -H "Authorization: Bearer ${apiKey}" \
      -F "file=@${tempWav}" \
      -F "model=whisper-large-v3" \
      -F "response_format=json" \
      -F "language=pt"`;

    try {
      const stdout = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
      const res = JSON.parse(stdout);
      const text = (res.text || '').trim();
      if (text && text.length > 2 && !this.isHallucination(text)) {
        const timestampMs = Date.now() - this.startTime;
        this.transcripts.push({
          id: `turn_${Date.now()}_final`,
          speaker: defaultSpeaker,
          text,
          timestampMs,
          timeFormatted: this.formatTime(timestampMs),
          durationSec: Math.round(pcmBuffer.length / 32000),
          channel
        });
      }
    } catch (_) {} finally {
      try { fs.unlinkSync(tempWav); } catch (_) {}
    }
  }

  async generateStructuredNotes() {
    const transcriptText = this.transcripts
      .map(t => `${t.speaker} (${t.timeFormatted}): ${t.text}`)
      .join('\n');

    if (!transcriptText || transcriptText.trim().length === 0) {
      return {
        title: this.meetingTitle,
        summary: 'Nenhum áudio falado detectado durante a sessão.',
        actionItems: [],
        keyTakeaways: [],
        attendees: this.attendees,
        fullMarkdown: `# ${this.meetingTitle}\n\n*Nenhuma fala registrada.*`
      };
    }

    const apiKey = this.getGroqKey();
    if (!apiKey) {
      return {
        title: this.meetingTitle,
        summary: 'Transcrição concluída. Adicione uma chave Groq para estruturação automática por IA.',
        actionItems: [],
        keyTakeaways: [],
        attendees: this.attendees,
        fullMarkdown: `# ${this.meetingTitle}\n\n## Transcrição Completa\n\n${transcriptText}`
      };
    }

    const systemPrompt = `Você é o Granola AI Intelligence, um assistente executivo de nível mundial especializado em transformar transcrições de reuniões em notas e atas ultra-claras, estruturadas e acionáveis.
Analise a transcrição da reunião com os canais identificados ("Você" e "Participante / Outros").
Se houver nomes mencionados ("Oi William", "Aqui é o Carlos", etc.), atribua os nomes corretos aos participantes.

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "title": "Título conciso e profissional da reunião",
  "attendees": ["Nome 1", "Nome 2"],
  "summary": "Resumo executivo em 2-3 parágrafos claros",
  "keyTakeaways": ["Ponto chave 1", "Ponto chave 2", "Ponto chave 3"],
  "actionItems": [
    { "task": "Descrição da tarefa", "owner": "Responsável", "status": "pending" }
  ],
  "fullMarkdown": "# Título\\n\\n## Resumo Executivo...\\n\\n## Pontos Chave...\\n\\n## Próximos Passos & Tarefas...\\n\\n## Notas Detalhadas da Discussão..."
}`;

    const userPrompt = `TRANSCRIÇÃO DA REUNIÃO:\n${transcriptText}\n\nPARTICIPANTES DECLARADOS: ${this.attendees.join(', ')}`;

    const payload = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    try {
      const tempPayload = path.join(os.tmpdir(), `groq_payload_${Date.now()}.json`);
      fs.writeFileSync(tempPayload, payload);

      const cmd = `curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" \
        -H "Authorization: Bearer ${apiKey}" \
        -H "Content-Type: application/json" \
        -d @${tempPayload}`;

      const stdout = execSync(cmd, { encoding: 'utf8', timeout: 25000 });
      try { fs.unlinkSync(tempPayload); } catch (_) {}

      const res = JSON.parse(stdout);
      const rawContent = res.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);
      return parsed;
    } catch (e) {
      console.error('⚠️ [MeetingRecorder] Erro ao chamar LLM para estruturar reunião:', e.message);
      return {
        title: this.meetingTitle,
        summary: 'Ata gerada com transcrição direta.',
        actionItems: [],
        keyTakeaways: [],
        attendees: this.attendees,
        fullMarkdown: `# ${this.meetingTitle}\n\n## Transcrição da Reunião\n\n${transcriptText}`
      };
    }
  }

  sanitizeForFilename(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .slice(0, 40);
  }

  async saveMeetingToDisk(meeting) {
    const memoryDir = path.resolve(__dirname, '../memory/meetings');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    const dateStr = new Date(meeting.createdAt).toISOString().split('T')[0];
    const cleanTitle = this.sanitizeForFilename(meeting.title) || 'reuniao';

    const mdPath = path.join(memoryDir, `${dateStr}_${cleanTitle}.md`);

    let mdContent = `---
id: ${meeting.id}
title: "${meeting.title.replace(/"/g, '\\"')}"
date: "${new Date(meeting.createdAt).toISOString()}"
duration: "${meeting.durationFormatted}"
attendees: [${(meeting.attendees || []).map(a => `"${a}"`).join(', ')}]
---

# ${meeting.title}

> **Duração:** ${meeting.durationFormatted} | **Data:** ${new Date(meeting.createdAt).toLocaleString('pt-BR')}
> **Participantes:** ${(meeting.attendees || []).join(', ')}

## 📋 Resumo Executivo
${meeting.summary || 'Nenhum resumo gerado.'}

## 🎯 Pontos Principais
${(meeting.keyTakeaways || []).map(k => `- ${k}`).join('\n') || '- N/A'}

## ✅ Próximos Passos & Responsáveis
${(meeting.actionItems || []).map(a => `- [ ] **${a.owner || 'Geral'}:** ${a.task}`).join('\n') || '- N/A'}

## 💬 Diálogo & Transcrição Diarizada
${meeting.transcripts.map(t => `**${t.speaker}** *(${t.timeFormatted})*: ${t.text}`).join('\n\n')}
`;

    try {
      fs.writeFileSync(mdPath, mdContent, 'utf8');
      console.log(`💾 [MeetingRecorder] Reunião salva com sucesso em Markdown: ${mdPath}`);
      memory.saveMeeting({
        id: meeting.id,
        title: meeting.title,
        summary: meeting.summary,
        actionItems: meeting.actionItems,
        keyTakeaways: meeting.keyTakeaways,
        attendees: meeting.attendees,
        durationMs: meeting.durationMs,
        durationFormatted: meeting.durationFormatted,
        notesMarkdown: mdContent,
        transcripts: meeting.transcripts,
        createdAt: meeting.createdAt,
        filePath: mdPath
      });
      await this.exportMeetingCopy(meeting, mdContent, dateStr, cleanTitle);
    } catch (e) {
      console.error('❌ [MeetingRecorder] Erro ao salvar arquivo da reunião:', e);
    }
  }

  // Lê a pasta de exportação configurada pelo usuário (via cápsula) no config compartilhado.
  // Ausência de configuração = recurso desligado, sem afetar o fluxo normal de gravação.
  getExportFolder() {
    try {
      const configPath = path.resolve(__dirname, '../memory/app-config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.meetingExportFolder || null;
    } catch (_) {
      return null;
    }
  }

  // Conversão leve de markdown -> HTML, suficiente para o formato que nós mesmos geramos
  // (frontmatter, títulos, citações, listas e negrito), só para o export em PDF.
  renderMarkdownToHtml(markdown) {
    const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = escape(body).split('\n').map((line) => {
      if (/^### /.test(line)) return `<h3>${line.slice(4)}</h3>`;
      if (/^## /.test(line)) return `<h2>${line.slice(3)}</h2>`;
      if (/^# /.test(line)) return `<h1>${line.slice(2)}</h1>`;
      if (/^&gt; /.test(line)) return `<blockquote>${line.slice(5)}</blockquote>`;
      if (/^- /.test(line)) return `<li>${line.slice(2)}</li>`;
      if (!line.trim()) return '<br/>';
      return `<p>${line}</p>`;
    }).join('\n').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; padding: 48px; line-height: 1.6; }
      h1 { font-size: 26px; } h2 { font-size: 19px; margin-top: 28px; } h3 { font-size: 16px; }
      blockquote { color: #555; border-left: 3px solid #38bdf8; margin: 0; padding-left: 14px; }
      li { margin-left: 20px; }
    </style></head><body>${lines}</body></html>`;
  }

  // Exporta uma cópia da reunião (.md sempre, .pdf se a renderização funcionar) para a pasta
  // local configurada pelo usuário, organizada em subpasta por cliente/projeto quando informado.
  // Falha aqui nunca quebra a gravação: o salvamento em memory/meetings + SQLite já aconteceu antes.
  async exportMeetingCopy(meeting, mdContent, dateStr, cleanTitle) {
    const exportFolder = this.getExportFolder();
    if (!exportFolder) return;

    try {
      const targetDir = meeting.client
        ? path.join(exportFolder, this.sanitizeForFilename(meeting.client) || meeting.client)
        : exportFolder;
      fs.mkdirSync(targetDir, { recursive: true });

      const basename = `${dateStr}_${cleanTitle}`;
      const mdOutPath = path.join(targetDir, `${basename}.md`);
      fs.writeFileSync(mdOutPath, mdContent, 'utf8');

      const pdfOutPath = path.join(targetDir, `${basename}.pdf`);
      const { BrowserWindow } = require('electron');
      const pdfWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
      try {
        const html = this.renderMarkdownToHtml(mdContent);
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const pdfBuffer = await pdfWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
        fs.writeFileSync(pdfOutPath, pdfBuffer);
      } finally {
        pdfWindow.destroy();
      }

      console.log(`📁 [MeetingRecorder] Cópia exportada para: ${targetDir}`);
    } catch (e) {
      console.warn('⚠️ [MeetingRecorder] Falha ao exportar cópia para pasta local:', e.message || e);
    }
  }
}

module.exports = new MeetingRecorder();
