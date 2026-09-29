const DEFAULT_QUICKLINKS = [
  { key: 'digiforma', label: 'Émargement Digiforma', url: 'https://digiforma.net', primary: true },
  { key: 'discord', label: 'Discord de l’école', url: '', primary: false },
  { key: 'notion', label: 'Notion (mes notes)', url: '', primary: false },
  { key: 'drive', label: 'Google Drive', url: '', primary: false },
];

const SOURCES = ['Gamma', 'Lovable', 'Arc', 'Drive', 'Notion', 'Autre'];

const READ_ONLY = !['localhost', '127.0.0.1'].includes(location.hostname);

let liens = [];
let quicklinks = [];
let activeFilter = 'Tous';

function badgeClass(source) {
  return 'badge-' + (source || 'autre').toLowerCase();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function renderToday() {
  const label = document.getElementById('today-label');
  label.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

async function apiSave(file, data) {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, data }),
  });
  return res.json();
}

async function fetchJson(url, fallback) {
  try {
    const res = await fetch(url + '?t=' + Date.now());
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

async function loadLiens() {
  liens = await fetchJson('data/liens.json', []);
}

async function saveLiens() {
  await apiSave('liens', liens);
}

async function loadQuicklinks() {
  quicklinks = await fetchJson('data/config.json', DEFAULT_QUICKLINKS);
}

async function saveQuicklinkUrl(key, url) {
  quicklinks = quicklinks.map(q => q.key === key ? { ...q, url } : q);
  renderQuicklinks();
  await apiSave('config', quicklinks);
}

function renderQuicklinks() {
  const container = document.getElementById('quicklinks');
  container.innerHTML = '';
  quicklinks.forEach(ql => {
    const a = document.createElement('a');
    a.className = 'quicklink' + (ql.primary ? ' primary' : '');
    a.href = ql.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    if (!ql.url) a.addEventListener('click', (e) => e.preventDefault());

    const span = document.createElement('span');
    span.className = 'ql-label';
    span.textContent = ql.url ? ql.label : ql.label + ' (à renseigner)';
    a.appendChild(span);

    if (!READ_ONLY) {
      const editBtn = document.createElement('button');
      editBtn.className = 'ql-edit';
      editBtn.textContent = '✎';
      editBtn.title = 'Modifier le lien';
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = prompt('Lien pour "' + ql.label + '" :', ql.url || 'https://');
        if (next !== null) saveQuicklinkUrl(ql.key, next.trim());
      });
      a.appendChild(editBtn);
    }

    container.appendChild(a);
  });
}

function renderFilters() {
  const container = document.getElementById('filters');
  container.innerHTML = '';
  ['Tous', ...SOURCES].forEach(source => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (activeFilter === source ? ' active' : '');
    btn.textContent = source;
    btn.addEventListener('click', () => {
      activeFilter = source;
      renderFilters();
      renderGrid();
    });
    container.appendChild(btn);
  });
}

function renderGrid() {
  const grid = document.getElementById('liens-grid');
  const query = document.getElementById('search').value.trim().toLowerCase();
  grid.innerHTML = '';

  const filtered = liens.filter(l => {
    const matchesSource = activeFilter === 'Tous' || l.source === activeFilter;
    const matchesQuery = !query || l.titre.toLowerCase().includes(query) || (l.note || '').toLowerCase().includes(query);
    return matchesSource && matchesQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">Aucun cours ici pour l’instant.</div>';
    return;
  }

  filtered.forEach(l => {
    const card = document.createElement('div');
    card.className = 'lien-card';

    const badge = document.createElement('span');
    badge.className = 'badge ' + badgeClass(l.source);
    badge.textContent = l.source || 'Autre';
    card.appendChild(badge);

    const titre = document.createElement('div');
    titre.className = 'lien-titre';
    titre.textContent = l.titre;
    card.appendChild(titre);

    if (l.note) {
      const note = document.createElement('div');
      note.className = 'lien-note';
      note.textContent = l.note;
      card.appendChild(note);
    }

    const actions = document.createElement('div');
    actions.className = 'lien-actions';

    const open = document.createElement('a');
    open.className = 'btn btn-ghost';
    open.href = l.url;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Ouvrir ↗';
    actions.appendChild(open);

    if (!READ_ONLY) {
      const del = document.createElement('button');
      del.className = 'lien-delete';
      del.textContent = '✕';
      del.title = 'Supprimer';
      del.addEventListener('click', async () => {
        if (confirm('Supprimer "' + l.titre + '" ?')) {
          liens = liens.filter(x => x.id !== l.id);
          renderGrid();
          await saveLiens();
        }
      });
      actions.appendChild(del);
    }

    card.appendChild(actions);
    grid.appendChild(card);
  });
}

function setupAddForm() {
  const toggleBtn = document.getElementById('add-toggle');
  const form = document.getElementById('add-form');
  const cancelBtn = document.getElementById('add-cancel');

  toggleBtn.addEventListener('click', () => form.classList.toggle('hidden'));
  cancelBtn.addEventListener('click', () => form.classList.add('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titre = document.getElementById('f-titre').value.trim();
    const url = document.getElementById('f-url').value.trim();
    const source = document.getElementById('f-source').value;
    const note = document.getElementById('f-note').value.trim();
    if (!titre || !url) return;

    liens.unshift({ id: 'l-' + Date.now(), titre, url, source, note });
    form.reset();
    form.classList.add('hidden');
    renderGrid();
    await saveLiens();
  });
}

function setupSearch() {
  document.getElementById('search').addEventListener('input', renderGrid);
}

async function setupSupportDuJour() {
  const input = document.getElementById('support-input');
  const openLink = document.getElementById('support-open');
  const saveBtn = document.getElementById('support-save');

  const data = await fetchJson('data/support.json', { date: '', url: '' });

  if (data && data.date === todayKey()) {
    input.value = data.url;
    openLink.href = data.url;
  } else {
    openLink.href = '#';
  }

  saveBtn.addEventListener('click', async () => {
    const url = input.value.trim();
    if (!url) return;
    openLink.href = url;
    await apiSave('support', { date: todayKey(), url });
  });
}

function setStatus(message, isError) {
  const el = document.getElementById('sync-status');
  el.textContent = message;
  el.style.color = isError ? '#c0392b' : '';
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => { el.textContent = ''; }, 5000);
}

function setupSync() {
  document.getElementById('sync-pull').addEventListener('click', async () => {
    setStatus('Récupération…', false);
    try {
      const res = await fetch('/api/git-pull', { method: 'POST' });
      const json = await res.json();
      setStatus(json.message, !json.ok);
      if (json.ok) {
        await loadQuicklinks();
        renderQuicklinks();
        await loadLiens();
        renderGrid();
      }
    } catch (e) {
      setStatus('Le serveur local n’est pas joignable.', true);
    }
  });

  document.getElementById('sync-push').addEventListener('click', async () => {
    setStatus('Publication…', false);
    try {
      const res = await fetch('/api/git-push', { method: 'POST' });
      const json = await res.json();
      setStatus(json.message, !json.ok);
    } catch (e) {
      setStatus('Le serveur local n’est pas joignable.', true);
    }
  });
}

async function init() {
  if (READ_ONLY) document.body.classList.add('read-only');
  renderToday();
  await loadQuicklinks();
  renderQuicklinks();
  await loadLiens();
  renderFilters();
  renderGrid();
  setupAddForm();
  setupSearch();
  await setupSupportDuJour();
  setupSync();
}

init();
