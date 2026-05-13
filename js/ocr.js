// ocr.js — OCR sheet, image preprocessing, Tesseract worker management.

import { $, showToast } from './utils.js';
import {
  normalizeName,
  nameFromDisplay,
  sortAndDedupeNames,
  parseAlphaText
} from './names.js';
import { openSheet, closeSheet } from './nav.js';
import { setSetupAlphaList, getSetupAlphaList } from './setup.js';

let activeOCRWorker = null;
let ocrBusy = false;
let ocrCancelled = false;
let ocrNames = [];
let ocrSession = 0;

export function isOCRBusy() {
  return ocrBusy;
}

export function startOCR(file) {
  openOCRSheet();
  runOCR(file, ocrSession);
}

function openOCRSheet() {
  ocrSession += 1;
  ocrBusy = true;
  ocrCancelled = false;
  ocrNames = [];
  $('ocr-title').textContent = 'Reading image...';
  $('ocr-processing').hidden = false;
  $('ocr-progress').textContent = 'Loading OCR engine...';
  $('ocr-review').hidden = true;
  $('ocr-list').textContent = '';
  $('ocr-use').disabled = true;
  $('ocr-error').textContent = '';
  $('ocr-error').classList.remove('visible');
  openSheet('ocr', () => {
    const input = $('ocr-list').querySelector('input');
    if (input) input.focus();
  });
}

async function runOCR(file, session) {
  let worker = null;
  try {
    if (!window.Tesseract) throw new Error('Tesseract unavailable');
    const blob = await preprocessImageForOCR(file);
    if (ocrCancelled || session !== ocrSession) return;

    $('ocr-progress').textContent = 'Loading OCR engine...';
    // tesseract.js v4 API: createWorker(lang, oem, options).
    worker = await window.Tesseract.createWorker('eng', 1, {
      logger: message => updateOCRProgress(message)
    });
    if (ocrCancelled || session !== ocrSession) {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
      return;
    }
    activeOCRWorker = worker;

    const result = await worker.recognize(blob);
    if (ocrCancelled || session !== ocrSession) return;

    const text = (result && result.data && result.data.text) || '';

    ocrBusy = false;
    activeOCRWorker = null;
    try { await worker.terminate(); } catch (e) { /* ignore */ }

    applyOCRResults(text);
  } catch (error) {
    if (ocrCancelled || session !== ocrSession) return;
    ocrBusy = false;
    activeOCRWorker = null;
    if (worker) {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }
    showOCRError();
  }
}

function updateOCRProgress(message) {
  if (!message || typeof message !== 'object') return;
  const el = $('ocr-progress');
  if (!el) return;
  let label = '';
  const status = message.status || '';
  if (status === 'loading tesseract core') label = 'Loading OCR engine...';
  else if (status === 'initializing tesseract') label = 'Initializing...';
  else if (status === 'loading language traineddata') label = 'Loading language data...';
  else if (status === 'initializing api') label = 'Preparing...';
  else if (status === 'recognizing text') {
    const pct = Math.round((message.progress || 0) * 100);
    label = `Reading text... ${pct}%`;
  } else if (status) {
    label = status.charAt(0).toUpperCase() + status.slice(1) + '...';
  }
  if (label) el.textContent = label;
}

function applyOCRResults(text) {
  // First try the strict alpha-list parser.
  let parsed = parseAlphaText(text);
  // Fall back to a relaxed parse for messier OCR output.
  if (!parsed.length) {
    parsed = relaxedOCRParse(text);
  }
  ocrNames = parsed;
  if (!ocrNames.length) {
    showOCRError();
    return;
  }
  renderOCRReview();
}

// Relaxed parser: strip per-line numeric noise, normalize, accept anything
// that looks like at least two name tokens. Used only if the strict parser
// returns nothing.
function relaxedOCRParse(rawText) {
  const out = [];
  String(rawText || '')
    .split(/\r?\n/)
    .forEach(rawLine => {
      let line = String(rawLine || '')
        .replace(/[0-9]+/g, ' ')
        .replace(/[^A-Za-z'’\-. ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!line) return;
      const parts = line.split(' ').filter(p => p.length >= 2);
      if (parts.length < 2) return;
      const display = normalizeName(parts.slice(0, 4).join(' '));
      if (!display) return;
      out.push(nameFromDisplay(display));
    });
  return sortAndDedupeNames(out);
}

function showOCRError() {
  $('ocr-title').textContent = 'Reading failed';
  $('ocr-processing').hidden = true;
  $('ocr-review').hidden = true;
  const err = $('ocr-error');
  err.textContent = 'Could not read image. Try the paste option instead.';
  err.classList.add('visible');
}

function renderOCRReview() {
  $('ocr-title').textContent = `Found ${ocrNames.length} ${
    ocrNames.length === 1 ? 'name' : 'names'
  } — review & edit`;
  $('ocr-processing').hidden = true;
  $('ocr-review').hidden = false;
  renderOCRList();
}

function renderOCRList() {
  const list = $('ocr-list');
  list.textContent = '';
  ocrNames.forEach((nameObj, index) => {
    const row = document.createElement('div');
    row.className = 'ocr-row';

    const input = document.createElement('input');
    input.className = 'name-input';
    input.type = 'text';
    input.value = nameObj.display;
    input.setAttribute('aria-label', `OCR name ${index + 1}`);
    input.addEventListener('input', () => {
      ocrNames[index] = nameFromDisplay(input.value);
      updateOCRUseButton();
    });

    const remove = document.createElement('button');
    remove.className = 'small-btn red';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      ocrNames.splice(index, 1);
      renderOCRList();
    });

    row.append(input, remove);
    list.append(row);
  });
  updateOCRUseButton();
}

function updateOCRUseButton() {
  const usable = Array.from($('ocr-list').querySelectorAll('input'))
    .map(input => input.value.trim())
    .filter(Boolean);
  $('ocr-use').disabled = ocrBusy || usable.length < 1;
}

export function useOCRNames() {
  try {
    const values = Array.from($('ocr-list').querySelectorAll('input'))
      .map(input => input.value.trim())
      .filter(Boolean);
    const names = sortAndDedupeNames(
      values.map(value => nameFromDisplay(normalizeName(value))).filter(n => n.display)
    );
    if (!names.length) {
      updateOCRUseButton();
      return;
    }
    setSetupAlphaList(names);
    closeSheet();
    const total = getSetupAlphaList().length;
    showToast(`${total} ${total === 1 ? 'name' : 'names'} loaded`);
  } catch (error) {
    showToast('Could not use OCR names');
  }
}

function terminateOCRWorker(message) {
  ocrSession += 1;
  const worker = activeOCRWorker;
  activeOCRWorker = null;
  ocrBusy = false;
  if (worker) {
    worker.terminate()
      .then(() => { if (message) showToast(message); })
      .catch(() => showToast('OCR cleanup failed'));
  }
}

function resetOCRState() {
  activeOCRWorker = null;
  ocrBusy = false;
  ocrCancelled = false;
  ocrNames = [];
  $('ocr-list').textContent = '';
}

// Listen for sheet lifecycle to handle cancel + cleanup.
document.addEventListener('sheet:beforeclose', event => {
  if (event.detail.name !== 'ocr') return;
  if (ocrBusy) {
    ocrCancelled = true;
    terminateOCRWorker('OCR stopped');
  }
});

document.addEventListener('sheet:afterclose', event => {
  if (event.detail.name === 'ocr') resetOCRState();
});

// ---------- image preprocessing ----------

async function preprocessImageForOCR(file) {
  const sourceCanvas = await loadImageCanvas(file);
  const thresholdCanvas = adaptiveThresholdCanvas(sourceCanvas);
  const finalCanvas = upscaleCanvasIfNeeded(thresholdCanvas, 2550);
  return await new Promise((resolve, reject) => {
    finalCanvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, 'image/png');
  });
}

async function loadImageCanvas(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas;
    } catch (error) {
      showToast('Using alternate image reader');
    }
  }
  return await loadImageCanvasFallback(file);
}

function loadImageCanvasFallback(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    image.src = url;
  });
}

function adaptiveThresholdCanvas(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
  }
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= w; x += 1) {
      rowSum += gray[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
    }
  }
  const half = 16;
  for (let y = 0; y < h; y += 1) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x += 1) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(w - 1, x + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = rectSum(integral, w + 1, x1, y1, x2, y2);
      const avg = sum / area;
      const out = gray[y * w + x] < avg - 10 ? 0 : 255;
      const i = (y * w + x) * 4;
      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function rectSum(integral, stride, x1, y1, x2, y2) {
  const ax = x1;
  const ay = y1;
  const bx = x2 + 1;
  const by = y2 + 1;
  return (
    integral[by * stride + bx]
    - integral[ay * stride + bx]
    - integral[by * stride + ax]
    + integral[ay * stride + ax]
  );
}

function upscaleCanvasIfNeeded(canvas, targetWidth) {
  if (canvas.width >= targetWidth) return canvas;
  const scale = targetWidth / canvas.width;
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}
