// event.js — event screen (groups, people) + add-to-group search sheet.

import { $, uid, showToast } from './utils.js';
import {
  normalizeName,
  initials,
  cleanQuery,
  scoreAlphaEntry,
  findAlphaMatch
} from './names.js';
import { currentEvent, touchEvent, eventStats } from './state.js';
import { push, openSheet, closeSheet, getCurrentSheet } from './nav.js';

// Inline edit / pending confirm state — local to this module.
let pendingGroupDeleteId = null;
let pendingPersonRemoveId = null;
let editingGroupId = null;
let editingPersonId = null;
let editOriginalName = '';

// Active group target for the search sheet.
let searchGroupId = null;

// ---------- event screen ----------

export function renderEventScreen() {
  const event = currentEvent();
  if (!event) return;
  $('event-title').textContent = event.name;
  const stats = eventStats(event);
  $('stat-groups').textContent = stats.groups;
  $('stat-people').textContent = stats.people;
  $('stat-walkins').textContent = stats.walkins;
  $('stat-onlist').textContent = stats.onList;

  const container = $('groups-container');
  container.textContent = '';

  if (!event.groups.length) {
    const empty = document.createElement('div');
    empty.className = 'card empty';
    const title = document.createElement('strong');
    title.textContent = 'No photo groups yet';
    const copy = document.createElement('div');
    copy.textContent = 'Tap New Photo Group when the first group is photographed.';
    empty.append(title, copy);
    container.append(empty);
    return;
  }

  event.groups.forEach((group, index) =>
    container.append(renderGroupCard(event, group, index))
  );
}

function renderGroupCard(event, group, groupIndex) {
  const card = document.createElement('article');
  card.className = 'group-card';
  card.id = `group-${group.id}`;

  const head = document.createElement('div');
  head.className = 'group-head';

  const number = document.createElement('div');
  number.className = 'number-circle';
  number.textContent = group.number;

  const reorder = document.createElement('div');
  reorder.className = 'reorder-controls';

  const moveUp = document.createElement('button');
  moveUp.className = 'reorder-btn';
  moveUp.type = 'button';
  moveUp.textContent = '▲';
  moveUp.setAttribute(
    'aria-label',
    `Move ${group.label || `Photo Group ${group.number}`} up`
  );
  moveUp.disabled = groupIndex === 0;
  moveUp.addEventListener('click', () => moveGroup(event, group.id, -1));

  const moveDown = document.createElement('button');
  moveDown.className = 'reorder-btn';
  moveDown.type = 'button';
  moveDown.textContent = '▼';
  moveDown.setAttribute(
    'aria-label',
    `Move ${group.label || `Photo Group ${group.number}`} down`
  );
  moveDown.disabled = groupIndex === event.groups.length - 1;
  moveDown.addEventListener('click', () => moveGroup(event, group.id, 1));

  reorder.append(moveUp, moveDown);

  const label = document.createElement('input');
  label.className = 'group-label';
  label.type = 'text';
  label.value = group.label || `Photo Group ${group.number}`;
  label.setAttribute('aria-label', `Label for photo group ${group.number}`);
  label.addEventListener('keydown', keyEvent => {
    if (keyEvent.key === 'Enter') label.blur();
  });
  label.addEventListener('blur', () => {
    const nextLabel = label.value.trim() || `Photo Group ${group.number}`;
    if (nextLabel !== group.label) {
      group.label = nextLabel;
      touchEvent(event);
      if (searchGroupId === group.id) renderSearchSheet();
    }
    label.value = group.label;
  });

  const deleteWrap = document.createElement('div');
  if (pendingGroupDeleteId === group.id) {
    deleteWrap.className = 'confirm-actions';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'small-btn red';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Confirm delete';
    confirmBtn.addEventListener('click', () => {
      event.groups = event.groups.filter(item => item.id !== group.id);
      pendingGroupDeleteId = null;
      if (searchGroupId === group.id) closeSheet();
      touchEvent(event);
      renderEventScreen();
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'small-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      pendingGroupDeleteId = null;
      renderEventScreen();
    });
    deleteWrap.append(confirmBtn, cancelBtn);
  } else {
    const del = document.createElement('button');
    del.className = 'small-btn red';
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      pendingGroupDeleteId = group.id;
      pendingPersonRemoveId = null;
      renderEventScreen();
    });
    deleteWrap.append(del);
  }

  head.append(number, reorder, label, deleteWrap);
  card.append(head);

  const people = document.createElement('div');
  people.className = 'people';
  if (!group.people.length) {
    const empty = document.createElement('div');
    empty.className = 'cell muted';
    empty.textContent = 'No people added yet';
    people.append(empty);
  } else {
    group.people.forEach((person, index) =>
      people.append(renderPersonRow(event, group, person, index))
    );
  }
  card.append(people);

  const foot = document.createElement('div');
  foot.className = 'group-foot';
  const add = document.createElement('button');
  add.className = 'add-person-btn';
  add.type = 'button';
  add.textContent = 'Add Person';
  add.addEventListener('click', () => openSearchSheet(group.id));
  foot.append(add);
  card.append(foot);

  return card;
}

function moveGroup(event, groupId, direction) {
  const index = event.groups.findIndex(group => group.id === groupId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= event.groups.length) return;
  [event.groups[index], event.groups[nextIndex]] = [
    event.groups[nextIndex],
    event.groups[index]
  ];
  pendingGroupDeleteId = null;
  pendingPersonRemoveId = null;
  touchEvent(event);
  renderEventScreen();
}

function renderPersonRow(event, group, person, index) {
  const row = document.createElement('div');
  row.className = 'person-row';

  const avatar = document.createElement('div');
  avatar.className = `avatar alt-${index % 5}`;
  avatar.textContent = initials(person.name);

  const main = document.createElement('div');
  main.className = 'person-main';

  if (editingGroupId === group.id && editingPersonId === person.id) {
    const input = document.createElement('input');
    input.className = 'inline-edit';
    input.type = 'text';
    input.value = person.name;
    input.setAttribute('aria-label', `Edit ${person.name}`);
    input.addEventListener('keydown', keyEvent => {
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault();
        commitPersonEdit(event, group, person, input.value);
      }
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault();
        person.name = editOriginalName;
        editingGroupId = null;
        editingPersonId = null;
        editOriginalName = '';
        renderEventScreen();
      }
    });
    input.addEventListener('blur', () => {
      commitPersonEdit(event, group, person, input.value);
    });
    main.append(input);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  } else {
    const line = document.createElement('div');
    line.className = 'person-name-line';
    const name = document.createElement('div');
    name.className = 'person-name';
    name.textContent = person.name;
    line.append(name);
    if (person.walkin) {
      const badge = document.createElement('span');
      badge.className = 'walkin-badge';
      badge.textContent = 'walk-in';
      line.append(badge);
    }
    main.append(line);
  }

  const actions = document.createElement('div');
  actions.className = 'person-actions';

  if (pendingPersonRemoveId === `${group.id}:${person.id}`) {
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'small-btn red';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Confirm remove';
    confirmBtn.addEventListener('click', () => {
      group.people = group.people.filter(item => item.id !== person.id);
      pendingPersonRemoveId = null;
      touchEvent(event);
      renderEventScreen();
      if (getCurrentSheet() === 'search') renderSearchResults();
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'small-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      pendingPersonRemoveId = null;
      renderEventScreen();
    });
    actions.append(confirmBtn, cancelBtn);
  } else {
    const edit = document.createElement('button');
    edit.className = 'small-btn';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      editingGroupId = group.id;
      editingPersonId = person.id;
      editOriginalName = person.name;
      renderEventScreen();
    });
    const remove = document.createElement('button');
    remove.className = 'small-btn red';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      pendingPersonRemoveId = `${group.id}:${person.id}`;
      pendingGroupDeleteId = null;
      renderEventScreen();
    });
    actions.append(edit, remove);
  }

  row.append(avatar, main, actions);
  return row;
}

function commitPersonEdit(event, group, person, value) {
  if (editingGroupId !== group.id || editingPersonId !== person.id) return;
  const normalized = normalizeName(value);
  if (!normalized) {
    person.name = editOriginalName;
  } else {
    person.name = normalized;
    if (findAlphaMatch(normalized, event.alphaList)) {
      person.walkin = false;
      person.note = '';
    }
  }
  editingGroupId = null;
  editingPersonId = null;
  editOriginalName = '';
  touchEvent(event);
  renderEventScreen();
}

export function createNewGroup() {
  const event = currentEvent();
  if (!event) return;
  const next = event.groups.reduce((max, group) => Math.max(max, group.number), 0) + 1;
  const group = {
    id: uid(),
    number: next,
    label: `Photo Group ${next}`,
    people: []
  };
  event.groups.push(group);
  touchEvent(event);
  renderEventScreen();
}

// ---------- add-to-group search sheet ----------

export function openSearchSheet(groupId) {
  searchGroupId = groupId;
  $('person-search').value = '';
  renderSearchSheet();
  openSheet('search', () => $('person-search').focus());
}

function renderSearchSheet() {
  const event = currentEvent();
  const group = event ? event.groups.find(item => item.id === searchGroupId) : null;
  $('search-title').textContent = group ? `Add to ${group.label}` : 'Add to Group';
  renderSearchResults();
}

export function renderSearchResults() {
  const event = currentEvent();
  const group = event ? event.groups.find(item => item.id === searchGroupId) : null;
  const container = $('search-results');
  const query = cleanQuery($('person-search').value);
  container.textContent = '';
  if (!event || !group) return;

  const results = getSearchResults(query, event.alphaList, group);

  results.forEach(result => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `result-row ${result.already ? '' : 'can-add'}`;
    if (result.already) {
      row.setAttribute('aria-disabled', 'true');
    } else {
      row.addEventListener('click', () =>
        addPersonToGroup(group.id, result.entry.display, false, '')
      );
    }

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = initials(result.entry.display);

    const main = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'result-name';
    name.textContent = result.entry.display;
    const sub = document.createElement('div');
    sub.className = 'result-sub';
    sub.textContent = 'Alpha list';
    main.append(name, sub);

    const action = document.createElement('div');
    if (result.already) {
      action.className = 'in-group';
      action.textContent = 'In group';
    } else {
      const plus = document.createElement('span');
      plus.className = 'plus-btn';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      action.append(plus);
    }

    row.append(avatar, main, action);
    container.append(row);
  });

  if (query) {
    const walkin = document.createElement('button');
    walkin.type = 'button';
    walkin.className = 'walkin-row';
    walkin.addEventListener('click', () =>
      addPersonToGroup(group.id, query, true, 'Not on Alpha List')
    );

    const avatar = document.createElement('div');
    avatar.className = 'avatar alt-3';
    avatar.textContent = initials(query);

    const main = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'result-name';
    name.textContent = `Add “${query}” as walk-in`;
    const sub = document.createElement('div');
    sub.className = 'result-sub';
    sub.textContent = 'not on alpha list';
    main.append(name, sub);

    const plus = document.createElement('span');
    plus.className = 'plus-btn';
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';

    walkin.append(avatar, main, plus);
    container.append(walkin);
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Start typing a guest name.';
    container.append(empty);
  }
}

export function handleSearchKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const activeEvent = currentEvent();
  const group = activeEvent
    ? activeEvent.groups.find(item => item.id === searchGroupId)
    : null;
  const query = cleanQuery($('person-search').value);
  if (!activeEvent || !group || !query) return;
  const results = getSearchResults(query, activeEvent.alphaList, group);
  const strong = results.filter(result => result.score >= 90);
  if (strong.length === 1 && !strong[0].already) {
    addPersonToGroup(group.id, strong[0].entry.display, false, '');
    return;
  }
  if (strong.length === 0) {
    addPersonToGroup(group.id, query, true, 'Not on Alpha List');
  }
}

function addPersonToGroup(groupId, rawName, walkin, note) {
  const event = currentEvent();
  const group = event ? event.groups.find(item => item.id === groupId) : null;
  const name = normalizeName(rawName);
  if (!event || !group || !name) return;
  const exists = group.people.some(
    person => person.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    showToast('Already in group');
    $('person-search').value = '';
    renderSearchResults();
    setTimeout(() => $('person-search').focus(), 0);
    return;
  }
  group.people.push({
    id: uid(),
    name,
    walkin,
    note: walkin ? 'Not on Alpha List' : note,
    addedAt: Date.now()
  });
  touchEvent(event);
  renderEventScreen();
  renderSearchResults();
  showToast(`${name} added`);
  $('person-search').value = '';
  renderSearchResults();
  setTimeout(() => $('person-search').focus(), 0);
}

function getSearchResults(query, alphaList, group) {
  if (!query) return [];
  return alphaList
    .map(entry => {
      const score = scoreAlphaEntry(query, entry);
      const already = group.people.some(
        person => person.name.toLowerCase() === entry.display.toLowerCase()
      );
      return { entry, score, already };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const last = a.entry.last.localeCompare(b.entry.last, undefined, {
        sensitivity: 'base'
      });
      if (last !== 0) return last;
      return a.entry.first.localeCompare(b.entry.first, undefined, {
        sensitivity: 'base'
      });
    })
    .slice(0, 25);
}

// Reset search state when the sheet finishes closing.
document.addEventListener('sheet:afterclose', event => {
  if (event.detail.name === 'search') {
    searchGroupId = null;
    const input = $('person-search');
    if (input) input.value = '';
  }
});
