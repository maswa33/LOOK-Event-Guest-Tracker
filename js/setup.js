// setup.js — new event setup screen + alpha-list management + paste sheet.

import { $, uid, todayISO, showToast } from './utils.js';
import {
  normalizeName,
  nameFromDisplay,
  sortAndDedupeNames,
  parseAlphaText
} from './names.js';
import { S, saveState } from './state.js';
import { push, pop, openSheet, closeSheet } from './nav.js';
import { renderEventScreen } from './event.js';

// Working alpha list while building a new event.
let setupAlphaList = [];

export function getSetupAlphaList() {
  return setupAlphaList;
}

export function prepareSetup() {
  setupAlphaList = [];
  $('event-name').value = '';
  $('event-date').value = todayISO();
  clearSetupError();
  renderAlphaPreview();
  updateStartButton();
}

export function setSetupAlphaList(names) {
  setupAlphaList = sortAndDedupeNames(names);
  renderAlphaPreview();
  updateStartButton();
}

export function appendSetupAlphaList(names) {
  const existing = new Set(setupAlphaList.map(name => name.display.toLowerCase()));
  const additions = sortAndDedupeNames(names).filter(
    name => !existing.has(name.display.toLowerCase())
  );
  setSetupAlphaList(setupAlphaList.concat(additions));
  return additions.length;
}

export function clearSetupAlphaList() {
  setupAlphaList = [];
  renderAlphaPreview();
  updateStartButton();
}

export function updateStartButton() {
  const nameReady = $('event-name').value.trim().length > 0;
  $('start-event-btn').disabled = !(nameReady && setupAlphaList.length > 0);
}

export function showSetupError(message) {
  const el = $('setup-error');
  el.textContent = message;
  el.classList.add('visible');
}

export function clearSetupError() {
  const el = $('setup-error');
  el.textContent = '';
  el.classList.remove('visible');
}

function renderAlphaPreview() {
  const wrap = $('preview-wrap');
  const list = $('alpha-preview');
  const count = $('preview-count');
  list.textContent = '';
  count.textContent = `${setupAlphaList.length} ${setupAlphaList.length === 1 ? 'name' : 'names'} loaded`;
  wrap.hidden = setupAlphaList.length === 0;

  setupAlphaList.forEach((nameObj, index) => {
    const row = document.createElement('div');
    row.className = 'preview-row';

    const input = document.createElement('input');
    input.className = 'name-input';
    input.type = 'text';
    input.value = nameObj.display;
    input.setAttribute('aria-label', `Name ${index + 1}`);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
    });
    input.addEventListener('blur', () => {
      const normalized = normalizeName(input.value);
      if (!normalized) {
        setupAlphaList.splice(index, 1);
      } else {
        setupAlphaList[index] = nameFromDisplay(normalized);
      }
      setupAlphaList = sortAndDedupeNames(setupAlphaList);
      renderAlphaPreview();
      updateStartButton();
    });

    const remove = document.createElement('button');
    remove.className = 'small-btn red';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      setupAlphaList.splice(index, 1);
      renderAlphaPreview();
      updateStartButton();
    });

    row.append(input, remove);
    list.append(row);
  });
}

export function createEvent() {
  const eventName = $('event-name').value.trim();
  if (!eventName || setupAlphaList.length < 1) return;
  const now = Date.now();
  const event = {
    id: uid(),
    name: eventName,
    date: $('event-date').value || todayISO(),
    alphaList: setupAlphaList.map(name => ({
      first: name.first,
      last: name.last,
      display: name.display
    })),
    groups: [],
    createdAt: now,
    updatedAt: now
  };
  S.events.push(event);
  saveState();
  S.activeId = event.id;
  saveState();
  renderEventScreen();
  pop();
  push('s-event');
  // Home re-render is handled by app.js on back; nothing else to do here.
}

// ---------- paste sheet ----------

export function openPasteSheet() {
  $('paste-text').value = '';
  openSheet('paste', () => $('paste-text').focus());
}

export function addPastedNames() {
  try {
    const parsed = parseAlphaText($('paste-text').value);
    const added = appendSetupAlphaList(parsed);
    closeSheet();
    showToast(
      `Added ${added} ${added === 1 ? 'name' : 'names'} (${setupAlphaList.length} total)`
    );
  } catch (error) {
    showToast('Could not add names');
  }
}

// Reset paste textarea on close.
document.addEventListener('sheet:afterclose', event => {
  if (event.detail.name === 'paste') {
    const ta = $('paste-text');
    if (ta) ta.value = '';
  }
});
