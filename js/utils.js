// utils.js — small reusable helpers (no app state).

export function $(id) {
  return document.getElementById(id);
}

export function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function sanitizeFilename(name) {
  return (name || 'Event').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Event';
}

export function stripQuotes(value) {
  return String(value).replace(/^['"]+|['"]+$/g, '');
}

let toastTimer = null;

export function showToast(message, options = {}) {
  const toast = $('toast');
  if (!toast) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  if (!options.persistent) {
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toastTimer = setTimeout(() => {
        toast.hidden = true;
        toastTimer = null;
      }, 200);
    }, 2400);
  }
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsText(file, 'UTF-8');
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsArrayBuffer(file);
  });
}
