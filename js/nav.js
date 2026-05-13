// nav.js — screen stack + sheet open/close.
//
// Modules can subscribe to sheet lifecycle events on `document`:
//   'sheet:beforeclose' { detail: { name } }
//   'sheet:afterclose'  { detail: { name } }

import { $ } from './utils.js';

let stack = ['s-home'];
let currentSheet = null;

export function topScreen() {
  return stack[stack.length - 1];
}

export function getCurrentSheet() {
  return currentSheet;
}

export function push(id) {
  const curId = stack[stack.length - 1];
  const curEl = document.getElementById(curId);
  const nxtEl = document.getElementById(id);
  if (curEl) {
    curEl.classList.remove('active');
    curEl.classList.add('behind');
  }
  if (nxtEl) {
    nxtEl.classList.remove('behind');
    nxtEl.classList.add('active');
    nxtEl.scrollTop = 0;
  }
  stack.push(id);
  updateFabVisibility();
}

export function pop() {
  if (stack.length <= 1) return;
  const curId = stack.pop();
  const prevId = stack[stack.length - 1];
  const curEl = document.getElementById(curId);
  const prevEl = document.getElementById(prevId);
  if (curEl) {
    curEl.classList.remove('active');
    curEl.classList.remove('behind');
  }
  if (prevEl) {
    prevEl.classList.remove('behind');
    prevEl.classList.add('active');
  }
  updateFabVisibility();
}

export function resetTo(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'behind');
  });
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  stack = [id];
  updateFabVisibility();
}

export function updateFabVisibility() {
  const fab = $('new-group-btn');
  if (!fab) return;
  fab.hidden = stack[stack.length - 1] !== 's-event';
}

export function openSheet(name, onFocus) {
  const overlay = $('sheet-overlay');
  const sheet = $(`sheet-${name}`);
  if (!overlay || !sheet) return;
  currentSheet = name;
  document.body.classList.add('sheet-open');
  overlay.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    sheet.classList.add('open');
  });
  if (typeof onFocus === 'function') {
    setTimeout(onFocus, 420);
  }
}

export function closeSheet() {
  if (!currentSheet) return;
  const closing = currentSheet;
  document.dispatchEvent(new CustomEvent('sheet:beforeclose', {
    detail: { name: closing }
  }));
  const overlay = $('sheet-overlay');
  const sheet = $(`sheet-${closing}`);
  if (overlay) overlay.classList.remove('open');
  if (sheet) sheet.classList.remove('open');
  setTimeout(() => {
    if (currentSheet === closing) {
      if (overlay) overlay.hidden = true;
      if (sheet) sheet.hidden = true;
      document.body.classList.remove('sheet-open');
      currentSheet = null;
      document.dispatchEvent(new CustomEvent('sheet:afterclose', {
        detail: { name: closing }
      }));
    }
  }, 260);
}
