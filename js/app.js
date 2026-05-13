// app.js — entry point: boot, wire DOM events, register service worker.

import { $, showToast } from './utils.js';
import { loadState } from './state.js';
import { push, pop, resetTo, closeSheet, getCurrentSheet } from './nav.js';
import { renderHome } from './home.js';
import {
  prepareSetup,
  createEvent,
  clearSetupAlphaList,
  updateStartButton,
  openPasteSheet,
  addPastedNames
} from './setup.js';
import {
  createNewGroup,
  renderSearchResults,
  handleSearchKeydown
} from './event.js';
import { startOCR, isOCRBusy, useOCRNames } from './ocr.js';
import { importFile } from './importers.js';
import { openExportScreen, copyExport, downloadExport } from './export.js';

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  prepareSetup();
  bindUI();
  renderHome();
  resetTo('s-home');
});

function bindUI() {
  // Home
  $('home-new').addEventListener('click', () => {
    prepareSetup();
    push('s-setup');
    setTimeout(() => $('event-name').focus(), 340);
  });

  // Setup
  $('setup-back').addEventListener('click', () => pop());
  $('event-name').addEventListener('input', updateStartButton);
  $('start-event-btn').addEventListener('click', createEvent);
  $('clear-alpha-btn').addEventListener('click', clearSetupAlphaList);
  $('take-photo-btn').addEventListener('click', () => $('camera-input').click());
  $('choose-photo-btn').addEventListener('click', () => $('photo-input').click());
  $('file-import-btn').addEventListener('click', () => $('file-input').click());
  $('paste-open-btn').addEventListener('click', openPasteSheet);
  $('camera-input').addEventListener('change', e => handleImageInput(e.target));
  $('photo-input').addEventListener('change', e => handleImageInput(e.target));
  $('file-input').addEventListener('change', e => handleFileInput(e.target));

  // Event
  $('event-back').addEventListener('click', () => {
    renderHome();
    pop();
  });
  $('event-export').addEventListener('click', openExportScreen);
  $('new-group-btn').addEventListener('click', createNewGroup);

  // Export
  $('export-back').addEventListener('click', () => pop());
  $('copy-export-btn').addEventListener('click', copyExport);
  $('download-export-btn').addEventListener('click', downloadExport);

  // Sheets
  $('sheet-overlay').addEventListener('click', () => {
    if (getCurrentSheet() === 'ocr' && isOCRBusy()) return;
    closeSheet();
  });
  $('search-done').addEventListener('click', closeSheet);
  $('person-search').addEventListener('input', renderSearchResults);
  $('person-search').addEventListener('keydown', handleSearchKeydown);
  $('paste-cancel').addEventListener('click', closeSheet);
  $('paste-add').addEventListener('click', addPastedNames);
  $('ocr-cancel').addEventListener('click', closeSheet);
  $('ocr-use').addEventListener('click', useOCRNames);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && getCurrentSheet()) {
      if (getCurrentSheet() === 'ocr' && isOCRBusy()) return;
      closeSheet();
    }
  });
}

function handleImageInput(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  startOCR(file);
}

function handleFileInput(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  importFile(file);
}

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch(() => {
        showToast('Offline setup could not be completed');
      });
  });
}
