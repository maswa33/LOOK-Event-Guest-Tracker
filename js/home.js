// home.js — home screen rendering.

import { $ } from './utils.js';
import { S, saveState, eventStats } from './state.js';
import { push } from './nav.js';
import { prepareSetup } from './setup.js';
import { renderEventScreen } from './event.js';

export function renderHome() {
  const list = $('home-list');
  if (!list) return;
  list.textContent = '';

  if (!S.events.length) {
    list.append(renderEmptyState());
    return;
  }

  const card = document.createElement('div');
  card.className = 'card';

  S.events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(event => {
      card.append(renderEventRow(event));
    });

  list.append(card);
}

function renderEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'card empty';

  const title = document.createElement('strong');
  title.textContent = 'No events yet';

  const copy = document.createElement('div');
  copy.textContent = 'Create an event to begin tracking photo groups.';

  const spacer = document.createElement('div');
  spacer.style.height = '16px';

  const btn = document.createElement('button');
  btn.className = 'primary-btn';
  btn.type = 'button';
  btn.textContent = 'New Event';
  btn.addEventListener('click', () => {
    prepareSetup();
    push('s-setup');
    setTimeout(() => $('event-name').focus(), 340);
  });

  empty.append(title, copy, spacer, btn);
  return empty;
}

function renderEventRow(event) {
  const stats = eventStats(event);
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'cell event-row';
  row.addEventListener('click', () => {
    S.activeId = event.id;
    saveState();
    renderEventScreen();
    push('s-event');
  });

  const main = document.createElement('div');
  main.className = 'event-row-main';

  const name = document.createElement('div');
  name.className = 'event-name';
  name.textContent = event.name;

  const date = document.createElement('div');
  date.className = 'event-date';
  date.textContent = event.date || '';

  main.append(name, date);

  const meta = document.createElement('div');
  meta.className = 'event-meta';
  meta.textContent = `${stats.groups} groups · ${stats.people} people · ${stats.walkins} walk-ins`;

  row.append(main, meta);
  return row;
}
