// export.js — export screen, clipboard copy, download.

import { $, showToast, sanitizeFilename, todayISO } from './utils.js';
import { currentEvent, eventStats } from './state.js';
import { push } from './nav.js';

export function openExportScreen() {
  const event = currentEvent();
  if (!event) return;
  const preview = $('export-preview');
  if (preview) preview.textContent = buildExport();
  push('s-export');
}

export function buildExport() {
  const event = currentEvent();
  if (!event) return '';
  const stats = eventStats(event);
  const lines = [];
  lines.push('LOOK Events Report');
  lines.push('==================');
  lines.push(`Event: ${event.name}`);
  if (event.date) lines.push(`Date:  ${event.date}`);
  lines.push(
    `Stats: ${stats.groups} groups · ${stats.people} people · ${stats.walkins} walk-ins · ${stats.onList} on alpha`
  );
  lines.push('');

  event.groups.forEach(group => {
    const heading = group.label || `Photo Group ${group.number}`;
    lines.push(`--- ${heading} ---`);
    if (!group.people.length) {
      lines.push('  (no people)');
    } else {
      group.people.forEach(person => {
        const tag = person.walkin ? '  [walk-in]' : '';
        lines.push(`  - ${person.name}${tag}`);
      });
    }
    lines.push('');
  });

  // Names on alpha list that were never photographed
  const photographed = new Set();
  event.groups.forEach(group => {
    group.people.forEach(person => {
      photographed.add(person.name.toLowerCase());
    });
  });
  const missed = (event.alphaList || [])
    .filter(entry => !photographed.has(entry.display.toLowerCase()))
    .map(entry => entry.display);

  if (missed.length) {
    lines.push('--- Not Photographed ---');
    missed.forEach(name => lines.push(`  - ${name}`));
    lines.push('');
  }

  return lines.join('\n');
}

export async function copyExport() {
  const text = buildExport();
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    showToast('Copied to clipboard');
  } catch (error) {
    try {
      fallbackCopy(text);
      showToast('Copied to clipboard');
    } catch (e) {
      showToast('Copy failed');
    }
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  if (!ok) throw new Error('Copy command failed');
}

export function downloadExport() {
  try {
    const event = currentEvent();
    if (!event) return;
    const text = buildExport();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeName = sanitizeFilename(event.name);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOOK_${safeName}_${event.date || todayISO()}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Download started');
  } catch (error) {
    showToast('Download failed');
  }
}
