const LS_LIENS = 'bahut_liens_v1';
const LS_QUICKLINKS = 'bahut_quicklinks_v1';
const LS_SUPPORT = 'bahut_support_v1';
const SEED_URL = 'data/liens.json';

const DEFAULT_QUICKLINKS = [
  { key: 'digiforma', label: 'Émargement Digiforma', url: 'https://digiforma.net', primary: true },
  { key: 'discord', label: 'Discord de l’école', url: '', primary: false },
  { key: 'notion', label: 'Notion (mes notes)', url: '', primary: false },
  { key: 'drive', label: 'Google Drive', url: '', primary: false },
];

const SOURCES = ['Gamma', 'Lovable', 'Arc', 'Drive', 'Notion', 'Autre'];

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

async function loadLiens() {
  const stored = localStorage.getItem(LS_LIENS);
  if (stored) {
    liens = JSON.parse(stored);
    return;
  }
  try {
    const res = await fetch(SEED_URL);
    liens = await res.json();
  } catch (e) {
    liens = [];
  }
  saveLiens();
}

function saveLiens() {
  localStorage.setItem(LS_LIENS, JSON.stringify(liens));
}

function loadQuicklinks() {
  const stored = localStorage.getItem(LS_QUICKLINKS);
  const overrides = stored ? JSON.parse(stored) : {};
  quicklinks = DEFAULT_QUICKLINKS.map(d => ({ ...d, url: overrides[d.key] ?? d.url }));
}

function saveQuicklinkOverride(key, url) {
  const stored = localStorage.getItem(LS_QUICKLINKS);
  const overrides = stored ? JSON.parse(stored) : {};
  overrides[key] = url;
  localStorage.setItem(LS_QUICKLINKS, JSON.stringify(overrides));
  loadQuicklinks();
  renderQuicklinks();
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

    const editBtn = document.createElement('button');
    editBtn.className = 'ql-edit';
    editBtn.textContent = '✎';
    editBtn.title = 'Modifier le lien';
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = prompt('Lien pour "' + ql.label + '" :', ql.url || 'https://');
      if (next !== null) saveQuicklinkOverride(ql.key, next.trim());
    });
    a.appendChild(editBtn);

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

    const del = document.createElement('button');
    del.className = 'lien-delete';
    del.textContent = '✕';
    del.title = 'Supprimer';
    del.addEventListener('click', () => {
      if (confirm('Supprimer "' + l.titre + '" ?')) {
        liens = liens.filter(x => x.id !== l.id);
        saveLiens();
        renderGrid();
      }
    });
    actions.appendChild(del);

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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titre = document.getElementById('f-titre').value.trim();
    const url = document.getElementById('f-url').value.trim();
    const source = document.getElementById('f-source').value;
    const note = document.getElementById('f-note').value.trim();
    if (!titre || !url) return;

    liens.unshift({ id: 'l-' + Date.now(), titre, url, source, note });
    saveLiens();
    form.reset();
    form.classList.add('hidden');
    renderGrid();
  });
}

function setupSearch() {
  document.getElementById('search').addEventListener('input', renderGrid);
}

function setupSupportDuJour() {
  const input = document.getElementById('support-input');
  const openLink = document.getElementById('support-open');
  const saveBtn = document.getElementById('support-save');

  const stored = localStorage.getItem(LS_SUPPORT);
  const data = stored ? JSON.parse(stored) : null;

  if (data && data.date === todayKey()) {
    input.value = data.url;
    openLink.href = data.url;
  } else {
    openLink.href = '#';
  }

  saveBtn.addEventListener('click', () => {
    const url = input.value.trim();
    if (!url) return;
    localStorage.setItem(LS_SUPPORT, JSON.stringify({ date: todayKey(), url }));
    openLink.href = url;
  });
}

async function init() {
  renderToday();
  loadQuicklinks();
  renderQuicklinks();
  await loadLiens();
  renderFilters();
  renderGrid();
  setupAddForm();
  setupSearch();
  setupSupportDuJour();
}

init();
