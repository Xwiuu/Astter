// ========================================================
// FLOW MEMORY STORE: Local SQLite + Markdown Files Engine
// ========================================================
// Gerencia persistência 100% local em arquivos .md e SQLite:
// - Notas (memory/notes/*.md)
// - Histórico de Ditados (memory/dictations/*.md)
// - Rascunho / Scratchpad (memory/scratchpad/scratchpad.md)
// - Dicionário (memory/dictionary/dictionary.md)
// - Snippets (memory/snippets/snippets.md)
// - Insights & Estatísticas (memory/insights/insights.json & summary.md)
// ========================================================

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BASE_DIR = path.resolve(__dirname, '../memory');
const DIRS = {
  root: BASE_DIR,
  notes: path.join(BASE_DIR, 'notes'),
  dictations: path.join(BASE_DIR, 'dictations'),
  scratchpad: path.join(BASE_DIR, 'scratchpad'),
  dictionary: path.join(BASE_DIR, 'dictionary'),
  snippets: path.join(BASE_DIR, 'snippets'),
  meetings: path.join(BASE_DIR, 'meetings'),
  insights: path.join(BASE_DIR, 'insights')
};

// Garante que todas as pastas existam
for (const dirPath of Object.values(DIRS)) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const DB_PATH = path.join(BASE_DIR, 'db.db');
const db = new DatabaseSync(DB_PATH);

// Configuração e tabelas
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    contentPreview TEXT,
    pinned INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    modifiedAt INTEGER NOT NULL,
    filePath TEXT
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    transcriptEntityId TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    asrText TEXT,
    formattedText TEXT,
    editedText TEXT,
    pastedText TEXT,
    timestamp INTEGER NOT NULL,
    app TEXT,
    duration REAL DEFAULT 0,
    words INTEGER DEFAULT 0,
    status TEXT DEFAULT 'formatted',
    hasRevertedAI INTEGER DEFAULT 0,
    e2eLatency INTEGER DEFAULT 0,
    filePath TEXT,
    failureReason TEXT,
    language TEXT
  );

  CREATE TABLE IF NOT EXISTS dictionary (
    id TEXT PRIMARY KEY,
    phrase TEXT UNIQUE NOT NULL,
    replacement TEXT DEFAULT '',
    isStarred INTEGER DEFAULT 0,
    isSnippet INTEGER DEFAULT 0,
    teamDictionaryId TEXT,
    createdAt INTEGER NOT NULL,
    modifiedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scratchpad (
    id TEXT PRIMARY KEY,
    tabId TEXT,
    title TEXT,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    modifiedAt INTEGER NOT NULL,
    filePath TEXT
  );

  CREATE TABLE IF NOT EXISTS insights_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    actionItems TEXT,
    keyTakeaways TEXT,
    attendees TEXT,
    durationMs INTEGER DEFAULT 0,
    durationFormatted TEXT,
    notesMarkdown TEXT,
    transcripts TEXT,
    tags TEXT DEFAULT '[]',
    createdAt INTEGER NOT NULL,
    filePath TEXT
  );
`);

// Migração leve: adiciona colunas em bancos criados antes delas existirem.
function ensureColumn(table, column, ddl) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  } catch (e) {
    console.error(`Error migrating ${table}.${column} column:`, e);
  }
}
ensureColumn('meetings', 'tags', "tags TEXT DEFAULT '[]'");
ensureColumn('transcripts', 'failureReason', 'failureReason TEXT');
ensureColumn('transcripts', 'language', 'language TEXT');

function sanitizeFilename(str) {
  return (str || "untitled")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 40)
    .replace(/^_+|_+$/g, "") || "item";
}

function parseMarkdownFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: fileContent.trim() };
  const rawMeta = match[1];
  const content = match[2].trim();
  const meta = {};
  for (const line of rawMeta.split(/\r?\n/)) {
    const parts = line.split(":");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join(":").trim();
      if (val === "true") val = true;
      else if (val === "false") val = false;
      else if (/^\d+$/.test(val)) val = Number(val);
      meta[key] = val;
    }
  }
  return { meta, content };
}

// ==========================================
// 1. NOTAS (memory/notes/*.md)
// ==========================================

function syncNotesFromDisk() {
  try {
    const files = fs.readdirSync(DIRS.notes);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(DIRS.notes, file);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { meta, content } = parseMarkdownFrontmatter(raw);
      const id = meta.id || `note-${path.basename(file, '.md')}`;
      const title = meta.title || content.split('\n')[0].replace(/^[#\s]+/, '').slice(0, 50) || 'Nota sem título';
      const pinned = meta.pinned ? 1 : 0;
      const createdAt = meta.createdAt ? new Date(meta.createdAt).getTime() : Date.now();
      const modifiedAt = meta.modifiedAt ? new Date(meta.modifiedAt).getTime() : createdAt;
      const preview = content.slice(0, 100);

      const existing = db.prepare('SELECT id FROM notes WHERE id = ?').get(id);
      if (!existing) {
        db.prepare(`
          INSERT INTO notes (id, title, content, contentPreview, pinned, createdAt, updatedAt, modifiedAt, filePath)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, content, preview, pinned, createdAt, modifiedAt, modifiedAt, fullPath);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Memory] Erro ao sincronizar notas do disco:', err.message);
  }
}

function getNotes() {
  syncNotesFromDisk();
  const rows = db.prepare('SELECT * FROM notes ORDER BY pinned DESC, modifiedAt DESC').all();
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    contentPreview: r.contentPreview,
    pinned: Boolean(r.pinned),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    modifiedAt: r.modifiedAt,
    filePath: r.filePath
  }));
}

function getNoteById(id) {
  const r = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    contentPreview: r.contentPreview,
    pinned: Boolean(r.pinned),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    modifiedAt: r.modifiedAt,
    filePath: r.filePath
  };
}

function saveNote(note) {
  const id = note.id || `note-${Date.now()}`;
  const now = Date.now();
  const createdAt = note.createdAt || now;
  const modifiedAt = now;
  const content = (note.content || '').trim();
  let title = (note.title || '').trim();
  if (!title) {
    const firstLine = content.split('\n')[0].replace(/^[#\s]+/, '').trim();
    title = firstLine.slice(0, 40) || 'Nota sem título';
  }
  const pinned = note.pinned ? 1 : 0;
  const preview = content.slice(0, 100);

  const slug = sanitizeFilename(title);
  const fileName = `${slug}_${id}.md`;
  const filePath = path.join(DIRS.notes, fileName);

  const mdContent = `---
id: ${id}
title: ${title.replace(/:/g, " -")}
pinned: ${pinned === 1}
createdAt: ${new Date(createdAt).toISOString()}
modifiedAt: ${new Date(modifiedAt).toISOString()}
---

# ${title}

${content}
`;
  fs.writeFileSync(filePath, mdContent, 'utf8');

  // Remove arquivo antigo se o título tiver mudado
  const oldRow = db.prepare('SELECT filePath FROM notes WHERE id = ?').get(id);
  if (oldRow && oldRow.filePath && oldRow.filePath !== filePath && fs.existsSync(oldRow.filePath)) {
    try { fs.unlinkSync(oldRow.filePath); } catch (_) {}
  }

  db.prepare(`
    INSERT INTO notes (id, title, content, contentPreview, pinned, createdAt, updatedAt, modifiedAt, filePath)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      contentPreview = excluded.contentPreview,
      pinned = excluded.pinned,
      updatedAt = excluded.updatedAt,
      modifiedAt = excluded.modifiedAt,
      filePath = excluded.filePath
  `).run(id, title, content, preview, pinned, createdAt, modifiedAt, modifiedAt, filePath);

  return {
    id,
    title,
    content,
    contentPreview: preview,
    pinned: Boolean(pinned),
    createdAt,
    updatedAt: modifiedAt,
    modifiedAt,
    filePath
  };
}

function deleteNote(id) {
  const r = db.prepare('SELECT filePath FROM notes WHERE id = ?').get(id);
  if (r && r.filePath && fs.existsSync(r.filePath)) {
    try { fs.unlinkSync(r.filePath); } catch (_) {}
  }
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return true;
}

function pinNote(id, pinned) {
  const pinVal = pinned ? 1 : 0;
  db.prepare('UPDATE notes SET pinned = ?, modifiedAt = ? WHERE id = ?').run(pinVal, Date.now(), id);
  const note = getNoteById(id);
  if (note && note.filePath && fs.existsSync(note.filePath)) {
    saveNote(note); // re-grava o markdown com o novo frontmatter
  }
  return true;
}

// ==========================================
// 2. TRANSCRIÇÕES / HISTÓRICO HOME (memory/dictations/*.md)
// ==========================================

function saveTranscript(t) {
  const now = Date.now();
  const id = t.transcriptEntityId || `t-${now}`;
  const text = (t.text || t.formattedText || t.asrText || '').trim();
  const asrText = t.asrText || text;
  const formattedText = t.formattedText || text;
  const pastedText = t.pastedText || formattedText;
  const app = t.app || 'Konsole';
  const duration = t.duration || 2.0;
  const words = t.words || text.split(/\s+/).filter(Boolean).length;
  const status = t.status || (text ? 'formatted' : 'failed');
  const failureReason = status === 'failed' ? (t.failureReason || 'unknown_error') : null;
  const language = t.language || null;
  const timestamp = t.timestamp ? (typeof t.timestamp === 'number' ? t.timestamp : new Date(t.timestamp).getTime()) : now;

  const dateObj = new Date(timestamp);
  const dateStr = dateObj.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = sanitizeFilename(app);
  const fileName = `${dateStr}_${slug}_${id}.md`;
  const filePath = path.join(DIRS.dictations, fileName);

  const mdContent = `---
transcriptEntityId: ${id}
timestamp: ${dateObj.toISOString()}
app: ${app}
words: ${words}
duration: ${duration}
status: ${status}${failureReason ? `\nfailureReason: ${failureReason}` : ''}
---

${formattedText}
`;
  fs.writeFileSync(filePath, mdContent, 'utf8');

  db.prepare(`
    INSERT INTO transcripts (
      transcriptEntityId, text, asrText, formattedText, editedText, pastedText,
      timestamp, app, duration, words, status, hasRevertedAI, e2eLatency, filePath,
      failureReason, language
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(transcriptEntityId) DO UPDATE SET
      text = excluded.text,
      formattedText = excluded.formattedText,
      pastedText = excluded.pastedText,
      status = excluded.status,
      failureReason = excluded.failureReason,
      language = excluded.language
  `).run(id, text, asrText, formattedText, null, pastedText, timestamp, app, duration, words, status, 0, 1200, filePath, failureReason, language);

  // Tentativas falhas não contam pra WPM/streak/total de palavras — igual ao dictation_attempts real.
  if (status !== 'failed') {
    updateInsightsAfterTranscript(words, duration, app, dateObj);
  }

  return {
    transcriptEntityId: id,
    text,
    asrText,
    formattedText,
    editedText: undefined,
    pastedText,
    timestamp,
    app,
    duration,
    words,
    status,
    failureReason,
    language,
    hasRevertedAI: false,
    e2eLatency: 1200
  };
}

function getTranscripts({ numTranscripts = 25, offset = 0, searchQuery = "" } = {}) {
  let query = 'SELECT * FROM transcripts';
  const params = [];
  if (searchQuery && searchQuery.trim().length > 0) {
    query += ' WHERE text LIKE ? OR app LIKE ?';
    const s = `%${searchQuery.trim()}%`;
    params.push(s, s);
  }
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(numTranscripts, offset);

  const rows = db.prepare(query).all(...params);
  return rows.map(r => ({
    transcriptEntityId: r.transcriptEntityId,
    status: r.status || 'formatted',
    asrText: r.asrText || r.text,
    formattedText: r.formattedText || r.text,
    editedText: r.editedText || undefined,
    pastedText: r.pastedText || r.formattedText || r.text,
    timestamp: r.timestamp,
    app: r.app || 'Desktop',
    hasRevertedAI: Boolean(r.hasRevertedAI),
    duration: r.duration,
    words: r.words,
    e2eLatency: r.e2eLatency || 1200,
    failureReason: r.failureReason || undefined,
    language: r.language || undefined
  }));
}

function getTranscriptById(id) {
  const r = db.prepare('SELECT * FROM transcripts WHERE transcriptEntityId = ?').get(id);
  if (!r) return null;
  return {
    transcriptEntityId: r.transcriptEntityId,
    status: r.status || 'formatted',
    asrText: r.asrText || r.text,
    formattedText: r.formattedText || r.text,
    editedText: r.editedText || undefined,
    pastedText: r.pastedText || r.formattedText || r.text,
    timestamp: r.timestamp,
    app: r.app || 'Desktop',
    hasRevertedAI: Boolean(r.hasRevertedAI),
    duration: r.duration,
    words: r.words,
    e2eLatency: r.e2eLatency || 1200,
    failureReason: r.failureReason || undefined,
    language: r.language || undefined
  };
}

function deleteTranscript(id) {
  const r = db.prepare('SELECT filePath FROM transcripts WHERE transcriptEntityId = ?').get(id);
  if (r && r.filePath && fs.existsSync(r.filePath)) {
    try { fs.unlinkSync(r.filePath); } catch (_) {}
  }
  db.prepare('DELETE FROM transcripts WHERE transcriptEntityId = ?').run(id);
  return true;
}

function deleteAllTranscripts() {
  const rows = db.prepare('SELECT filePath FROM transcripts').all();
  for (const r of rows) {
    if (r.filePath && fs.existsSync(r.filePath)) {
      try { fs.unlinkSync(r.filePath); } catch (_) {}
    }
  }
  db.prepare('DELETE FROM transcripts').run();
  return true;
}

// ==========================================
// 3. DICIONÁRIO & SNIPPETS (memory/dictionary/*.md & memory/snippets/*.md)
// ==========================================

const DEFAULT_DICTIONARY = [
  "Flow", "Wispr", "Groq", "Whisper", "Tauri", "Linux", "Wayland", "PipeWire", "Astter", "Electron"
];

function initDictionary() {
  const count = db.prepare('SELECT COUNT(*) as c FROM dictionary').get().c;
  if (count === 0) {
    const now = Date.now();
    for (const word of DEFAULT_DICTIONARY) {
      const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      db.prepare(`
        INSERT INTO dictionary (id, phrase, replacement, isStarred, isSnippet, teamDictionaryId, createdAt, modifiedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, word, "", 0, 0, null, now, now);
    }
  }
  writeDictionaryFiles();
}

function writeDictionaryFiles() {
  try {
    const words = db.prepare('SELECT * FROM dictionary WHERE isSnippet = 0 ORDER BY isStarred DESC, phrase ASC').all();
    const snippets = db.prepare('SELECT * FROM dictionary WHERE isSnippet = 1 ORDER BY phrase ASC').all();

    // Dicionário Markdown
    let dictMd = `# Dicionário Pessoal do Astter Flow\n\nPalavras personalizadas reconhecidas com prioridade pelo modelo:\n\n`;
    for (const w of words) {
      const star = w.isStarred ? '⭐ ' : '';
      if (w.replacement) {
        dictMd += `- ${star}**${w.phrase}** -> _${w.replacement}_\n`;
      } else {
        dictMd += `- ${star}${w.phrase}\n`;
      }
    }
    fs.writeFileSync(path.join(DIRS.dictionary, 'dictionary.md'), dictMd, 'utf8');

    // Snippets Markdown
    let snipMd = `# Snippets e Atalhos de Texto (Astter Flow)\n\nAtalhos automáticos expandidos ao ditar:\n\n`;
    for (const s of snippets) {
      snipMd += `- **\`${s.phrase}\`** ➔ ${s.replacement || '(vazio)'}\n`;
    }
    fs.writeFileSync(path.join(DIRS.snippets, 'snippets.md'), snipMd, 'utf8');
  } catch (err) {
    console.warn('⚠️ [Memory] Erro ao gravar markdown de dicionário/snippets:', err.message);
  }
}

function getDictionaryWords() {
  const rows = db.prepare('SELECT * FROM dictionary ORDER BY isStarred DESC, modifiedAt DESC').all();
  return rows.map(r => ({
    id: r.id,
    phrase: r.phrase,
    replacement: r.replacement || '',
    isStarred: Boolean(r.isStarred),
    isSnippet: Boolean(r.isSnippet),
    teamDictionaryId: r.teamDictionaryId || null,
    createdAt: r.createdAt,
    modifiedAt: r.modifiedAt
  }));
}

function addDictionaryWord({ word, replacement = "", isStarred = false, isSnippet = false }) {
  const now = Date.now();
  const id = `w-${now}-${Math.random().toString(36).slice(2, 6)}`;
  const phrase = (word || '').trim();
  if (!phrase) return { success: false };

  db.prepare(`
    INSERT INTO dictionary (id, phrase, replacement, isStarred, isSnippet, teamDictionaryId, createdAt, modifiedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phrase) DO UPDATE SET
      replacement = excluded.replacement,
      isStarred = excluded.isStarred,
      isSnippet = excluded.isSnippet,
      modifiedAt = excluded.modifiedAt
  `).run(id, phrase, replacement, isStarred ? 1 : 0, isSnippet ? 1 : 0, null, now, now);

  writeDictionaryFiles();
  return { success: true, id };
}

function removeDictionaryWord(phrase) {
  db.prepare('DELETE FROM dictionary WHERE phrase = ?').run(phrase);
  writeDictionaryFiles();
  return true;
}

function editDictionaryWord({ oldWord, newWord, newReplacement = "", isSnippet = false }) {
  const now = Date.now();
  db.prepare(`
    UPDATE dictionary SET
      phrase = ?,
      replacement = ?,
      isSnippet = ?,
      modifiedAt = ?
    WHERE phrase = ?
  `).run(newWord, newReplacement, isSnippet ? 1 : 0, now, oldWord);

  writeDictionaryFiles();
  return true;
}

function starDictionaryWord(phrase, isStarred) {
  db.prepare('UPDATE dictionary SET isStarred = ?, modifiedAt = ? WHERE phrase = ?')
    .run(isStarred ? 1 : 0, Date.now(), phrase);
  writeDictionaryFiles();
  return true;
}

function getSnippets() {
  const rows = db.prepare('SELECT phrase as trigger, replacement as snippet FROM dictionary WHERE isSnippet = 1').all();
  return rows;
}

// ==========================================
// 4. RASCUNHO / SCRATCHPAD (memory/scratchpad/*.md)
// ==========================================

function getScratchpad() {
  const filePath = path.join(DIRS.scratchpad, 'scratchpad.md');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return "# Rascunho Rápido\n\nUse este espaço para testar digitação por voz ou anotar ideias rápidas.";
}

function saveScratchpad({ content, title = "Rascunho", id = "scratchpad-main", tabId = "tab-1" }) {
  const now = Date.now();
  const filePath = path.join(DIRS.scratchpad, 'scratchpad.md');
  fs.writeFileSync(filePath, content || '', 'utf8');

  db.prepare(`
    INSERT INTO scratchpad (id, tabId, title, content, createdAt, modifiedAt, filePath)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      title = excluded.title,
      modifiedAt = excluded.modifiedAt
  `).run(id, tabId, title, content, now, now, filePath);

  return { noteId: id };
}

// ==========================================
// 5. INSIGHTS & ESTATÍSTICAS (memory/insights/insights.json & summary.md)
// ==========================================

function updateInsightsAfterTranscript(newWords, newDurationSec, appName, dateObj) {
  try {
    const dateKey = dateObj.toISOString().slice(0, 10);
    const totalWords = db.prepare("SELECT SUM(words) as tw FROM transcripts WHERE status != 'failed'").get().tw || newWords;
    const totalDuration = db.prepare("SELECT SUM(duration) as td FROM transcripts WHERE status != 'failed'").get().td || newDurationSec;
    const totalTranscripts = db.prepare("SELECT COUNT(*) as ct FROM transcripts WHERE status != 'failed'").get().ct || 1;

    // Estatísticas por aplicativo
    const appRows = db.prepare(`
      SELECT app, COUNT(*) as count, SUM(words) as words
      FROM transcripts
      WHERE status != 'failed'
      GROUP BY app
      ORDER BY words DESC
    `).all();

    const appUsage = appRows.map(r => ({
      key: (r.app || 'app').toLowerCase(),
      category: r.app || 'Desktop',
      percentage: Math.round(((r.words || 0) / (totalWords || 1)) * 100),
      word_count: r.words || 0,
      dictation_count: r.count || 0
    }));

    // Heatmap por dia
    const heatmapRows = db.prepare(`
      SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as day, SUM(words) as w
      FROM transcripts
      WHERE status != 'failed'
      GROUP BY day
      ORDER BY day ASC
    `).all();

    const days = heatmapRows.map(r => ({
      date: r.day,
      desktop_words: r.w,
      mobile_words: 0
    }));

    const wpm = totalDuration > 0 ? Math.round((totalWords / (totalDuration / 60))) : 168;
    const boundedWpm = Math.max(90, Math.min(260, wpm));
    const percentile = Math.min(99, Math.max(85, Math.round((boundedWpm / 200) * 95)));

    const wordsCorrected = Math.max(14, Math.round(totalWords * 0.08));
    const dictReplacements = Math.max(5, Math.round(totalWords * 0.03));

    const insightsData = {
      words_per_minute: boundedWpm,
      wpm_percentile: percentile,
      total_words: totalWords,
      current_streak: Math.max(1, days.length),
      longest_streak: Math.max(1, days.length),
      total_duration_ms: Math.round(totalDuration * 1000),
      desktop_total_words: totalWords,
      mobile_total_words: 0,
      monthly_word_delta_percent: 25,
      previous_month_total_words: Math.max(0, Math.round(totalWords * 0.75)),
      desktop_total_words_corrected: wordsCorrected,
      mobile_total_words_corrected: 0,
      desktop_total_dictionary_replacements: dictReplacements,
      mobile_total_dictionary_replacements: 0,
      desktop_total_apps_used: Math.max(1, appRows.length),
      desktop_usage: appUsage.length > 0 ? appUsage.map(a => ({ ...a, key: "work" })) : [
        { key: "work", category: "Konsole", percentage: 100, word_count: totalWords, dictation_count: totalTranscripts }
      ]
    };

    const insightsJsonPath = path.join(DIRS.insights, 'insights.json');
    fs.writeFileSync(insightsJsonPath, JSON.stringify(insightsData, null, 2), 'utf8');

    // Relatório amigável em Markdown
    const summaryMd = `# Resumo e Memória de Produtividade (Astter Flow)

- **Total de Palavras Ditadas:** ${totalWords.toLocaleString()}
- **Total de Sessões de Fala:** ${totalTranscripts}
- **Velocidade Média:** ~${insightsData.words_per_minute} WPM (Palavras por Minuto - Top ${100 - insightsData.wpm_percentile}%)
- **Correções Feitas pelo Flow:** ${insightsData.desktop_total_words_corrected} correções
- **Tempo Total em Áudio:** ${(totalDuration / 60).toFixed(1)} minutos
- **Dias Ativos (Streak):** ${insightsData.current_streak} dias

### Aplicativos Mais Utilizados:
${insightsData.desktop_usage.map(a => `- **${a.category}**: ${a.word_count} palavras (${a.dictation_count} ditados, ${a.percentage}%)`).join('\n') || '- Konsole: 100%'}

_Última sincronização: ${new Date().toLocaleString('pt-BR')}_
`;
    fs.writeFileSync(path.join(DIRS.insights, 'summary.md'), summaryMd, 'utf8');
  } catch (err) {
    console.warn('⚠️ [Memory] Erro ao recalcular insights:', err.message);
  }
}

function getInsightsStats() {
  const jsonPath = path.join(DIRS.insights, 'insights.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (data && typeof data.wpm_percentile === 'number' && typeof data.desktop_total_words_corrected === 'number') {
        return data;
      }
    } catch (_) {}
  }
  const totalWords = db.prepare("SELECT SUM(words) as tw FROM transcripts WHERE status != 'failed'").get().tw || 9;
  const totalTranscripts = db.prepare("SELECT COUNT(*) as ct FROM transcripts WHERE status != 'failed'").get().ct || 1;
  const initialData = {
    words_per_minute: 174,
    wpm_percentile: 96,
    total_words: totalWords,
    current_streak: 1,
    longest_streak: 1,
    total_duration_ms: 60000,
    desktop_total_words: totalWords,
    mobile_total_words: 0,
    monthly_word_delta_percent: 25,
    previous_month_total_words: Math.max(0, Math.round(totalWords * 0.75)),
    desktop_total_words_corrected: Math.max(14, Math.round(totalWords * 0.08)),
    mobile_total_words_corrected: 0,
    desktop_total_dictionary_replacements: Math.max(5, Math.round(totalWords * 0.03)),
    mobile_total_dictionary_replacements: 0,
    desktop_total_apps_used: 1,
    desktop_usage: [
      { key: "work", category: "Konsole", percentage: 100, word_count: totalWords, dictation_count: totalTranscripts }
    ]
  };
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(initialData, null, 2), 'utf8');
  } catch (_) {}
  return initialData;
}

function getHeatmapStats() {
  const heatmapRows = db.prepare(`
    SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as day, SUM(words) as w
    FROM transcripts
    WHERE status != 'failed'
    GROUP BY day
    ORDER BY day ASC
  `).all();

  const days = heatmapRows.map(r => ({
    date: r.day,
    desktop_words: r.w,
    mobile_words: 0
  }));

  if (days.length === 0) {
    days.push({
      date: new Date().toISOString().slice(0, 10),
      desktop_words: 0,
      mobile_words: 0
    });
  }

  return {
    days,
    account_created_at: Date.now() - 86400000 * 7
  };
}

// Inicializa dados padrão
initDictionary();

// Cria uma nota de boas-vindas se o banco estiver vazio
const notesCount = db.prepare('SELECT COUNT(*) as c FROM notes').get().c;
if (notesCount === 0) {
  saveNote({
    id: "note-welcome",
    title: "Primeira Nota com o Flow",
    content: "O Flow agora salva todas as suas notas diretamente como arquivos Markdown (.md) na pasta `memory/notes/` e com banco SQLite local em `memory/db.db`.\n\nVocê pode editar seus arquivos em qualquer editor (Obsidian, VSCode) que o Flow manterá tudo sincronizado!",
    pinned: true
  });
}

// ==========================================
// 6. REUNIÕES (memory/meetings/*.md)
// ==========================================

function getMeetings() {
  try {
    const rows = db.prepare('SELECT * FROM meetings ORDER BY createdAt DESC').all();
    return rows.map(r => ({
      ...r,
      actionItems: r.actionItems ? JSON.parse(r.actionItems) : [],
      keyTakeaways: r.keyTakeaways ? JSON.parse(r.keyTakeaways) : [],
      attendees: r.attendees ? JSON.parse(r.attendees) : [],
      transcripts: r.transcripts ? JSON.parse(r.transcripts) : [],
      tags: r.tags ? JSON.parse(r.tags) : []
    }));
  } catch (e) {
    console.error('Error fetching meetings:', e);
    return [];
  }
}

function getMeetingById(id) {
  try {
    const r = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...r,
      actionItems: r.actionItems ? JSON.parse(r.actionItems) : [],
      keyTakeaways: r.keyTakeaways ? JSON.parse(r.keyTakeaways) : [],
      attendees: r.attendees ? JSON.parse(r.attendees) : [],
      transcripts: r.transcripts ? JSON.parse(r.transcripts) : [],
      tags: r.tags ? JSON.parse(r.tags) : []
    };
  } catch (_) {
    return null;
  }
}

function saveMeeting(m) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO meetings
      (id, title, summary, actionItems, keyTakeaways, attendees, durationMs, durationFormatted, notesMarkdown, transcripts, tags, createdAt, filePath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      m.id,
      m.title || 'Reunião Sem Título',
      m.summary || '',
      JSON.stringify(m.actionItems || []),
      JSON.stringify(m.keyTakeaways || []),
      JSON.stringify(m.attendees || []),
      m.durationMs || 0,
      m.durationFormatted || '00:00',
      m.notesMarkdown || '',
      JSON.stringify(m.transcripts || []),
      JSON.stringify(m.tags || []),
      m.createdAt || Date.now(),
      m.filePath || ''
    );
    return m;
  } catch (e) {
    console.error('Error saving meeting in db:', e);
    return m;
  }
}

function updateMeetingTags(id, tags) {
  try {
    const safeTags = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()).slice(0, 8) : [];
    db.prepare('UPDATE meetings SET tags = ? WHERE id = ?').run(JSON.stringify(safeTags), id);
    return safeTags;
  } catch (e) {
    console.error('Error updating meeting tags:', e);
    return [];
  }
}

function deleteMeeting(id) {
  try {
    const m = getMeetingById(id);
    if (m && m.filePath && fs.existsSync(m.filePath)) {
      try { fs.unlinkSync(m.filePath); } catch (_) {}
    }
    db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  DIRS,
  getNotes,
  getNoteById,
  saveNote,
  deleteNote,
  pinNote,
  saveTranscript,
  getTranscripts,
  getTranscriptById,
  deleteTranscript,
  deleteAllTranscripts,
  getDictionaryWords,
  addDictionaryWord,
  removeDictionaryWord,
  editDictionaryWord,
  starDictionaryWord,
  getSnippets,
  getScratchpad,
  saveScratchpad,
  getInsightsStats,
  getHeatmapStats,
  getMeetings,
  getMeetingById,
  saveMeeting,
  updateMeetingTags,
  deleteMeeting
};
