#!/usr/bin/env node
/**
 * Build deterministic ranked word lists for each vocabulary pack from official
 * CC BY-SA 4.0 source CSVs in data/sources/.
 *
 * Uses only Node.js built-in modules (zero external dependencies).
 *
 * Usage:
 *   node scripts/build-pack-words.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const SOURCES_DIR = resolve(ROOT_DIR, 'data', 'sources');
const OUTPUT_DIR = resolve(ROOT_DIR, 'data', 'packs', 'words');

/**
 * @typedef {Object} PackSliceSpec
 * @property {string} packId
 * @property {number} startIndex - 0-based inclusive start index
 * @property {number} endIndex - 0-based exclusive end index
 */

/**
 * @typedef {Object} SourceSpec
 * @property {string} fileName
 * @property {string} idPrefix
 * @property {'rank' | 'file'} orderBy
 * @property {number} expectedTotal
 * @property {PackSliceSpec[]} packs
 */

/** @type {SourceSpec[]} */
const SOURCE_SPECS = [
  {
    fileName: 'NGSL_12_stats.csv',
    idPrefix: 'ngsl',
    orderBy: 'rank',
    expectedTotal: 2809,
    packs: [
      { packId: 'ngsl-1', startIndex: 0, endIndex: 1000 },
      { packId: 'ngsl-2', startIndex: 1000, endIndex: 2000 },
      { packId: 'ngsl-3', startIndex: 2000, endIndex: 2809 },
    ],
  },
  {
    fileName: 'NAWL_12_with_en_definitions.csv',
    idPrefix: 'nawl',
    orderBy: 'file',
    expectedTotal: 959,
    packs: [{ packId: 'nawl', startIndex: 0, endIndex: 959 }],
  },
  {
    fileName: 'BSL_120_stats.csv',
    idPrefix: 'bsl',
    orderBy: 'rank',
    expectedTotal: 1744,
    packs: [
      { packId: 'bsl-1', startIndex: 0, endIndex: 1000 },
      { packId: 'bsl-2', startIndex: 1000, endIndex: 1744 },
    ],
  },
  {
    fileName: 'TSL_12_stats.csv',
    idPrefix: 'tsl',
    orderBy: 'rank',
    expectedTotal: 1250,
    packs: [
      { packId: 'tsl-1', startIndex: 0, endIndex: 1000 },
      { packId: 'tsl-2', startIndex: 1000, endIndex: 1250 },
    ],
  },
];

const WORD_HEADER_RE = /^(lemma|word|words|headword|meanings?|term)$/i;
const LOOSE_WORD_HEADER_RE = /\b(lemma|word|words|headword|meanings?|term|vocab\w*|item)\b/i;
const RANK_HEADER_RE = /\brank\b/i;
const STAT_HEADER_RE = /^(sfi|u|band|freq\w*|adjusted\b)/i;

/**
 * Decode CSV bytes safely across UTF-8 (with/without BOM), UTF-16 BOM,
 * and legacy single-byte Excel exports (Windows-1252 / MacRoman / Latin-1).
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
function decodeCsvBuffer(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2)).replace(/\u0000/g, '');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2)).replace(/\u0000/g, '');
  }

  const slice =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
      ? buffer.subarray(3)
      : buffer;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(slice).replace(/\u0000/g, '');
  } catch {
    // Legacy Excel CSV exports on macOS/Windows may contain single-byte characters
    // (e.g. non-breaking spaces or accented characters) along with bare CR line endings.
    const hasBareCr = slice.includes(0x0d) && !slice.includes(0x0a);
    const preferredEncoding = hasBareCr ? 'macintosh' : 'windows-1252';
    try {
      return new TextDecoder(preferredEncoding).decode(slice).replace(/\u0000/g, '');
    } catch {
      return slice.toString('latin1').replace(/\u0000/g, '');
    }
  }
}

/**
 * RFC-4180-compatible CSV parser supporting CRLF (\r\n), LF (\n),
 * and classic Mac CR (\r) line endings outside quoted fields.
 *
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Normalize whitespace (including non-breaking spaces) around a cell value.
 *
 * @param {string | undefined} raw
 * @returns {string}
 */
function cleanCell(raw) {
  if (!raw) return '';
  return raw.replace(/[\uFEFF\u00A0]/g, ' ').trim();
}

/**
 * Parse a source CSV into deterministic `{ id, word, rank }` records.
 *
 * @param {SourceSpec} spec
 * @returns {{ id: string; word: string; rank: number }[]}
 */
function loadSourceWords(spec) {
  const csvPath = resolve(SOURCES_DIR, spec.fileName);
  const rawBuffer = readFileSync(csvPath);
  const decoded = decodeCsvBuffer(rawBuffer);
  const rows = parseCsv(decoded);

  let headerRowIndex = -1;
  let dataStartRow = 0;
  let wordCol = 0;
  let rankCol = -1;
  let statCol = -1;

  const searchLimit = Math.min(rows.length, 15);

  // Pass 1: exact headword column header match (Lemma, Word, Meanings, etc.)
  for (let r = 0; r < searchLimit; r += 1) {
    const cells = rows[r].map(cleanCell);
    const foundWordCol = cells.findIndex((c) => WORD_HEADER_RE.test(c));
    if (foundWordCol !== -1) {
      headerRowIndex = r;
      dataStartRow = r + 1;
      wordCol = foundWordCol;
      rankCol = cells.findIndex((c, idx) => idx !== foundWordCol && RANK_HEADER_RE.test(c));
      statCol = cells.findIndex((c, idx) => idx !== foundWordCol && STAT_HEADER_RE.test(c));
      break;
    }
  }

  // Pass 2: fallback for custom/blank first-column headers (e.g. "TSL Word" or "")
  // when a Rank or frequency-stat column header is present on the same row.
  if (headerRowIndex === -1) {
    for (let r = 0; r < searchLimit; r += 1) {
      const cells = rows[r].map(cleanCell);
      const foundRankCol = cells.findIndex((c) => RANK_HEADER_RE.test(c));
      const foundStatCol = cells.findIndex((c) => STAT_HEADER_RE.test(c));
      const foundLooseWordCol = cells.findIndex((c) => LOOSE_WORD_HEADER_RE.test(c));

      if (foundRankCol !== -1 || foundStatCol !== -1 || foundLooseWordCol !== -1) {
        headerRowIndex = r;
        dataStartRow = r + 1;
        wordCol =
          foundLooseWordCol !== -1
            ? foundLooseWordCol
            : cells.findIndex((_, idx) => idx !== foundRankCol && idx !== foundStatCol);
        if (wordCol === -1) wordCol = 0;
        rankCol = foundRankCol !== wordCol ? foundRankCol : -1;
        statCol = foundStatCol !== wordCol ? foundStatCol : -1;
        break;
      }
    }
  }

  // Pass 3: fallback for headerless ranked CSV (<word>, 1, ...)
  if (headerRowIndex === -1 && rows.length > 0) {
    const firstCells = rows[0].map(cleanCell);
    const firstWord = firstCells[0] ?? '';
    const firstRank = Number((firstCells[1] ?? '').replace(/,/g, ''));
    if (firstWord && Number.isNaN(Number(firstWord)) && firstRank === 1) {
      headerRowIndex = 0;
      dataStartRow = 0;
      wordCol = 0;
      rankCol = 1;
    }
  }

  if (headerRowIndex === -1) {
    const preview = rows
      .slice(0, 2)
      .map((r) => JSON.stringify(r.slice(0, 5).map(cleanCell)))
      .join(' | ');
    throw new Error(`Could not locate header row in ${spec.fileName} (first rows: ${preview})`);
  }

  /** @type {{ word: string; csvRank: number; rowIndex: number }[]} */
  const parsed = [];

  for (let r = dataStartRow; r < rows.length; r += 1) {
    const row = rows[r];
    const word = cleanCell(row[wordCol]);
    if (!word) continue;

    if (spec.orderBy === 'rank' && rankCol !== -1) {
      const rankRaw = cleanCell(row[rankCol]).replace(/,/g, '');
      const numericRank = Number(rankRaw);
      if (!Number.isFinite(numericRank) || numericRank <= 0) {
        continue;
      }
      parsed.push({ word, csvRank: numericRank, rowIndex: r });
    } else {
      if (spec.orderBy === 'rank' && statCol !== -1) {
        const statRaw = cleanCell(row[statCol]).replace(/,/g, '');
        if (!statRaw || !Number.isFinite(Number(statRaw))) {
          continue;
        }
      }
      parsed.push({ word, csvRank: parsed.length + 1, rowIndex: r });
    }
  }

  if (spec.orderBy === 'rank' && rankCol !== -1) {
    parsed.sort((a, b) => a.csvRank - b.csvRank || a.rowIndex - b.rowIndex);
  }

  if (parsed.length !== spec.expectedTotal) {
    throw new Error(
      `${spec.fileName}: expected ${spec.expectedTotal} words, parsed ${parsed.length}`
    );
  }

  return parsed.map((item, idx) => {
    const rank = idx + 1;
    return {
      id: `${spec.idPrefix}-${String(rank).padStart(4, '0')}`,
      word: item.word,
      rank,
    };
  });
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  /** @type {{ packId: string; outFile: string; count: number; firstId: string; lastId: string }[]} */
  const summary = [];

  for (const spec of SOURCE_SPECS) {
    const allWords = loadSourceWords(spec);

    for (const sliceSpec of spec.packs) {
      const packWords = allWords.slice(sliceSpec.startIndex, sliceSpec.endIndex);
      const expectedSliceCount = sliceSpec.endIndex - sliceSpec.startIndex;

      if (packWords.length !== expectedSliceCount) {
        throw new Error(
          `Pack ${sliceSpec.packId}: expected ${expectedSliceCount} words, got ${packWords.length}`
        );
      }

      const outPath = resolve(OUTPUT_DIR, `${sliceSpec.packId}.json`);
      writeFileSync(outPath, `${JSON.stringify(packWords, null, 2)}\n`, 'utf8');

      summary.push({
        packId: sliceSpec.packId,
        outFile: `data/packs/words/${sliceSpec.packId}.json`,
        count: packWords.length,
        firstId: packWords[0]?.id ?? '',
        lastId: packWords[packWords.length - 1]?.id ?? '',
      });
    }
  }

  for (const item of summary) {
    console.log(
      `${item.packId.padEnd(8)} -> ${item.outFile} (${item.count} words: ${item.firstId}..${item.lastId})`
    );
  }
}

main();
