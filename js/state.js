// state.js — persistent app state and accessors.

import { showToast } from './utils.js';

export const STORE_KEY = 'look_v3';

// Mutable singleton. Other modules import S and mutate via setters / helpers.
export const S = {
  events: [],
  activeId: null
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      S.events = [];
      S.activeId = null;
      return;
    }
    const parsed = JSON.parse(raw);
    S.events = Array.isArray(parsed.events) ? parsed.events : [];
    S.activeId = parsed.activeId || null;
  } catch (error) {
    S.events = [];
    S.activeId = null;
    showToast('Could not read saved data. Starting fresh.');
  }
}

export function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch (error) {
    showToast('Storage warning: changes may not be saved.', { persistent: true });
  }
}

export function currentEvent() {
  return S.events.find(event => event.id === S.activeId) || null;
}

export function touchEvent(event) {
  event.updatedAt = Date.now();
  saveState();
}

export function eventStats(event) {
  const groups = Array.isArray(event.groups) ? event.groups : [];
  const people = groups.reduce((sum, group) => sum + group.people.length, 0);
  const walkins = groups.reduce(
    (sum, group) => sum + group.people.filter(person => person.walkin).length,
    0
  );
  return {
    groups: groups.length,
    people,
    walkins,
    onList: Array.isArray(event.alphaList) ? event.alphaList.length : 0
  };
}
