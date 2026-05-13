// names.js — name normalization, parsing, search/matching helpers.

import { stripQuotes } from './utils.js';

export function normalizeName(str) {
  return String(str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word =>
      word
        .toLowerCase()
        .replace(/(^|[-'’.])([a-z])/g, (match, prefix, letter) => prefix + letter.toUpperCase())
    )
    .join(' ')
    .trim();
}

export function nameFromDisplay(display) {
  const normalized = normalizeName(display);
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return { first: normalized, last: '', display: normalized };
  return {
    first: parts[0],
    last: parts.slice(1).join(' '),
    display: normalized
  };
}

export function sortAndDedupeNames(names) {
  const seen = new Set();
  const clean = [];
  names.forEach(name => {
    const obj = typeof name === 'string' ? nameFromDisplay(name) : name;
    const display = normalizeName(obj.display || `${obj.first || ''} ${obj.last || ''}`);
    if (!display) return;
    const normalizedObj = nameFromDisplay(display);
    const key = normalizedObj.display.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    clean.push(normalizedObj);
  });
  return clean.sort((a, b) => {
    const last = a.last.localeCompare(b.last, undefined, { sensitivity: 'base' });
    if (last !== 0) return last;
    return a.first.localeCompare(b.first, undefined, { sensitivity: 'base' });
  });
}

export function cleanQuery(value) {
  return normalizeName(String(value || '').replace(/\s+/g, ' '));
}

export function findAlphaMatch(name, alphaList) {
  const target = normalizeName(name).toLowerCase();
  return alphaList.find(entry => entry.display.toLowerCase() === target) || null;
}

export function initials(name) {
  const parts = normalizeName(name).split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

export function scoreAlphaEntry(query, entry) {
  const q = cleanQuery(query).toLowerCase();
  const full = cleanQuery(entry.display).toLowerCase();
  const first = cleanQuery(entry.first).toLowerCase();
  const last = cleanQuery(entry.last).toLowerCase();
  if (full === q) return 100;
  if (last === q) return 95;
  if (last.startsWith(q)) return 90;
  if (full.includes(q) || first.includes(q)) return 75;
  if (q.length >= 3 && levenshtein(q, last) <= 1) return 55;
  return 0;
}

export function parseAlphaText(rawText) {
  const headers = /^(First|Last|Name|Guest|Guests|Group|Table|Page|Alpha List|Attendee|Attendees)$/i;
  const names = [];
  String(rawText || '')
    .split(/\r?\n/)
    .forEach(rawLine => {
      let line = rawLine.trim();
      if (!line || line.length < 4) return;
      if (/^\d+$/.test(line)) return;
      if (headers.test(line)) return;
      let previous = '';
      while (previous !== line) {
        previous = line;
        line = line.replace(
          /\s*(?:Table\s+\d+\s*\*?|Tbl\s+\d+|T-\d+|#\d+|\*+)\s*$/i,
          ''
        ).trim();
      }
      line = line.replace(/\s+/g, ' ');
      if (!line || !/^[A-Z]/.test(line)) return;
      if (!/^[A-Za-z'’\-. ]+$/.test(line)) return;
      const parts = line.split(' ').filter(Boolean);
      if (parts.length < 2 || parts.length > 5) return;
      const first = normalizeName(parts[0]);
      const last = normalizeName(parts.slice(1).join(' '));
      if (!first || !last) return;
      names.push({ first, last, display: `${first} ${last}` });
    });
  return sortAndDedupeNames(names);
}

// Re-export so other modules can import quote-stripping from one place.
export { stripQuotes };
