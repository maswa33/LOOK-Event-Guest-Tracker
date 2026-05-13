// importers.js — Excel / CSV / text file import.

import { showToast, readFileAsText, readFileAsArrayBuffer } from './utils.js';
import {
  normalizeName,
  nameFromDisplay,
  sortAndDedupeNames,
  parseAlphaText,
  stripQuotes
} from './names.js';
import {
  setSetupAlphaList,
  getSetupAlphaList,
  showSetupError,
  clearSetupError
} from './setup.js';

export async function importFile(file) {
  clearSetupError();
  try {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const text = await readFileAsText(file);
      setSetupAlphaList(parseAlphaText(text));
      const total = getSetupAlphaList().length;
      showToast(`${total} ${total === 1 ? 'name' : 'names'} loaded`);
      return;
    }
    const names = await parseExcelFile(file);
    setSetupAlphaList(names);
    const total = getSetupAlphaList().length;
    showToast(`${total} ${total === 1 ? 'name' : 'names'} loaded`);
  } catch (error) {
    showSetupError('Could not import file. Try CSV or paste instead.');
  }
}

async function parseExcelFile(file) {
  if (!window.XLSX) throw new Error('SheetJS unavailable');
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = window.XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheets');
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  let firstIndex = 0;
  let lastIndex = 1;
  let startRow = 0;
  const maxHeaderRows = Math.min(5, rows.length);
  for (let r = 0; r < maxHeaderRows; r += 1) {
    const cells = rows[r].map(cell => String(cell || '').trim());
    const firstCol = cells.findIndex(cell => /\bfirst\b/i.test(cell));
    const lastCol = cells.findIndex(cell => /\blast\b/i.test(cell));
    if (firstCol >= 0 && lastCol >= 0) {
      firstIndex = firstCol;
      lastIndex = lastCol;
      startRow = r + 1;
      break;
    }
  }

  const names = [];
  for (let r = startRow; r < rows.length; r += 1) {
    const row = rows[r];
    const first = stripQuotes(String(row[firstIndex] || '').trim());
    const last = stripQuotes(String(row[lastIndex] || '').trim());
    if (!first && !last) continue;
    const display = normalizeName(`${first} ${last}`);
    if (display) names.push(nameFromDisplay(display));
  }
  return sortAndDedupeNames(names);
}
