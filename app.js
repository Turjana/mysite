'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateKey = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
};
const today = () => dateKey(new Date());
const fromDate = value => new Date(`${value}T12:00:00`);
const formatDate = value => fromDate(value).toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'});
const OWNER_EMAIL = '369turush@gmail.com';
const isOwner = account => normalizeEmail(account?.email) === OWNER_EMAIL;
const LEGACY_STORAGE = 'sphere-v2';
const ACCOUNTS_KEY = 'sphere-accounts';
const SESSION_KEY = 'sphere-session';
const ACCOUNT_PREFIX = 'sphere-state:';
// Общая облачная база. anon key — публичный ключ клиента, доступ к таблицам закрыт RLS.
const SUPABASE_URL = 'https://kfowalcxzrtzpucxeqon.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb3dhbGN4enJ0enB1Y3hlcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTg2NzksImV4cCI6MjEwODg3NDY3OX0.rl8DxiWv4e6vlpOIOQknqj9yKTVniWXp8pZ1WFwfOlU';
const CLOUD_ENABLED = /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const priorityLabels = {urgent:'Срочный',medium:'Средний',low:'Не срочный'};
const priorityRank = {urgent:0,medium:1,low:2};
const normalizePriority = value => ({blue:'low',orange:'medium',purple:'urgent'}[value] || (priorityLabels[value] ? value : 'medium'));
const emptyState = () => ({version:3,tasks:[],goals:[],playlists:[],tracks:[],profile:{name:'',alias:'',photo:'',photoX:50,photoY:50,photoScale:1,layout:'card',video:'',videoDuration:0,ownerPrefix:'Владелец',status:'✦ В своём ритме'},habits:[{id:uid(),name:'Утренняя зарядка',days:[]},{id:uid(),name:'Читать 20 минут',days:[]}],note:'',theme:'dark',settings:{sound:false,focus:false,morning:false},weather:{city:'Москва',lat:55.7558,lon:37.6173,timezone:'Europe/Moscow',temp:null,code:null,desc:'',updated:0},newsSources:[],newsFeed:[],newsCustom:[],sessions:0});
const readStore = (key, fallback = null) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
function normalizeState(raw) {
  const base = emptyState(), source = raw && typeof raw === 'object' ? raw : {};
  const next = {...base, ...source};
  next.profile = {...base.profile, ...(source.profile || {})};
  if (!(source.profile && source.profile.photoX != null)) {
    const area = {top:[50,20],bottom:[50,80],left:[20,50],right:[80,50]}[source.profile?.photoArea] || [50,50];
    next.profile.photoX = area[0]; next.profile.photoY = area[1];
  }
  next.profile.photoX = Math.min(100, Math.max(0, +next.profile.photoX || 50));
  next.profile.photoY = Math.min(100, Math.max(0, +next.profile.photoY || 50));
  next.profile.photoScale = Math.min(2.5, Math.max(1, +next.profile.photoScale || 1));
  if (!['card','row'].includes(next.profile.layout)) next.profile.layout = 'card';
  next.weather = {...base.weather, ...(source.weather || {})};
  next.settings = {...base.settings, ...(source.settings || {})};
  next.newsSources = Array.isArray(source.newsSources) ? source.newsSources : [];
  next.newsFeed = Array.isArray(source.newsFeed) ? source.newsFeed : [];
  next.newsCustom = Array.isArray(source.newsCustom) ? source.newsCustom : [];
  next.goals = Array.isArray(source.goals) ? source.goals : [];
  next.tasks = (Array.isArray(source.tasks) ? source.tasks : []).map(task => ({...task, priority:normalizePriority(task?.priority)}));
  next.tracks = Array.isArray(source.tracks) ? source.tracks : [];
  next.playlists = Array.isArray(source.playlists) ? source.playlists : [];
  next.habits = Array.isArray(source.habits) ? source.habits : base.habits;
  next.sessions = +source.sessions || 0;
  return next;
}
let accounts = readStore(ACCOUNTS_KEY, []);
if (!Array.isArray(accounts)) accounts = [];
let sessionId = localStorage.getItem(SESSION_KEY) || '';
let currentAccount = accounts.find(account => account?.id === sessionId) || null;
let STORAGE = currentAccount ? ACCOUNT_PREFIX + currentAccount.id : LEGACY_STORAGE;
let state = normalizeState(readStore(STORAGE, null) || emptyState());
const firstAccountSeed = !currentAccount && accounts.length === 0 ? JSON.parse(JSON.stringify(state)) : null;

// Локальная админ-база: карточки пользователей, предупреждения и журнал действий.
const ADMIN_DB_KEY = 'sphere-admin-db';
const ADMIN_LOG_LIMIT = 600;
const emptyAdminDb = () => ({version:1, users:{}, events:[]});
function readAdminDb() {
  const raw = readStore(ADMIN_DB_KEY, null);
  if (!raw || typeof raw !== 'object') return emptyAdminDb();
  const db = emptyAdminDb();
  db.users = raw.users && typeof raw.users === 'object' ? raw.users : {};
  db.events = Array.isArray(raw.events) ? raw.events : [];
  for (const [id, record] of Object.entries(db.users)) {
    if (!record || typeof record !== 'object') { db.users[id] = {warnings:[],lastSeen:0}; continue; }
    record.warnings = Array.isArray(record.warnings) ? record.warnings : [];
    record.lastSeen = +record.lastSeen || 0;
  }
  return db;
}
let adminDb = readAdminDb();
function saveAdminDb() {
  try { localStorage.setItem(ADMIN_DB_KEY, JSON.stringify(adminDb)); } catch {}
}
function adminUserRecord(id) {
  if (!adminDb.users[id] || typeof adminDb.users[id] !== 'object') adminDb.users[id] = {warnings:[],lastSeen:0};
  if (!Array.isArray(adminDb.users[id].warnings)) adminDb.users[id].warnings = [];
  return adminDb.users[id];
}
function syncAdminDb() {
  let changed = false;
  for (const account of accounts) {
    if (!account?.id) continue;
    const record = adminUserRecord(account.id);
    if (!record.createdAt && account.created) { record.createdAt = account.created; changed = true; }
  }
  for (const id of Object.keys(adminDb.users)) {
    if (!accounts.some(account => account?.id === id)) { delete adminDb.users[id]; changed = true; }
  }
  if (changed) saveAdminDb();
}
function logAction(action, details = '', targetId = '') {
  try {
    const actor = currentAccount ? {
      id: currentAccount.id,
      name: currentAccount.name || currentAccount.alias || currentAccount.email,
      alias: currentAccount.alias || '',
      email: currentAccount.email || ''
    } : {id:'',name:'Гость',alias:'',email:''};
    adminDb.events.unshift({id:uid(), at:Date.now(), action, details, targetId, actor});
    if (adminDb.events.length > ADMIN_LOG_LIMIT) adminDb.events.length = ADMIN_LOG_LIMIT;
    saveAdminDb();
    if (cloudSessionActive()) {
      const eventAccount = currentAccount;
      cloudRpc('sphere_event_add', {
        p_id: eventAccount.id,
        p_token: eventAccount.token,
        p_action: action,
        p_details: details,
        p_target: targetId ? String(targetId) : ''
      }).then(() => {
        if (activeView === 'admin' && isOwner(currentAccount)) refreshAdminData();
      }).catch(() => {});
    }
    if (activeView === 'admin' && isOwner(currentAccount)) renderAdmin();
  } catch {}
}
function unreadWarnings(accountId) {
  return adminUserRecord(accountId).warnings.filter(warning => !warning.read);
}

// --- Облако Supabase -------------------------------------------------------
const cloudErrorMessages = {
  invalid_credentials: 'Неверный пароль.',
  invalid_password: 'Неверный текущий пароль.',
  invalid_hash: 'Ошибка подготовки пароля. Обновите страницу и попробуйте снова.',
  account_not_found: 'Аккаунт с таким email не найден.',
  invalid_recovery: 'Неверный код восстановления.',
  email_taken: 'Аккаунт с таким email уже существует.',
  alias_taken: 'Такой псевдоним уже занят.',
  alias_invalid: 'Псевдоним должен быть от 3 до 32 символов без пробелов.',
  email_invalid: 'Введите корректный email.',
  invalid_session: 'Сессия устарела. Войдите заново.',
  forbidden: 'Недостаточно прав.',
  target_not_found: 'Профиль не найден.',
  owner_protected: 'Аккаунт владельца удалить нельзя.',
  warning_empty: 'Введите текст предупреждения.'
};
function cloudErrorText(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return cloudErrorMessages[key] || (key.includes('failed to fetch') ? 'Нет связи с облаком. Проверьте интернет.' : String(raw || 'Ошибка облака.'));
}
function explainMissingCloudFunction(error) {
  const message = String(error?.message || '');
  if (message.includes('Could not find the function') || message.includes('function public.')) {
    return new Error('Эта функция ещё не установлена в Supabase. Выполните обновлённый supabase-schema.sql в SQL Editor.');
  }
  return error;
}
async function cloudRpc(name, payload = {}) {
  if (!CLOUD_ENABLED) throw new Error('Облако не настроено.');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    const error = new Error('Нет связи с облаком. Проверьте интернет.');
    error.cloudUnavailable = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const raw = data && typeof data === 'object' ? (data.message || data.error_description || data.msg) : text;
    const error = new Error(cloudErrorText(raw || `HTTP ${response.status}`));
    error.code = String(raw || '');
    error.cloudUnavailable = response.status >= 500;
    throw error;
  }
  return data;
}
function cloudSessionActive() {
  return CLOUD_ENABLED && !!currentAccount && !!currentAccount.token;
}
function cacheCloudAccount(account) {
  if (!account?.id) return;
  const index = accounts.findIndex(item => item?.id === account.id);
  if (index >= 0) accounts[index] = {...accounts[index], ...account};
  else accounts.push(account);
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch {}
}
function findLocalAccount(identifier) {
  return accounts.find(item => normalizeEmail(item.email) === normalizeEmail(identifier) || normalizeAlias(item.alias) === normalizeAlias(identifier));
}
let cloudSaveTimer = 0, cloudSaving = false, cloudSaveQueued = false, cloudWarnedAt = 0, cloudOfflineNotified = false;
function scheduleCloudSave(delay = 500) {
  if (!cloudSessionActive()) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudNow, delay);
}
async function saveCloudNow() {
  if (!cloudSessionActive()) return;
  if (cloudSaving) { cloudSaveQueued = true; return; }
  clearTimeout(cloudSaveTimer); cloudSaveTimer = 0;
  cloudSaving = true;
  try {
    await cloudRpc('sphere_state_save', {
      p_id: currentAccount.id,
      p_token: currentAccount.token,
      p_data: JSON.parse(JSON.stringify(state))
    });
  } catch (error) {
    if (String(error.code || '').toLowerCase() === 'invalid_session') {
      currentAccount = null;
      localStorage.removeItem(SESSION_KEY);
      showAuth('login');
      toast('Сессия больше не действует. Войдите заново.', true);
      return;
    }
    if (Date.now() - cloudWarnedAt > 15000) {
      cloudWarnedAt = Date.now();
      toast('Облако недоступно. Изменения сохранены локально и отправятся позже.', true);
    }
  } finally {
    cloudSaving = false;
    if (cloudSaveQueued) { cloudSaveQueued = false; scheduleCloudSave(80); }
  }
}
async function migrateLocalAccount(account) {
  const localState = normalizeState(readStore(accountKey(account), null) || emptyState());
  const token = randomHex(32);
  const result = await cloudRpc('sphere_register', {
    p_id: account.id,
    p_name: account.name || account.alias || account.email,
    p_alias: account.alias,
    p_email: account.email,
    p_salt: account.salt,
    p_hash: account.passHash,
    p_recovery_hash: account.recoveryHash || null,
    p_token: token,
    p_state: localState
  });
  const migrated = {...account, id:result.id, name:result.name, alias:result.alias, email:result.email,
    created:+result.created || account.created, token:result.token || token};
  cacheCloudAccount(migrated);
  return migrated;
}
function applyCloudState(raw) {
  const source = raw && typeof raw === 'object' && Object.keys(raw).length ? raw : null;
  return source ? normalizeState(source) : null;
}

// Each account gets its own state key. Legacy data is adopted by the first registered account.
function persist() {
  if (!currentAccount) return false;
  let localSaved = true;
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  catch { localSaved = false; toast('Не удалось сохранить локально: хранилище браузера заполнено.', true); }
  scheduleCloudSave();
  return localSaved;
}
function toast(text, error = false) {
  const el = $('#toast'); $('strong', el).textContent = error ? 'Внимание' : 'Сфера';
  $('small', el).textContent = text; el.classList.add('show');
  clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('show'), 4000);
}
let selectedDate = today(), calendarMonth = new Date().getMonth(), calendarYear = new Date().getFullYear();
let taskFilter = 'all', taskSort = 'manual', musicSort = 'new', selectedPlaylist = '', currentTrack = '';
let draggedTaskId = '';
let activeView = 'overview', clockDate = today();
let newsFilter = 'Все', newsSource = 'Все';
const statuses = {0:'Не начато',50:'Наполовину',100:'Выполнено'};
const hits = {'':'Без метки',day:'Хит дня',week:'Хит недели',month:'Хит месяца',year:'Хит года'};
const newsCategories=['Все','Продуктивность','Психология','Креативность','Маркетинг','Веб разработка','Дизайн','Хакинг','Новости IT','Другое'];
const newsItems=[
  {category:'Психология',title:'Как создавать пространство для больших идей',description:'О внимании, паузах и маленьких ритуалах, которые помогают думать глубже и действовать смелее.',source:'Сфера',url:'https://psyche.co/'},
  {category:'Продуктивность',title:'Метод двух минут: начни с малого',description:'Почему самое сложное — просто начать и убрать первый барьер.',source:'Сфера',url:'https://todoist.com/productivity-methods'},
  {category:'Креативность',title:'Твои лучшие идеи любят прогулки',description:'Немного науки о движении и мышлении.',source:'Сфера',url:'https://www.brainpickings.org/'},
  {category:'Веб разработка',title:'Практики современного веба',description:'Инструменты и подходы для быстрых, доступных интерфейсов.',source:'MDN',url:'https://developer.mozilla.org/ru/'},
  {category:'Дизайн',title:'Система, которая помогает принимать решения',description:'Как дизайн-система экономит внимание команды.',source:'Figma',url:'https://www.figma.com/blog/'},
  {category:'Маркетинг',title:'Как рассказать о проекте без лишнего шума',description:'Простые принципы позиционирования и понятного текста.',source:'Хабр',url:'https://habr.com/ru/hubs/marketing/'},
  {category:'Хакинг',title:'Безопасность начинается с привычек',description:'Практики, которые защищают аккаунты и данные каждый день.',source:'Хабр',url:'https://habr.com/ru/hubs/infosecurity/'},
  {category:'Новости IT',title:'Что нового в мире технологий',description:'Главные обновления и идеи для развития.',source:'TechCrunch',url:'https://techcrunch.com/'},
  {category:'Другое',title:'Инструменты для личных проектов',description:'Подборка полезных сервисов для работы и творчества.',source:'Product Hunt',url:'https://www.producthunt.com/'}
];
const cityPresets=[
  {name:'Москва',latitude:55.7558,longitude:37.6173,timezone:'Europe/Moscow'},
  {name:'Санкт-Петербург',latitude:59.9343,longitude:30.3351,timezone:'Europe/Moscow'},
  {name:'Казань',latitude:55.7963,longitude:49.1088,timezone:'Europe/Moscow'},
  {name:'Екатеринбург',latitude:56.8389,longitude:60.6057,timezone:'Asia/Yekaterinburg'},
  {name:'Новосибирск',latitude:55.0084,longitude:82.9357,timezone:'Asia/Novosibirsk'},
  {name:'Нижний Новгород',latitude:56.3269,longitude:44.0059,timezone:'Europe/Moscow'},
  {name:'Самара',latitude:53.1959,longitude:50.1002,timezone:'Europe/Samara'},
  {name:'Омск',latitude:54.9885,longitude:73.3242,timezone:'Asia/Omsk'},
  {name:'Ростов-на-Дону',latitude:47.2357,longitude:39.7015,timezone:'Europe/Moscow'},
  {name:'Уфа',latitude:54.7388,longitude:55.9721,timezone:'Asia/Yekaterinburg'},
  {name:'Красноярск',latitude:56.0153,longitude:92.8932,timezone:'Asia/Krasnoyarsk'},
  {name:'Воронеж',latitude:51.672,longitude:39.1843,timezone:'Europe/Moscow'},
  {name:'Пермь',latitude:58.0105,longitude:56.2502,timezone:'Asia/Yekaterinburg'},
  {name:'Волгоград',latitude:48.708,longitude:44.5133,timezone:'Europe/Volgograd'},
  {name:'Краснодар',latitude:45.0355,longitude:38.9753,timezone:'Europe/Moscow'},
  {name:'Владивосток',latitude:43.1155,longitude:131.8855,timezone:'Asia/Vladivostok'},
  {name:'Минск',latitude:53.9006,longitude:27.559,timezone:'Europe/Minsk'},
  {name:'Алматы',latitude:43.2389,longitude:76.8897,timezone:'Asia/Almaty'}
];
const statusOptions = value => Object.entries(statuses).map(([key,label]) => `<option value="${key}" ${+key === +value ? 'selected' : ''}>${label}</option>`).join('');
const empty = text => `<p class="empty-state">${escapeHtml(text)}</p>`;
const field = (label, content) => `<label>${label}${content}</label>`;
const input = (name, value='', type='text', extra='') => `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}>`;
const button = (action, id, label, cls='secondary-btn') => `<button type="button" class="${cls}" data-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;

// One accessible dialog handles creation, editing, tools, and detail views.
$('#modal').remove(); $('#focusModal').remove();
document.body.insertAdjacentHTML('beforeend', '<dialog id="editor" class="editor card" aria-labelledby="editorTitle"><button type="button" class="modal-close" id="closeEditor" aria-label="Закрыть">×</button><h2 id="editorTitle"></h2><form id="editorForm"><div id="editorBody"></div><p id="formError" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelEditor">Закрыть</button><button type="submit" class="primary-btn" id="submitEditor">Сохранить</button></div></form></dialog>');
const editor = $('#editor'); let submitHandler = null, dialogReturnFocus, editorPreviewURL = '';
function openEditor(title, body, onSubmit = null, label = 'Сохранить') {
  releaseEditorPreview();
  dialogReturnFocus = document.activeElement;
  $('#editorTitle').textContent = title; $('#editorBody').innerHTML = body; $('#formError').textContent = '';
  $('#submitEditor').hidden = !onSubmit; $('#submitEditor').textContent = label; submitHandler = onSubmit;
  editor.classList.remove('open','closing');
  editor.classList.add('opening');
  if (!editor.open) editor.showModal();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{editor.classList.remove('opening');editor.classList.add('open');}));
  $('input:not([type=file]),textarea,select', editor)?.focus();
}
function closeEditor() { editor.classList.remove('open');editor.classList.add('closing');setTimeout(()=>{editor.close();editor.classList.remove('closing');dialogReturnFocus?.focus();},260); }
$('#closeEditor').onclick = closeEditor; $('#cancelEditor').onclick = closeEditor;
editor.addEventListener('click', e => { if (e.target === editor && (e.clientX < editor.getBoundingClientRect().left || e.clientX > editor.getBoundingClientRect().right)) closeEditor(); });
$('#editorForm').onsubmit = async e => {
  e.preventDefault(); if (!submitHandler) return;
  $('#submitEditor').disabled = true;
  try { const result = await submitHandler(new FormData(e.target)); if (result !== false) closeEditor(); }
  catch (error) { $('#formError').textContent = error.message || 'Не удалось сохранить.'; }
  finally { $('#submitEditor').disabled = false; }
};
function confirmDelete(label, callback) {
  openEditor('Удаление', `<p>Удалить «${escapeHtml(label)}»?</p>`, () => { callback(); saveAndRender(); }, 'Удалить');
}
function showView(view) {
  if (view === 'admin' && !isOwner(currentAccount)) view = 'overview';
  activeView = view;
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.view === view); el.setAttribute('aria-current', el.dataset.view === view ? 'page' : 'false'); });
  $('#sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});
  if (view === 'admin') renderAdmin();
}
$$('.nav-item').forEach(el => el.onclick = () => showView(el.dataset.view));
$$('[data-view-target]').forEach(el => el.onclick = () => showView(el.dataset.viewTarget));
$('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
$('.user-mini').setAttribute('role','button'); $('.user-mini').tabIndex = 0;
$('.user-mini').onclick = e => { if (!e.target.closest('.more')) showView('profile'); };
$('.user-mini').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showView('profile'); } };
// Меню аккаунта по «···»: выход из аккаунта всегда под рукой.
const accountMenu = document.createElement('div');
accountMenu.className = 'account-menu'; accountMenu.hidden = true;
document.body.appendChild(accountMenu);
function renderAccountMenu() {
  accountMenu.innerHTML = `<div class="account-menu-head"><strong>${escapeHtml(state.profile.name || currentAccount.alias)}</strong><span>${escapeHtml(currentAccount.email)}</span></div>` +
    `<button class="account-menu-item danger" data-menu-action="logout">⎋ Выйти из аккаунта</button>`;
}
function toggleAccountMenu(show) {
  if (!currentAccount) return;
  const open = show ?? accountMenu.hidden;
  if (open) {
    renderAccountMenu();
    const rect = $('.user-mini').getBoundingClientRect();
    accountMenu.style.left = '14px';
    accountMenu.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 10)}px`;
  }
  accountMenu.hidden = !open;
}
const moreBtn = $('.user-mini .more');
if (moreBtn) {
  moreBtn.setAttribute('role','button'); moreBtn.tabIndex = 0; moreBtn.title = 'Меню аккаунта';
  moreBtn.onclick = e => { e.stopPropagation(); toggleAccountMenu(); };
  moreBtn.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleAccountMenu(); } };
}
accountMenu.onclick = e => {
  const action = e.target.closest('[data-menu-action]')?.dataset.menuAction;
  if (!action) return;
  accountMenu.hidden = true;
  if (action === 'logout') logoutAccount();
};
document.addEventListener('click', e => { if (!accountMenu.hidden && !e.target.closest('.account-menu') && !e.target.closest('.user-mini .more')) accountMenu.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !accountMenu.hidden) accountMenu.hidden = true; });

const compliments = ['Ты умеешь двигаться вперёд — даже маленький шаг сегодня имеет значение.','Твоя настойчивость сильнее временных трудностей. Дай себе шанс начать.','У тебя есть всё, чтобы сделать этот день чуточку лучше.','Ты молодец: находить время для своих целей — уже важный шаг.','Твои идеи заслуживают воплощения. Начни с одного простого действия.','Ты растёшь с каждым шагом. Замечай и цени свой прогресс.','Тебе не нужно успеть всё. Выбери важное и позаботься о себе.'];
function updateClock(refreshWeather = true) {
  if (!currentAccount) return;
  const now = new Date();
  const hour = now.getHours();
  $('#currentDate').textContent = now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const greeting = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  $('#greetingTitle').textContent = greeting + (state.profile.name.trim() ? `, ${state.profile.name.trim().split(/\s+/)[0]}` : '') + ' ✦';
  $('#motivationalText').textContent = compliments[now.getDay()];
  $('#dateBadgeDay').textContent = String(now.getDate()).padStart(2,'0');
  $('#dateBadgeMonth').innerHTML = `${new Intl.DateTimeFormat('ru-RU',{month:'short'}).format(now).toUpperCase()}<br>${now.getFullYear()}`;
  $('#todayPlanDate').textContent = formatDate(today());
  if (clockDate !== today()) { clockDate = today(); renderAll(); }
}
let weatherRequest = 0, weatherUpdated = 0, weatherFailedAt = 0, weatherAttempts = 0;
const weatherMaxAttempts = 3;
const wmoDescriptions = {0:'Ясно',1:'Преимущественно ясно',2:'Переменная облачность',3:'Пасмурно',45:'Туман',48:'Изморозь',51:'Морось',53:'Морось',55:'Морось',56:'Ледяная морось',57:'Ледяная морось',61:'Небольшой дождь',63:'Дождь',65:'Сильный дождь',66:'Ледяной дождь',67:'Ледяной дождь',71:'Небольшой снег',73:'Снег',75:'Сильный снег',77:'Снежная крупа',80:'Ливень',81:'Ливень',82:'Сильный ливень',85:'Снегопад',86:'Сильный снегопад',95:'Гроза',96:'Гроза с градом',99:'Гроза с градом'};
function iconFromText(text = '') {
  const value = String(text).toLowerCase();
  if (/гроз|thunder|storm/.test(value)) return '⛈';
  if (/снег|snow|sleet|круп|ледян/.test(value)) return '❄';
  if (/дожд|rain|drizzle|ливень|морос/.test(value)) return '☂';
  if (/туман|fog|mist|дым|haze|измороз/.test(value)) return '☁';
  if (/облач|cloud|пасмур|overcast/.test(value)) return '☁';
  if (/солн|ясн|clear|sun/.test(value)) return '☀';
  return '';
}
function weatherIcon(code, desc = '') {
  return iconFromText(desc) || (code === 0 ? '☀' : code < 4 ? '⛅' : code < 70 ? '☁' : code < 80 ? '☂' : code < 90 ? '❄' : '⛈');
}
function weatherMarkup() {
  const weather = state.weather || {}, time = cityTime();
  if (weather.temp != null) {
    const parts = [`${weatherIcon(weather.code, weather.desc)} ${weather.city}`];
    if (weather.desc) parts.push(weather.desc);
    parts.push(time, `${Math.round(weather.temp)}°C`);
    return parts.join(' · ');
  }
  if (weatherFailedAt) return `☁ ${weather.city} · ${time} · нет данных`;
  return `⌁ ${weather.city} · ${time}`;
}
function updateWeatherWidget() {
  const widget = $('#weatherWidget'); if (!widget) return;
  widget.textContent = weatherMarkup();
  const updated = state.weather?.updated ? ` Обновлено в ${new Date(state.weather.updated).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}.` : '';
  widget.title = state.weather?.temp != null
    ? `${state.weather.desc || 'Погода сейчас'}.${updated} Нажми, чтобы выбрать город.`
    : weatherFailedAt
      ? 'Погода недоступна (нет сети). Нажми, чтобы выбрать город, или обнови кнопкой ↻ рядом.'
      : 'Погода загружается…';
}
async function fetchWeatherJSON(url, timeout = 4500) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try { const response = await fetch(url, {signal:controller.signal}); if (!response.ok) throw new Error(); return await response.json(); }
  finally { clearTimeout(timer); }
}
async function weatherOpenMeteo() {
  const data = await fetchWeatherJSON(`https://api.open-meteo.com/v1/forecast?latitude=${state.weather.lat}&longitude=${state.weather.lon}&current=temperature_2m,weather_code&timezone=auto`);
  const code = data?.current?.weather_code, temp = data?.current?.temperature_2m;
  if (!Number.isFinite(+temp)) throw new Error('Bad weather data');
  return {temp:+temp, code, desc:wmoDescriptions[code] || '', timezone:data.timezone || ''};
}
async function weatherWttr() {
  const data = await fetchWeatherJSON(`https://wttr.in/${state.weather.lat},${state.weather.lon}?format=j1&lang=ru`);
  const current = data?.current_condition?.[0], temp = current?.temp_C;
  if (!Number.isFinite(+temp)) throw new Error('Bad weather data');
  return {temp:+temp, code:+current?.weatherCode || 0, desc:current?.lang_ru?.[0]?.value || current?.weatherDesc?.[0]?.value || '', timezone:''};
}
async function updateWeather(force = false) {
  if (!currentAccount || !state.weather) return;
  if (!force) {
    if (Date.now() - weatherUpdated < 10*60*1000) return;
    if (weatherFailedAt && Date.now() - weatherFailedAt < 60*1000) return;
    if (weatherAttempts >= weatherMaxAttempts) return; // авто-повторы остановлены, обновление только вручную
  }
  const request = ++weatherRequest;
  updateWeatherWidget();
  try {
    let data;
    try { data = await weatherOpenMeteo(); }
    catch { if (request !== weatherRequest) return; data = await weatherWttr(); }
    if (request !== weatherRequest) return;
    if (data.timezone && state.weather.timezone !== data.timezone) { state.weather.timezone = data.timezone; persist(); updateClock(false); }
    state.weather.temp = data.temp; state.weather.code = data.code; state.weather.desc = data.desc; state.weather.updated = Date.now();
    weatherUpdated = Date.now(); weatherFailedAt = 0; weatherAttempts = 0;
    persist(); updateWeatherWidget();
  } catch {
    weatherFailedAt = Date.now(); weatherAttempts++;
    if (request === weatherRequest) updateWeatherWidget();
  }
}
function cityTime(){return new Intl.DateTimeFormat('ru-RU',{timeZone:state.weather?.timezone||undefined,hour:'2-digit',minute:'2-digit'}).format(new Date());}
function themeRgb(value) {
  const hex=String(value||'').replace('#','').trim(), full=hex.length===3?hex.split('').map(char=>char+char).join(''):hex.padEnd(6,'0').slice(0,6), number=parseInt(full,16);
  return Number.isFinite(number)?[number>>16&255,number>>8&255,number&255]:[118,169,255];
}
function mixThemeColor(base, tint, amount) {
  return base.map((value,index)=>Math.max(0,Math.min(255,Math.round(value*(1-amount)+tint[index]*amount))));
}
function themeRgbCss(rgb) {
  return `rgb(${rgb.join(',')})`;
}
function themeHsl(value) {
  const [r,g,b]=themeRgb(value).map(channel=>channel/255), max=Math.max(r,g,b), min=Math.min(r,g,b), lightness=(max+min)/2;
  let hue=0, saturation=0;
  if(max!==min){const delta=max-min;saturation=lightness>.5?delta/(2-max-min):delta/(max+min);if(max===r)hue=(g-b)/delta+(g<b?6:0);else if(max===g)hue=(b-r)/delta+2;else hue=(r-g)/delta+4;hue*=60;}
  return {hue,saturation:saturation*100,lightness:lightness*100};
}
function themeTone(hsl, shift=0, alpha=1) {
  const hue=((hsl.hue+shift)%360+360)%360;
  return `hsla(${hue.toFixed(1)}, ${hsl.saturation.toFixed(1)}%, ${hsl.lightness.toFixed(1)}%, ${alpha})`;
}
function applyTheme() {
  const light = state.theme === 'light';
  document.documentElement.dataset.theme = state.theme;
  const themeBtn = $('#themeBtn'); if (themeBtn) themeBtn.textContent = light ? '☾' : '☼';
  const color = '#76a9ff', accent = themeRgb(color), hsl = themeHsl(color);
  document.documentElement.style.setProperty('--blue', color);
  document.documentElement.style.setProperty('--accent-ink', light ? '#3e72c9' : '#76a9ff');
  document.documentElement.style.setProperty('--accent-contrast', '#fff');
  document.documentElement.style.setProperty('--accent-2', themeTone(hsl,46));
  document.documentElement.style.setProperty('--accent-3', themeTone(hsl,-52));
  document.documentElement.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${themeTone(hsl,38)}, ${color} 48%, ${themeTone(hsl,-42)})`);
  if (light) {
    // Белая тема остаётся без изменений.
    const base = {bg:'#f3f6fb',sidebar:'#eaf0f8',panel:'#ffffff',panel2:'#f5f8fc',line:'#d2dce9'};
    const weights = {bg:.12,sidebar:.18,panel:.06,panel2:.10,line:.22};
    for (const key of ['bg','sidebar','panel','panel2','line']) document.documentElement.style.setProperty(`--${key}`,themeRgbCss(mixThemeColor(themeRgb(base[key]),accent,weights[key])));
    const textStyles = {text:['#141c2a',.04],muted:['#4b596e',.14],dim:['#4f5c70',.10]};
    for (const [key,[baseColor,amount]] of Object.entries(textStyles)) document.documentElement.style.setProperty(`--${key}`,themeRgbCss(mixThemeColor(themeRgb(baseColor),accent,amount)));
    const glow=.20, glow2=.14;
    document.documentElement.style.setProperty('--bg-gradient', `radial-gradient(circle at 14% 18%, ${themeTone(hsl,0,glow)} 0%, transparent 54%), radial-gradient(circle at 86% 14%, ${themeTone(hsl,54,glow2)} 0%, transparent 52%), radial-gradient(circle at 52% 92%, ${themeTone(hsl,-58,glow2)} 0%, transparent 58%)`);
  } else {
    // Тёмная тема возвращена к исходному виду.
    const base = {bg:'#0d1017',sidebar:'#11151d',panel:'#151a23',panel2:'#191f29',line:'#29303b'};
    const weights = {bg:.13,sidebar:.18,panel:.10,panel2:.13,line:.24};
    for (const key of ['bg','sidebar','panel','panel2','line']) document.documentElement.style.setProperty(`--${key}`,themeRgbCss(mixThemeColor(themeRgb(base[key]),accent,weights[key])));
    const textStyles = {text:['#f4f5f8',.05],muted:['#8b93a3',.12],dim:['#626b7b',.14]};
    for (const [key,[baseColor,amount]] of Object.entries(textStyles)) document.documentElement.style.setProperty(`--${key}`,themeRgbCss(mixThemeColor(themeRgb(baseColor),accent,amount)));
    const glow=.26, glow2=.19;
    document.documentElement.style.setProperty('--bg-gradient', `radial-gradient(circle at 14% 18%, ${themeTone(hsl,0,glow)} 0%, transparent 54%), radial-gradient(circle at 86% 14%, ${themeTone(hsl,54,glow2)} 0%, transparent 52%), radial-gradient(circle at 52% 92%, ${themeTone(hsl,-58,glow2)} 0%, transparent 58%)`);
  }
}
$('#themeBtn').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; applyTheme(); persist(); logAction('переключил тему', state.theme === 'light' ? 'Светлая тема' : 'Тёмная тема'); };
applyTheme();

function editTask(id, date = today()) {
  const task = state.tasks.find(item => item.id === id);
  if (!task && date < today()) { toast('Добавлять задачи на прошедшие даты нельзя.', true); return; }
  const value = task || {title:'',date,time:'10:00',priority:'medium',progress:0};
  const minimum = task && task.date < today() ? '' : `min="${today()}"`;
  openEditor(task ? 'Изменить задачу' : 'Новая задача',
    field('Название', input('title',value.title,'text','required maxlength="160"')) +
    `<div class="form-row">${field('Дата', input('date',value.date,'date',`required ${minimum}`))}${field('Время',input('time',value.time,'time','required'))}</div>` +
    field('Приоритет', `<select name="priority">${[['urgent','Срочный'],['medium','Средний'],['low','Не срочный']].map(([key,label])=>`<option value="${key}" ${key===value.priority?'selected':''}>${label}</option>`).join('')}</select>`) +
    field('Выполнение', `<select name="progress">${statusOptions(value.progress)}</select>`) + field('Цель', `<select name="goal"><option value="">Без цели</option>${state.goals.map(goal=>`<option value="${goal.id}" ${goal.id===value.goal?'selected':''}>${escapeHtml(goal.title)}</option>`).join('')}</select>`), data => {
      const chosen = String(data.get('date')), title = String(data.get('title')).trim();
      if (!title) throw new Error('Введите название.');
      if (chosen < today() && (!task || chosen !== task.date)) throw new Error('Нельзя создать или перенести задачу в прошлое.');
      const progress = +data.get('progress');
      if (chosen > today() && progress > 0) throw new Error('Отметить выполнение можно в день задачи или позднее.');
      const record = {...value,id:task?.id || uid(),title,date:chosen,time:String(data.get('time')),priority:String(data.get('priority')),progress,goal:String(data.get('goal')||'')};
      record.activityDate = progress ? (task?.progress === progress ? task.activityDate : today()) : null;
      if (task) state.tasks[state.tasks.indexOf(task)] = record; else state.tasks.push(record);
      logAction(task?'изменил задачу':'создал задачу',`«${title}» · ${formatDate(chosen)}`,record.id);
      saveAndRender(); toast(task ? 'Задача обновлена' : 'Задача добавлена');
    }, task ? 'Сохранить' : 'Добавить');
}
function taskMarkup(task, draggable = false) {
  const linkedGoal=task.goal?state.goals.find(goal=>goal.id===task.goal):null, priority=normalizePriority(task.priority);
  const dragHandle=draggable?`<span class="drag-handle" draggable="true" title="Перетащить задачу" aria-label="Перетащить задачу">⠿</span>`:'';
  return `<div class="task-item ${task.progress===100?'completed':''} ${draggable?'draggable-task':''}" data-id="${task.id}">
    ${dragHandle}<button class="task-checkbox ${task.progress===50?'half':''}" data-action="task-cycle" data-id="${task.id}" ${task.date>today()?'disabled':''} title="Переключить: не начато → наполовину → выполнено" aria-label="${escapeHtml(task.title)}: ${statuses[task.progress]}">${task.progress===100?'✓':task.progress===50?'½':''}</button>
    <div class="task-copy"><strong>${escapeHtml(task.title)}</strong><small>${formatDate(task.date)} · ${task.time} · ${statuses[task.progress]}${linkedGoal?` · ◎ ${escapeHtml(linkedGoal.title)}`:''}</small></div><span class="task-priority priority-${priority}">${priorityLabels[priority]}</span>
    ${button('task-edit',task.id,'✎','row-btn')}${button('task-delete',task.id,'×','row-btn')}</div>`;
}
function sortedTasks(list) {
  if (taskSort === 'priority') return [...list].sort((a,b)=>priorityRank[normalizePriority(a.priority)]-priorityRank[normalizePriority(b.priority)]);
  if (taskSort === 'progress') return [...list].sort((a,b)=>a.progress-b.progress);
  if (taskSort === 'date') return [...list].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  return [...list];
}
function renderTasks() {
  const daily = state.tasks.filter(task => task.date === today()), completed = state.tasks.filter(task => task.progress === 100).length;
  const doneToday = daily.filter(task=>task.progress===100).length, percent = state.tasks.length ? Math.round(completed / state.tasks.length * 100) : 0;
  $('#todayTasks').innerHTML = daily.length ? sortedTasks(daily).map(taskMarkup).join('') : empty('На сегодня задач нет. Добавь свой первый шаг.');
  const filtered = state.tasks.filter(task => taskFilter === 'all' || (taskFilter === 'today' ? task.date === today() : normalizePriority(task.priority) === 'urgent'));
  $('#allTasks').innerHTML = filtered.length ? sortedTasks(filtered).map(task=>taskMarkup(task,true)).join('') : empty('Здесь пока нет задач.');
  $('#allTaskCount').textContent = state.tasks.length; $('#todayTaskCount').textContent = daily.length;
  $('#importantTaskCount').textContent = state.tasks.filter(task=>normalizePriority(task.priority)==='urgent').length;
  $('.nav-count').textContent = state.tasks.filter(task=>task.progress<100).length;
  $('#taskCountOverview').textContent = state.tasks.length;
  $('#completionSummary').textContent = `${doneToday} из ${daily.length} выполнено сегодня`;
  const dailyPercent = daily.length ? Math.round(doneToday/daily.length*100) : 0;
  $('.tasks-card .progress-bar i').style.width = dailyPercent+'%'; $('.progress-text').textContent = dailyPercent+'%';
  $('#completionPercent').innerHTML = `${percent}<span>%</span>`;
  $('#energySummary').textContent = `Выполнено задач: ${completed} из ${state.tasks.length}`;
  $('#energyStatus').textContent = !state.tasks.length ? 'Начинаем' : percent === 100 ? 'Всё готово' : 'В процессе';
  $('#focusProgress').textContent = `${doneToday}/${daily.length}`;
  $('.focus-ring').style.background = `conic-gradient(var(--blue) ${dailyPercent}%,var(--line) 0)`;
  $('.focus-mini strong').textContent = `${percent}% выполнено`;
  const progressHue = 343 + (80 - 343) * percent / 100;
  $('.focus-mini strong').style.color = `hsl(${progressHue} 48% ${45 + percent * .08}%)`;
  $$('#energyBars i').forEach((el,index)=>el.classList.toggle('on',(index+1)/7*100 <= percent));
  $('.notification-dot').hidden = !daily.some(task=>task.progress<100);
}
['#openTask','#openTask2','#addInline'].forEach(selector => $(selector).onclick = () => editTask(null));
$('#openEvent').onclick = () => editTask(null,selectedDate);
$$('.tab').forEach(el => el.onclick = () => { taskFilter = el.dataset.filter; $$('.tab').forEach(tab=>tab.classList.toggle('active',tab===el)); renderTasks(); });
function sortTaskLabel(){return {manual:'Вручную',date:'По дате ↑',priority:'По приоритету ↑',progress:'По выполнению ↑'}[taskSort];}
$('#sortTasks').onclick = () => { const modes = ['manual','date','priority','progress']; taskSort = modes[(modes.indexOf(taskSort)+1)%4]; $('#sortTasks').textContent = sortTaskLabel(); renderTasks(); };

function moveTask(dragId, targetId, after) {
  const from = state.tasks.findIndex(task => task.id === dragId);
  if (from < 0) return;
  const [task] = state.tasks.splice(from, 1);
  let index = state.tasks.findIndex(item => item.id === targetId);
  if (index < 0) { state.tasks.splice(from, 0, task); return; }
  if (after) index++;
  state.tasks.splice(index, 0, task);
  taskSort = 'manual';
  $('#sortTasks').textContent = sortTaskLabel();
  saveAndRender();
  toast('Порядок задач обновлён');
}
const allTasksEl = $('#allTasks');
allTasksEl.addEventListener('dragstart', e => {
  const handle = e.target.closest('.drag-handle');
  if (!handle) { e.preventDefault(); return; }
  const item = handle.closest('.task-item');
  if (!item) return;
  draggedTaskId = item.dataset.id;
  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedTaskId);
});
allTasksEl.addEventListener('dragover', e => {
  if (!draggedTaskId) return;
  const item = e.target.closest('.task-item');
  if (!item || item.dataset.id === draggedTaskId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  $$('.task-item', allTasksEl).forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
  const rect = item.getBoundingClientRect();
  item.classList.add(e.clientY > rect.top + rect.height / 2 ? 'drag-over-bottom' : 'drag-over-top');
});
allTasksEl.addEventListener('dragleave', e => { if (!e.relatedTarget?.closest?.('#allTasks')) $$('.task-item', allTasksEl).forEach(el => el.classList.remove('drag-over-top','drag-over-bottom')); });
allTasksEl.addEventListener('drop', e => {
  const item = e.target.closest('.task-item');
  if (!item || !draggedTaskId) return;
  e.preventDefault();
  const rect = item.getBoundingClientRect(), after = e.clientY > rect.top + rect.height / 2;
  const targetId = item.dataset.id;
  $$('.task-item', allTasksEl).forEach(el => el.classList.remove('dragging','drag-over-top','drag-over-bottom'));
  if (targetId !== draggedTaskId) moveTask(draggedTaskId, targetId, after);
  draggedTaskId = '';
});
allTasksEl.addEventListener('dragend', () => { $$('.task-item', allTasksEl).forEach(el => el.classList.remove('dragging','drag-over-top','drag-over-bottom')); draggedTaskId = ''; });
$('#notificationsBtn').onclick = () => {
  const pending = state.tasks.filter(task=>task.date<=today() && task.progress<100);
  openEditor('Напоминания', pending.length ? pending.map(task=>`<p><strong>${escapeHtml(task.title)}</strong><br><small>${formatDate(task.date)} · ${task.time}${task.date<today()?' · Просрочено':''}</small></p>`).join('') : empty('Незавершённых задач на сегодня нет.'));
};
function renderCalendar() {
  $('#monthName').textContent = new Date(calendarYear,calendarMonth,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const start = (new Date(calendarYear,calendarMonth,1).getDay()+6)%7;
  const days = new Date(calendarYear,calendarMonth+1,0).getDate();
  let html = '<span></span>'.repeat(start);
  for(let day=1;day<=days;day++) {
    const key = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, count = state.tasks.filter(task=>task.date===key).length;
    html += `<button class="calendar-cell ${key===today()?'today':''} ${key===selectedDate?'selected':''} ${key<today()?'past':''}" data-action="calendar-select" data-id="${key}" aria-pressed="${key===selectedDate}" aria-label="${formatDate(key)}, задач: ${count}">${day}${count?'<i class="event-dot"></i>':''}</button>`;
  }
  $('#calendarGrid').innerHTML = html;
  const tasks = sortedTasks(state.tasks.filter(task=>task.date===selectedDate));
  $('#agendaDate').textContent = formatDate(selectedDate); $('#agendaCount').textContent = tasks.length;
  $('#agendaTitle').textContent = selectedDate===today() ? 'Задачи на сегодня' : 'Задачи на эту дату';
  $('#agendaList').innerHTML = (tasks.length?tasks.map(taskMarkup).join(''):empty('На эту дату задач нет.')) + (selectedDate<today()?'<p class="help-text">Прошедшая дата: добавление задач недоступно.</p>':'');
  $('#openEvent').disabled = selectedDate < today();
}
function shiftMonth(amount) { const date = new Date(calendarYear,calendarMonth+amount,1); calendarYear=date.getFullYear();calendarMonth=date.getMonth();renderCalendar(); }
$('#prevMonth').onclick = () => shiftMonth(-1); $('#nextMonth').onclick = () => shiftMonth(1);
$('#todayCalendar').onclick = () => { selectedDate=today();calendarMonth=new Date().getMonth();calendarYear=new Date().getFullYear();renderCalendar(); };

function editGoal(id) {
  const goal = state.goals.find(item=>item.id===id), value = goal || {title:'',description:'',date:today(),progress:0};
  openEditor(goal?'Моя цель':'Новая цель', field('Название',input('title',value.title,'text','required maxlength="160"')) + field('Зачем мне это',`<textarea name="description" maxlength="1200">${escapeHtml(value.description)}</textarea>`) + field('Срок',input('date',value.date,'date','required')) + field('Прогресс',`<select name="progress">${statusOptions(value.progress)}</select>`), data=>{
    const title=String(data.get('title')).trim(); if(!title) throw new Error('Введите название цели.');
    const progress=+data.get('progress');
    const record={id:goal?.id||uid(),title,description:String(data.get('description')).trim(),date:String(data.get('date')),progress,activityDate:progress?(goal?.progress===progress?goal.activityDate:today()):null};
    if(goal) state.goals[state.goals.indexOf(goal)]=record; else state.goals.push(record);
    logAction(goal?'изменил цель':'создал цель',`«${title}»`,record.id);
    saveAndRender(); toast('Цель сохранена');
  });
}
$('#addGoal').onclick=()=>editGoal(null);
function renderGoals() {
  $('.goals-grid').innerHTML=state.goals.length?state.goals.map(goal=>`<article class="card goal-card"><div class="goal-top"><span class="goal-icon purple">◎</span><span class="goal-period">До ${formatDate(goal.date)}</span></div><h2>${escapeHtml(goal.title)}</h2><p>${escapeHtml(goal.description)}</p><div class="goal-progress"><div><span>${statuses[goal.progress]}</span><b>${goal.progress}%</b></div><div class="progress-bar"><i style="width:${goal.progress}%"></i></div></div><div class="goal-footer">${button('goal-edit',goal.id,'Открыть цель →','text-btn')}${button('goal-delete',goal.id,'Удалить','text-btn')}</div></article>`).join(''):empty('Начни с одной важной цели. Твой прогресс появится здесь.');
}
function activityStreak() {
  const dates=new Set([...state.tasks,...state.goals].filter(item=>item.progress>0).map(item=>item.activityDate));
  let cursor=new Date(),count=0;
  if(!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
  while(dates.has(dateKey(cursor))) {count++;cursor.setDate(cursor.getDate()-1);}
  return count;
}
function avatarMarkup() {
  if (!state.profile.photo) return escapeHtml(state.profile.name.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase() || 'Я');
  const x=Math.min(100,Math.max(0,+state.profile.photoX||50)), y=Math.min(100,Math.max(0,+state.profile.photoY||50)), scale=Math.min(2.5,Math.max(1,+state.profile.photoScale||1));
  return `<img class="avatar-photo" src="${escapeHtml(state.profile.photo)}" alt="Фото профиля" style="object-position:${x}% ${y}%;transform:scale(${scale})">`;
}
function photoAccent(photo) {
  if (!photo) { $('#profileCover')?.style.removeProperty('--profile-accent'); return; }
  const image = new Image();
  image.onload = () => {
    if (state.profile.photo !== photo) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', {willReadFrequently:true}); context.drawImage(image, 0, 0, 1, 1);
    const [r,g,b] = context.getImageData(0, 0, 1, 1).data;
    $('#profileCover')?.style.setProperty('--profile-accent', `rgb(${r}, ${g}, ${b})`);
  };
  image.src = photo;
}
function renderProfile() {
  $$('.avatar,.profile-avatar').forEach(el=>el.innerHTML=avatarMarkup());
  $$('.avatar img,.profile-avatar img').forEach(img=>{img.style.objectPosition=`${state.profile.photoX??50}% ${state.profile.photoY??50}%`;img.style.transform=`scale(${state.profile.photoScale||1})`;});
  photoAccent(state.profile.photo);
  profileMediaRender();
  const card=$('#profileCard');
  if(card)card.classList.toggle('row-view',state.profile.layout==='row');
  $$('[data-profile-tool="layout"]').forEach(b=>{b.textContent=state.profile.layout==='row'?'▤':'☰';b.title=state.profile.layout==='row'?'Показать стандартный вид':'Показать компактный вид';});
  $('.user-mini strong').textContent=state.profile.name||'Мой профиль';
  $('#profileName').textContent=state.profile.name||'Твоё имя';
  const owner=isOwner(currentAccount);
  const prefix=$('#profileOwner');
  if(prefix){prefix.hidden=!owner;prefix.textContent=state.profile.status||'✦ В своём ритме';}
  $('#profileAliasLine').textContent=`@${state.profile.alias||'без_псевдонима'}`;
  $$('.profile-status').forEach(el=>el.remove());
  const favorites=state.tracks.filter(track=>track.favorite);
  $('#favoriteTrackCount').textContent=`${favorites.length} сохранено`;
  $('#profileFavorites').innerHTML=favorites.slice(0,3).map(track=>`<button class="profile-favorite" data-action="track-play" data-id="${track.id}"><span>♪</span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist||'Исполнитель не указан')}</small></button>`).join('');
  const stats=$$('.profile-stats b');stats[0].textContent=activityStreak();stats[1].textContent=state.tasks.filter(item=>item.progress===100).length;stats[2].textContent=state.goals.filter(item=>item.progress===100).length;
  $$('.profile-stats span')[2].textContent='целей достигнуто';
  const monday=new Date();monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  const all=[...state.tasks,...state.goals],scores=[];
  for(let i=0;i<7;i++){const day=new Date(monday);day.setDate(day.getDate()+i);scores.push(all.filter(item=>item.activityDate===dateKey(day)).reduce((sum,item)=>sum+item.progress/100,0));}
  const max=Math.max(1,...scores);
  $('.chart-bars').innerHTML=scores.map((score,i)=>`<div class="chart-column"><span>${score.toLocaleString('ru-RU')}</span><i style="height:${score/max*125}px" title="${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}: ${score} балла"></i></div>`).join('');
  $('.stat-callout strong').textContent=`За неделю: ${scores.reduce((a,b)=>a+b,0).toLocaleString('ru-RU')} балла`;
  $('.stat-callout small').textContent='Выполненная задача или цель = 1 балл; наполовину = 0,5. Учитывается последняя дата изменения прогресса.';
  updateClock(false);
}
function newsAllItems(){
  const seen=new Set();
  return [...(state.newsCustom||[]),...(state.newsFeed||[]),...newsItems].filter(item=>{
    if(!item||!item.title)return false;
    const key=String(item.url||item.title);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function renderNews() {
  const all=newsAllItems();
  const select=$('#newsCategorySelect');
  if(select){
    const categories=[...new Set(['Все',...newsCategories.slice(1),...all.map(item=>item.category).filter(Boolean)])];
    select.innerHTML=categories.map(category=>`<option value="${escapeHtml(category)}" ${category===newsFilter?'selected':''}>${escapeHtml(category)}</option>`).join('');
    select.value=newsFilter;
  }
  const sourceSelect=$('#newsSourceSelect');
  if(sourceSelect){
    const sources=['Все',...new Set([...all.map(item=>item.source),...(state.newsSources||[]).map(source=>typeof source==='string'?source:source.name)].filter(Boolean))];
    if(!sources.includes(newsSource))newsSource='Все';
    sourceSelect.innerHTML=sources.map(source=>`<option value="${escapeHtml(source)}" ${source===newsSource?'selected':''}>${escapeHtml(source)}</option>`).join('');
    sourceSelect.value=newsSource;
  }
  const items=all.filter(item=>(newsFilter==='Все'||item.category===newsFilter)&&(newsSource==='Все'||item.source===newsSource)).slice(0,50);
  $('#newsList').innerHTML=items.length?items.map((item,index)=>`<article class="news-card card ${index===0?'featured-news':''}"><div class="article-icon ${item.image?'news-thumb':' '+(index%2?'blue':'orange')}" ${item.image?`style="background-image:url('${escapeHtml(item.image)}')"`:''}>${item.image?'':(index%2?'⌁':'✦')}</div><div class="news-content"><div class="news-meta"><span>${escapeHtml(String(item.category||'Другое').toUpperCase())}</span><small>${escapeHtml(item.source||'Источник')}</small></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description||'')}</p><a href="${escapeHtml(item.url||'#')}" target="_blank" rel="noopener noreferrer">Читать источник →</a></div></article>`).join(''):empty('По выбранным фильтрам новостей нет. Добавь источник или новость по ссылке.');
  const count=(state.newsSources||[]).length;
  $('#manageSources').textContent=count?`Мои источники · ${count}`:'Мои источники';
}
// --- External content (news links, music links) -------------------------
// Static app: CORS blocks direct page reads, so try public read-only proxies.
async function fetchExternalText(url, timeout = 6000) {
  let sameOrigin = false;
  try { sameOrigin = new URL(url).origin === location.origin; } catch {}
  const attempts = [
    ...(sameOrigin ? [() => url] : []),
    value => `https://api.allorigins.win/raw?url=${encodeURIComponent(value)}`,
    value => `https://corsproxy.io/?url=${encodeURIComponent(value)}`,
    value => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(value)}`
  ];
  let lastError;
  for (const make of attempts) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(make(url), {signal:controller.signal, headers:{'Accept':'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text && text.trim().length > 40) return text;
    } catch (error) { lastError = error; }
    finally { clearTimeout(timer); }
  }
  throw lastError || new Error('Сервис не отдал данные.');
}
async function fetchExternalJSON(url, timeout = 8000) {
  const text = await fetchExternalText(url, timeout);
  try { return JSON.parse(text); } catch { throw new Error('Некорректный ответ сервиса.'); }
}
const stripHtml = value => {
  const box = document.createElement('div');
  box.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, ' ');
  return (box.textContent || '').replace(/\s+/g, ' ').trim();
};
const absoluteUrl = (value, base) => { try { return new URL(value, base).href; } catch { return ''; } };
function metaFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const content = selector => doc.querySelector(selector)?.getAttribute('content')?.trim() || '';
  const title = content('meta[property="og:title"]') || content('meta[name="twitter:title"]') || doc.querySelector('article h1')?.textContent?.trim() || doc.title?.trim() || doc.querySelector('main h1')?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || '';
  const description = content('meta[property="og:description"]') || content('meta[name="twitter:description"]') || content('meta[name="description"]') || [...doc.querySelectorAll('article p,main p')].map(node=>node.textContent).join(' ').slice(0,900) || '';
  return {
    title: stripHtml(title),
    description: stripHtml(description).slice(0, 900),
    image: absoluteUrl(content('meta[property="og:image"]') || content('meta[name="twitter:image"]'), baseUrl),
    audioUrl: absoluteUrl(content('meta[property="og:audio"]') || content('meta[property="og:audio:url"]'), baseUrl),
    embedHtml: content('meta[property="og:video:url"]') || ''
  };
}
async function articleMetaFromUrl(url) {
  let meta = null;
  try { meta = metaFromHtml(await fetchExternalText(url), url); } catch {}
  if (!meta?.title || meta.title.length < 3) {
    try {
      const text = await (await fetch(`https://r.jina.ai/${url}`)).text();
      const title = (text.match(/^Title:\s*(.+)$/m) || [])[1] || (text.match(/^#\s+(.+)$/m) || [])[1] || '';
      const body = text.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').replace(/^Markdown Content:/m, '').replace(/#+\s*/g, ' ').trim();
      meta = {title:stripHtml(title), description:stripHtml(body).slice(0, 900), image:'', audioUrl:''};
    } catch {}
  }
  if (!meta?.title) throw new Error('Не удалось прочитать ссылку. Проверь адрес или попробуй другую статью.');
  return {id:uid(), title:meta.title, description:meta.description, image:meta.image || '', url, source:new URL(url).hostname.replace(/^www\./,''), category:'Другое', created:Date.now()};
}
async function sourceItems(source) {
  const text = await fetchExternalText(source.url);
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const nodes = [...doc.querySelectorAll('item, entry')];
  const items = [];
  for (const node of nodes.slice(0, 12)) {
    const title = stripHtml(node.querySelector('title')?.textContent || '');
    const linkNode = node.querySelector('link');
    const link = absoluteUrl(linkNode?.getAttribute('href') || linkNode?.textContent || '', source.url);
    const description = stripHtml(node.querySelector('description, summary, content')?.textContent || '').slice(0, 600);
    if (title && link) items.push({id:uid(), title, description, url:link, source:source.name, sourceUrl:source.url, category:'Другое', created:Date.now()});
  }
  if (items.length) return items;
  const htmlDoc = new DOMParser().parseFromString(text, 'text/html');
  const links = [...htmlDoc.querySelectorAll('article a[href], main a[href], h2 a[href], h3 a[href]')].slice(0, 10);
  const seen = new Set();
  for (const link of links) {
    const title = stripHtml(link.textContent);
    const href = absoluteUrl(link.getAttribute('href'), source.url);
    if (!title || title.length < 8 || !href || seen.has(href)) continue;
    seen.add(href);
    items.push({id:uid(), title, description:'', url:href, source:source.name, sourceUrl:source.url, category:'Другое', created:Date.now()});
  }
  if (items.length) return items;
  const meta = metaFromHtml(text, source.url);
  if (!meta.title) throw new Error('На странице источника не найдено новостей.');
  return [{id:uid(), title:meta.title, description:meta.description, image:meta.image, url:source.url, source:source.name, sourceUrl:source.url, category:'Другое', created:Date.now()}];
}
async function refreshNewsSource(source) {
  try {
    const items = await sourceItems(source);
    state.newsFeed = [...(state.newsFeed || []).filter(item => item.sourceUrl !== source.url), ...items].slice(-160);
    persist(); renderNews();
    return items.length;
  } catch (error) {
    toast(`Не удалось загрузить «${source.name}»: ${error.message || 'нет доступа'}`, true);
    return 0;
  }
}
async function timezoneFor(latitude, longitude) {
  try {
    const data = await fetchWeatherJSON(`https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`, 5000);
    if (data?.timeZone) return data.timeZone;
  } catch {}
  return '';
}
async function findCity(query) {
  const preset = cityPresets.find(place => place.name.toLowerCase().includes(query.toLowerCase()));
  try {
    const data = await fetchWeatherJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ru&format=json`, 6000);
    if (data?.results?.length) return data.results[0];
  } catch {}
  try {
    const data = await fetchWeatherJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ru&q=${encodeURIComponent(query)}`, 6000);
    const place = data?.[0];
    if (place) {
      const latitude = +place.lat, longitude = +place.lon;
      return {name:place.name || String(place.display_name).split(',')[0], latitude, longitude, timezone:await timezoneFor(latitude, longitude)};
    }
  } catch {}
  return preset || null;
}
async function chooseWeatherCity() {
  openEditor('Город и погода',field('Поиск города',input('city','','search','required placeholder="Например, Санкт-Петербург"')),async data=>{
    const query=String(data.get('city')).trim();if(query.length<2)throw new Error('Введи минимум 2 символа.');
    const place=await findCity(query);if(!place)throw new Error('Город не найден. Попробуй другое название.');
    state.weather={city:place.name,lat:place.latitude,lon:place.longitude,timezone:place.timezone || state.weather.timezone,temp:null,code:null,desc:'',updated:0};weatherUpdated=0;weatherFailedAt=0;weatherAttempts=0;persist();updateSettingsCity();updateClock(false);updateWeather(true);toast(`Город изменён: ${place.name}`);
  },'Выбрать город');
}
window.addEventListener('online',()=>{if(currentAccount){weatherUpdated=0;weatherFailedAt=0;weatherAttempts=0;}});
$('#newsCategorySelect')?.addEventListener('change', e=>{newsFilter=e.target.value;renderNews();});
$('#newsSourceSelect')?.addEventListener('change', e=>{newsSource=e.target.value;renderNews();});
$('#addNews').onclick=()=>openEditor('Добавить новость по ссылке',field('Ссылка на статью',input('url','','url','required placeholder="https://"'))+field('Тема',`<select name="category">${newsCategories.filter(c=>c!=='Все').map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>`)+'<p class="help-text">Название, текст и обложка берутся со страницы по ссылке.</p>',async data=>{
  const url=String(data.get('url')).trim();try{const parsed=new URL(url);if(!/^https?:$/.test(parsed.protocol))throw new Error();}catch{throw new Error('Введите корректную ссылку.');}
  const item=await articleMetaFromUrl(url);
  item.category=String(data.get('category')||'Другое');
  state.newsCustom=[item,...(state.newsCustom||[]).filter(entry=>entry.url!==url)].slice(0,80);
  persist();renderNews();toast('Новость добавлена');
});
$('#addNewsSource').onclick=()=>openEditor('Добавить источник',field('Название',input('name','','text','maxlength="80" placeholder="Можно оставить пустым"'))+field('Ссылка на сайт или RSS',input('url','','url','required placeholder="https://"')),async data=>{
  const url=String(data.get('url')).trim();try{const parsed=new URL(url);if(!/^https?:$/.test(parsed.protocol))throw new Error();}catch{throw new Error('Введите корректную ссылку.');}
  const name=String(data.get('name')).trim()||new URL(url).hostname.replace(/^www\./,'');
  const source={name,url};
  state.newsSources=[...(state.newsSources||[]).filter(item=>item.url!==url),source];persist();renderNews();
  toast('Источник добавлен, загружаю новости…');
  refreshNewsSource(source).then(count=>{if(count)toast(`Новости обновлены: ${count}`);});
});
function sourcesEditor(){
  const custom=(state.newsSources||[]).map((source,index)=>{const item=typeof source==='string'?(()=>{const [name,url]=source.split(' · ');return {name:name||url,url:url||''};})():source;return `<div class="manage-row"><span>${escapeHtml(item.name||'Источник')}</span><button class="text-btn" type="button" data-remove-source="${index}">Удалить</button></div>`;}).join('');
  openEditor('Мои источники',custom||empty('Пока добавлены только встроенные источники.'));
}
$('#manageSources').onclick=sourcesEditor;
document.addEventListener('click',e=>{const remove=e.target.closest('[data-remove-source]');if(remove){state.newsSources.splice(+remove.dataset.removeSource,1);persist();renderNews();toast('Источник удалён');sourcesEditor();}});
async function imageData(file) {
  if(!file || !file.size) return null;
  if(!file.type.startsWith('image/')) throw new Error('Выберите изображение.');
  const bitmap=await createImageBitmap(file), scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.86);
}
function probeVideoDuration(url) {
  return new Promise((resolve,reject)=>{
    const probe=document.createElement('video');probe.preload='metadata';probe.muted=true;
    let settled=false,timer=0;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);URL.revokeObjectURL(url);resolve(value);};
    const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);URL.revokeObjectURL(url);reject(new Error('Не удалось прочитать видео.'));};
    const check=()=>{if(Number.isFinite(probe.duration)&&probe.duration>0)finish(probe.duration);};
    probe.onerror=fail;
    probe.onloadedmetadata=()=>{
      check();
      if(settled)return;
      probe.ondurationchange=check;probe.onseeked=check;probe.ontimeupdate=check;
      try{probe.currentTime=1e101;}catch{fail();}
    };
    timer=setTimeout(()=>{check();if(!settled)fail();},4000);
    probe.src=url;
  });
}
async function videoData(file) {
  if(!file || !file.size) return null;
  if(!file.type.startsWith('video/')) throw new Error('Выберите видео.');
  if(file.size > 80*1024*1024) throw new Error('Видео должно быть не больше 80 МБ.');
  const duration=await probeVideoDuration(URL.createObjectURL(file));
  if(!Number.isFinite(duration)||duration<=0) throw new Error('Не удалось определить длительность видео.');
  if(duration > 60.5) throw new Error('Видео должно длиться не больше минуты.');
  const key=`profile-video-${uid()}`; await audioStore('put',key,file); return {key,duration:Math.min(duration,60)};
}
let profileVideoURL='';
async function profileMediaRender() {
  const video=$('#profileVideo'); if(!video) return;
  video.loop=true;video.muted=true;
  if(!state.profile.video){
    if(profileVideoURL){URL.revokeObjectURL(profileVideoURL);profileVideoURL='';}
    video.pause();video.removeAttribute('src');delete video.dataset.mediaKey;video.load();return;
  }
  if(video.dataset.mediaKey===state.profile.video&&profileVideoURL){
    video.play().catch(()=>{});
    return;
  }
  const key=state.profile.video,blob=await audioStore('get',key);if(!blob)return;
  if(profileVideoURL)URL.revokeObjectURL(profileVideoURL);
  profileVideoURL=URL.createObjectURL(blob);video.dataset.mediaKey=key;video.src=profileVideoURL;
  video.onloadedmetadata=()=>{video.currentTime=0;video.play().catch(()=>{});};
}
function releaseEditorPreview(){
  if(editorPreviewURL){URL.revokeObjectURL(editorPreviewURL);editorPreviewURL='';}
  const preview=$('#profileVideoPreview');
  if(preview){preview.onloadedmetadata=null;preview.removeAttribute('src');preview.load();}
}
function updateVideoHint(duration){
  const hint=$('#videoDurationHint');
  if(hint)hint.textContent=`Длительность видео: ${duration.toFixed(1)} сек. Оно будет проигрываться целиком.`;
}
function previewSelectedVideo(file){
  const wrap=$('#videoPreviewWrap'),preview=$('#profileVideoPreview');
  releaseEditorPreview();
  if(!wrap||!preview)return;
  wrap.hidden=true;
  if(!file?.size||!file.type.startsWith('video/'))return;
  editorPreviewURL=URL.createObjectURL(file);
  wrap.hidden=false;preview.src=editorPreviewURL;
  preview.onloadedmetadata=()=>{const value=preview.duration;if(Number.isFinite(value)&&value>0)updateVideoHint(value);};
  probeVideoDuration(URL.createObjectURL(file)).then(value=>{
    if(!editor.open||$('[name="video"]',editor)?.files?.[0]!==file)return;
    if(Number.isFinite(value)&&value>0)updateVideoHint(value);
  }).catch(()=>{});
}
async function loadProfileVideoPreview(){
  const wrap=$('#videoPreviewWrap'),preview=$('#profileVideoPreview');
  if(!wrap||!preview||!state.profile.video)return;
  const key=state.profile.video,blob=await audioStore('get',key);
  if(!editor.open||state.profile.video!==key||!blob)return;
  releaseEditorPreview();
  editorPreviewURL=URL.createObjectURL(blob);
  wrap.hidden=false;preview.src=editorPreviewURL;
  preview.onloadedmetadata=()=>{const value=preview.duration;if(Number.isFinite(value)&&value>0)updateVideoHint(value);};
  if(+state.profile.videoDuration>0)updateVideoHint(+state.profile.videoDuration);
}
let cropState={x:50,y:50,scale:1};
function applyPhotoCrop(){
  const crop=$('#photoCrop'),img=$('#photoCropImage');
  if(!crop||!img)return;
  img.style.objectPosition=`${cropState.x}% ${cropState.y}%`;
  img.style.transform=`scale(${cropState.scale})`;
}
function setCropSource(src,reset=false){
  const crop=$('#photoCrop'),img=$('#photoCropImage'),hint=$('#photoCropHint');
  if(!crop||!img)return;
  if(reset)cropState={x:50,y:50,scale:1};
  if(src){img.src=src;crop.classList.add('has-photo');if(hint)hint.hidden=true;}
  else{img.removeAttribute('src');crop.classList.remove('has-photo');if(hint)hint.hidden=false;}
  const scaleInput=$('#photoScale');if(scaleInput)scaleInput.value=cropState.scale;
  applyPhotoCrop();
}
function initPhotoCrop(){
  const crop=$('#photoCrop'),img=$('#photoCropImage');
  if(!crop||!img)return;
  cropState={x:Math.min(100,Math.max(0,+state.profile.photoX||50)),y:Math.min(100,Math.max(0,+state.profile.photoY||50)),scale:Math.min(2.5,Math.max(1,+state.profile.photoScale||1))};
  const scaleInput=$('#photoScale');
  if(scaleInput){scaleInput.value=cropState.scale;scaleInput.oninput=()=>{cropState.scale=+scaleInput.value;applyPhotoCrop();};}
  if(state.profile.photo)setCropSource(state.profile.photo,false);else setCropSource('',true);
  let dragging=false,startX=0,startY=0,originX=0,originY=0;
  crop.onpointerdown=e=>{
    if(!crop.classList.contains('has-photo'))return;
    dragging=true;startX=e.clientX;startY=e.clientY;originX=cropState.x;originY=cropState.y;
    crop.setPointerCapture(e.pointerId);crop.classList.add('dragging');e.preventDefault();
  };
  crop.onpointermove=e=>{
    if(!dragging)return;
    const rect=crop.getBoundingClientRect();
    cropState.x=Math.max(0,Math.min(100,originX-(e.clientX-startX)/rect.width*100));
    cropState.y=Math.max(0,Math.min(100,originY-(e.clientY-startY)/rect.height*100));
    applyPhotoCrop();
  };
  const stop=()=>{dragging=false;crop.classList.remove('dragging');};
  crop.onpointerup=stop;crop.onpointercancel=stop;
}
editor.addEventListener('change',e=>{
  if(e.target.matches('input[name="photo"]')){
    const file=e.target.files[0];
    if(file){
      const reader=new FileReader();
      reader.onload=()=>setCropSource(reader.result,true);
      reader.readAsDataURL(file);
    }
  }
  if(e.target.matches('input[name="video"]'))previewSelectedVideo(e.target.files[0]);
});
editor.addEventListener('close',()=>releaseEditorPreview());
function editProfile() {
  const duration=+state.profile.videoDuration||0;
  const durationHint=duration?`Длительность загруженного видео: ${duration.toFixed(1)} сек.`:'Видео ещё не загружено. Можно загрузить видео до минуты.';
  const scale=Math.min(2.5,Math.max(1,+state.profile.photoScale||1));
  const photoBlock='<div class="photo-editor"><div class="photo-crop" id="photoCrop"><img id="photoCropImage" alt="Область аватара"><span class="photo-crop-hint" id="photoCropHint">Перетащи фото, чтобы выбрать область</span></div><label class="photo-zoom">Масштаб<input type="range" id="photoScale" min="1" max="2.5" step="0.01" value="'+scale+'"></label><p class="help-text">Перетаскивай фотографию внутри круга и меняй масштаб — так она будет обрезана для аватара.</p></div>';
  const ownerAccount=isOwner(currentAccount);
  const ownerStatusField=ownerAccount?field('Статус (префикс)',input('status',state.profile.status||'✦ В своём ритме','text','maxlength="60"')):'';
  openEditor('Изменить профиль',ownerStatusField+field('Имя',input('name',state.profile.name,'text','required maxlength="80" autocomplete="name"'))+field('Псевдоним',input('alias',state.profile.alias,'text','required maxlength="32"'))+field('Фотография',input('photo','','file','accept="image/*"'))+photoBlock+field('Видео-фон',input('video','','file','accept="video/*"'))+`<p class="help-text" id="videoDurationHint">${durationHint} Видео будет проигрываться целиком, без обрезки.</p>`+'<div class="video-preview" id="videoPreviewWrap" hidden><video id="profileVideoPreview" muted playsinline controls></video></div>'+'<label class="checkbox-label"><input type="checkbox" name="removePhoto"> Удалить фото</label><label class="checkbox-label"><input type="checkbox" name="removeVideo"> Удалить видео</label>',async data=>{
    const name=String(data.get('name')).trim();if(!name)throw new Error('Введите имя.');
    const newAlias=String(data.get('alias')).trim().replace(/^@/,'');
    if(!newAlias)throw new Error('Введите псевдоним.');
    if(CLOUD_ENABLED&&currentAccount&&(normalizeAlias(newAlias)!==normalizeAlias(currentAccount.alias)||name!==currentAccount.name)){
      try{
        const updated=await cloudRpc('sphere_account_update',{p_id:currentAccount.id,p_token:currentAccount.token,p_name:name,p_alias:newAlias});
        currentAccount.name=updated.name||name;
        currentAccount.alias=updated.alias||normalizeAlias(newAlias);
        cacheCloudAccount(currentAccount);
      }catch(error){
        if(String(error.code||'').toLowerCase()==='alias_taken')throw new Error('Такой псевдоним уже занят. Выбери другой.');
        if(String(error.code||'').toLowerCase()==='alias_invalid')throw new Error('Псевдоним должен быть от 3 до 32 символов без пробелов.');
        throw error;
      }
    }
    const newPhoto=await imageData(data.get('photo'));
    const removePhoto=data.has('removePhoto');
    const photo=removePhoto&&!newPhoto?'':(newPhoto||state.profile.photo);
    const videoFile=data.get('video');
    let video=state.profile.video,videoDuration=+state.profile.videoDuration||0;
    if(data.has('removeVideo')){video='';videoDuration=0;}
    else if(videoFile?.size){const info=await videoData(videoFile);video=info.key;videoDuration=info.duration;}
    const previousVideo=state.profile.video;
    const newStatus=ownerAccount?(String(data.get('status')).trim()||'✦ В своём ритме'):state.profile.status;
    state.profile={...state.profile,name,alias:newAlias,status:newStatus,photo,photoX:photo?cropState.x:50,photoY:photo?cropState.y:50,photoScale:photo?cropState.scale:1,video,videoStart:0,videoEnd:0,videoDuration:video?videoDuration:0};
    if(previousVideo&&previousVideo!==video)audioStore('delete',previousVideo).catch(()=>{});
    logAction('обновил профиль',name);
    saveAndRender();toast('Профиль сохранён');
  });
  initPhotoCrop();
  loadProfileVideoPreview();
}
$$('[data-profile-tool="edit"]').forEach(b=>b.onclick=editProfile);
$$('[data-profile-tool="layout"]').forEach(b=>b.onclick=()=>{
  const next=state.profile.layout==='row'?'card':'row';
  const toggle=()=>{state.profile.layout=next;persist();renderProfile();};
  if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.startViewTransition(toggle);
  }else if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const card=$('#profileCard');
    card.classList.add('layout-switching');
    setTimeout(()=>{toggle();requestAnimationFrame(()=>card.classList.remove('layout-switching'));},170);
  }else toggle();
  toast(next==='row'?'Компактный вид профиля':'Стандартный вид профиля');
});

function renderHabits() {
  $$('.habit-card>.habit-row').forEach(el=>el.remove());
  $('.habit-card').insertAdjacentHTML('beforeend',state.habits.length?state.habits.map(h=>`<div class="habit-row"><span class="habit-icon blue">◒</span><div><strong>${escapeHtml(h.name)}</strong><span>${h.days.length} дней отмечено</span></div><button class="habit-check ${h.days.includes(today())?'done':''}" data-action="habit-toggle" data-id="${h.id}" aria-label="${escapeHtml(h.name)}" aria-pressed="${h.days.includes(today())}">${h.days.includes(today())?'✓':'○'}</button></div>`).join(''):empty('Добавь полезную привычку.'));
}
$('#habitMore').onclick=()=>openEditor('Мои привычки',state.habits.map(h=>`<div class="manage-row">${escapeHtml(h.name)}${button('habit-delete',h.id,'Удалить','text-btn')}</div>`).join('')+field('Новая привычка',input('name','','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');const habit={id:uid(),name,days:[]};state.habits.push(habit);logAction('добавил привычку',name,habit.id);saveAndRender();},'Добавить');
$('#openFavorites').onclick=()=>{showView('music');selectedPlaylist='favorites';renderMusic();};
$('#noteBtn').onclick=()=>openEditor('Быстрая заметка',field('Твои идеи',`<textarea name="note" rows="10" maxlength="20000">${escapeHtml(state.note)}</textarea>`),data=>{state.note=String(data.get('note'));logAction('сохранил заметку',`${state.note.length} символов`);persist();toast('Заметка сохранена');});
$('#quoteBtn').onclick=()=>{ const index=(Number($('#quoteBtn').dataset.index||0)+1)%compliments.length;$('#quoteBtn').dataset.index=index;$('.quote-card p').textContent=compliments[index];$('.quote-card>span').textContent='— Напоминание себе'; };

let focusRemaining=1500,focusEnd=0,focusRunning=false,breathStart=0;
function timerText(seconds) { return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`; }
function focusDialog() {
  openEditor('Фокус-таймер',`<p class="help-text">25 минут на одну задачу. Завершено сессий: ${state.sessions}</p><div class="timer" id="liveTimer">${timerText(focusRemaining)}</div><div class="tool-controls">${button('timer-toggle','',focusRunning?'Пауза':'Начать','primary-btn')}${button('timer-reset','','Сбросить')}</div>`);
}
$('#pomodoroBtn').onclick=focusDialog;
$('#breathBtn').onclick=()=>{breathStart=Date.now();openEditor('Две минуты на себя','<div class="breath-circle" id="breathCircle">Вдох</div><p id="breathText" class="help-text">Медленный вдох — 4 секунды, выдох — 6 секунд.</p>');};
editor.addEventListener('close',()=>{breathStart=0;});
setInterval(()=>{
  if(focusRunning){focusRemaining=Math.max(0,Math.ceil((focusEnd-Date.now())/1000));if(focusRemaining===0){focusRunning=false;state.sessions++;persist();toast('Фокус-сессия завершена. Сделай перерыв!');if($('#liveTimer'))focusDialog();}if($('#liveTimer'))$('#liveTimer').textContent=timerText(focusRemaining);}
  if(breathStart&&$('#breathCircle')) {const elapsed=(Date.now()-breathStart)/1000;const inhale=elapsed%10<4;$('#breathCircle').textContent=elapsed>=120?'Готово':inhale?'Вдох':'Выдох';$('#breathCircle').classList.toggle('inhale',inhale);$('#breathText').textContent=elapsed>=120?'Перезагрузка завершена. Возвращайся в своём темпе.':`Осталось ${Math.ceil(120-elapsed)} сек. · ${inhale?'Вдох 4 секунды':'Выдох 6 секунд'}`;if(elapsed>=120)breathStart=0;}
},250);
setInterval(updateClock,15000);
// Real-time clock: refreshes the time display every 1 ms (only DOM write when the string changes).
let _clockFmt=null;
function tickLiveClock(){
  const el=$('#liveClock'); if(!el) return;
  if(!currentAccount){ el.textContent='--:--:--'; return; }
  if(!_clockFmt||_clockFmt.zone!=='local'){ _clockFmt={zone:'local',fmt:new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}; }
  const text=_clockFmt.fmt.format(new Date());
  if(el.textContent!==text) el.textContent=text;
}
setInterval(tickLiveClock,1000);

// Audio blobs persist in IndexedDB, metadata in localStorage.
let dbPromise;
function audioDB() {
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('sphere-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('audio');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Не удалось открыть хранилище аудио.'));});
  return dbPromise;
}
async function audioStore(mode,key,value) {
  const db=await audioDB();return new Promise((resolve,reject)=>{const tx=db.transaction('audio',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('audio');const req=mode==='get'?store.get(key):mode==='put'?store.put(value,key):store.delete(key);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
// Read ID3v2 APIC for the original embedded MP3 cover, without replacing it with a random picture.
async function embeddedCover(file) {
  const buffer=await file.slice(0,8*1024*1024).arrayBuffer(),bytes=new Uint8Array(buffer),view=new DataView(buffer);
  if(bytes.length<10||new TextDecoder().decode(bytes.slice(0,3))!=='ID3'||![3,4].includes(bytes[3]))return '';
  const sync=offset=>(bytes[offset]<<21)|(bytes[offset+1]<<14)|(bytes[offset+2]<<7)|bytes[offset+3];
  const end=Math.min(bytes.length,10+sync(6));let offset=10;
  if(bytes[5]&64)offset+=bytes[3]===4?sync(offset):4+view.getUint32(offset);
  while(offset+10<=end){const id=new TextDecoder().decode(bytes.slice(offset,offset+4)),size=bytes[3]===4?sync(offset+4):view.getUint32(offset+4);if(!size||offset+10+size>end)break;
    if(id==='APIC'){const data=bytes.slice(offset+10,offset+10+size),encoding=data[0];let pos=1;while(pos<data.length&&data[pos])pos++;const mime=new TextDecoder().decode(data.slice(1,pos));pos+=2;
      if(encoding===1||encoding===2){while(pos+1<data.length&&(data[pos]||data[pos+1]))pos+=2;pos+=2;}else{while(pos<data.length&&data[pos])pos++;pos++;}
      if(mime.startsWith('image/')&&pos<data.length){try{return await imageData(new Blob([data.slice(pos)],{type:mime}));}catch{return '';}}
    }offset+=10+size;
  }return '';
}
const audio=new Audio();audio.preload='metadata';let objectURL='',playGeneration=0,embedPlaying=false;
let audioContext=null,analyserNode=null,mediaSourceNode=null,mediaStream=null,captureTimer=0,fakeAuraTimer=0,vizRAF=0,vizFreq=null,vizBpm=0,vizBeatAvg=0,vizLastOnset=0,vizOnsets=[],vizSilent=0,vizBeatPulse=0,vizEnergy=0;
function trackHash(track){return [...String(track?.id||track?.title||'')].reduce((hash,char)=>((hash<<5)-hash+char.charCodeAt(0))|0,0)>>>0;}
function syntheticMeta(track){return {bpm:88+trackHash(track)%55};}
function connectAudioStream(){
  if(typeof audio.captureStream!=='function')return false;
  try{
    mediaSourceNode?.disconnect();
    mediaStream=audio.captureStream();
    if(!mediaStream||!mediaStream.getAudioTracks().length)return false;
    mediaSourceNode=audioContext.createMediaStreamSource(mediaStream);
    mediaSourceNode.connect(analyserNode);
    return true;
  }catch{return false;}
}
function ensureAudioGraph(){
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!audioContext){
    if(!Ctx)return false;
    try{
      audioContext=new Ctx();analyserNode=audioContext.createAnalyser();analyserNode.fftSize=2048;analyserNode.smoothingTimeConstant=.8;
      vizFreq=new Uint8Array(analyserNode.frequencyBinCount);
      const silent=audioContext.createGain();silent.gain.value=0;
      analyserNode.connect(silent);silent.connect(audioContext.destination);
    }catch{return false;}
  }
  const track=mediaStream?.getAudioTracks?.()[0];
  if(!track||track.readyState==='ended'||audio.currentTime<0.2){
    clearTimeout(captureTimer);
    captureTimer=setTimeout(()=>{connectAudioStream();},320);
  }
  if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  return true;
}
function auraHue(){
  return 228;
}
function setAuraVars(bpm,energy=0.45){
  const hero=$('#musicHero');if(!hero)return;
  const hue=auraHue();
  if(hero.dataset.auraHue!==String(hue)){
    hero.style.setProperty('--aura-hue',hue);
    hero.style.setProperty('--aura-hue2',(hue+72)%360);
    hero.dataset.auraHue=String(hue);
  }
  const speed=`${Math.max(1.6,260/Math.max(60,bpm)).toFixed(2)}s`;
  if(hero.dataset.auraSpeed!==speed){hero.style.setProperty('--aura-speed',speed);hero.dataset.auraSpeed=speed;}
  const value=String(Math.round(Math.min(1,Math.max(.18,energy))*100)/100);
  if(hero.dataset.auraEnergy!==value){hero.style.setProperty('--aura-energy',value);hero.dataset.auraEnergy=value;}
  const meta=$('#musicMeta');if(meta){const label=bpm?`${Math.round(bpm)} BPM`:'';if(meta.textContent!==label)meta.textContent=label;}
}
function startAura(track,{synthetic=false}={}){
  const hero=$('#musicHero');if(!hero||!track)return;
  clearInterval(fakeAuraTimer);fakeAuraTimer=0;
  document.body.classList.add('music-reactive');hero.classList.add('aura-on');
  const fallback=syntheticMeta(track);
  vizEnergy=.42;vizBeatPulse=0;
  setAuraVars(fallback.bpm,.42);
  if(synthetic||!ensureAudioGraph()){
    clearInterval(fakeAuraTimer);
    fakeAuraTimer=setInterval(()=>{
      if(!embedPlaying&&audio.paused){clearInterval(fakeAuraTimer);fakeAuraTimer=0;return;}
      vizBeatPulse=vizBeatPulse>.12?0:1;
      setAuraVars(fallback.bpm,.42);
    },Math.max(220,60000/Math.max(60,fallback.bpm)/2));
    return;
  }
  cancelAnimationFrame(vizRAF);vizBpm=0;vizOnsets=[];vizLastOnset=0;vizBeatAvg=0;vizSilent=0;vizBeatPulse=0;vizEnergy=.42;
  const loop=()=>{
    if(audio.paused){vizRAF=0;return;}
    analyserNode.getByteFrequencyData(vizFreq);
    let bass=0,total=0;const length=vizFreq.length;
    for(let i=0;i<length;i++){const value=vizFreq[i];total+=value;if(i<8)bass+=value;}
    bass/=8;const energy=total/length/255;
    const now=performance.now();
    if(bass>vizBeatAvg*1.18&&now-vizLastOnset>190){vizOnsets.push(now);if(vizOnsets.length>18)vizOnsets.shift();vizLastOnset=now;vizBeatPulse=1;}
    vizBeatAvg=vizBeatAvg?vizBeatAvg*.93+bass*.07:bass;vizBeatPulse*=.9;
    vizEnergy=vizEnergy?vizEnergy*.88+energy*.12:energy;
    if(vizOnsets.length>=5){
      const intervals=vizOnsets.slice(1).map((time,index)=>time-vizOnsets[index]).sort((a,b)=>a-b);
      const median=intervals[Math.floor(intervals.length/2)];
      if(median>0){let bpm=60000/median;while(bpm<70)bpm*=2;while(bpm>170)bpm/=2;vizBpm=vizBpm?vizBpm*.9+bpm*.1:bpm;}
    }
    setAuraVars(vizBpm||fallback.bpm,vizEnergy);
    if(total===0&&++vizSilent>100){setAuraVars(fallback.bpm,.35);vizRAF=0;return;}
    vizRAF=requestAnimationFrame(loop);
  };
  vizRAF=requestAnimationFrame(loop);
}
function stopAura(){
  cancelAnimationFrame(vizRAF);vizRAF=0;clearInterval(fakeAuraTimer);fakeAuraTimer=0;
  document.body.classList.remove('music-reactive');$('#musicHero')?.classList.remove('aura-on');
  const hero=$('#musicHero');if(hero){delete hero.dataset.auraHue;delete hero.dataset.auraSpeed;delete hero.dataset.auraEnergy;}
  const meta=$('#musicMeta');if(meta)meta.textContent='';
}
function coverMarkup(track,cls='track-cover') {return track?.cover?`<img class="${cls}" src="${escapeHtml(track.cover)}" alt="Обложка ${escapeHtml(track.title)}">`:`<span class="${cls} no-cover" title="Обложка не добавлена">♪</span>`;}
function renderMusic() {
  $('#musicHero').classList.toggle('empty-player', !currentTrack);
  $('#playlistGrid').innerHTML=state.playlists.length?state.playlists.map(p=>`<article class="playlist-card ${p.id===selectedPlaylist?'selected':''}"><strong>${escapeHtml(p.name)}</strong><small>${state.tracks.filter(t=>t.playlist===p.id).length} треков</small><div class="tool-controls">${button('playlist-open',p.id,'Открыть','text-btn')}${button('track-add',p.id,'+ Трек','text-btn')}${button('playlist-edit',p.id,'✎','row-btn')}${button('playlist-delete',p.id,'×','row-btn')}</div></article>`).join(''):'';
  let list=selectedPlaylist==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist);
  // Внутри открытого плейлиста показываем весь список, а фильтр категорий работает только в общей фонотеке.
  if(musicSort!=='new'&&!selectedPlaylist)list=list.filter(t=>t.hit===musicSort);
  list=[...list].sort((a,b)=>b.created-a.created);
  const playlist=state.playlists.find(p=>p.id===selectedPlaylist);
  $('#trackCount').textContent=`${list.length} треков`;
  $('#trackList').innerHTML=(selectedPlaylist?`<div class="manage-row"><strong>${escapeHtml(selectedPlaylist==='favorites'?'Любимые треки':playlist?.name||'')}</strong>${button('playlist-all','','Все плейлисты','text-btn')}</div>`:'')+(list.length?list.map(t=>`<div class="track-row">${coverMarkup(t)}<div class="track-info"><div class="task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.artist||'Исполнитель не указан')}${t.service?` · ${escapeHtml(t.service)}`:''}</small></div><div class="track-controls"><button class="heart-btn ${t.favorite?'liked':''}" data-action="track-favorite" data-id="${t.id}" aria-label="${t.favorite?'Убрать из любимых':'Добавить в любимые'}">${t.favorite?'♥':'♡'}</button><select class="hit-select" data-track="${t.id}" aria-label="Категория ${escapeHtml(t.title)}">${Object.entries(hits).map(([key,label])=>`<option value="${key}" ${key===t.hit?'selected':''}>${label}</option>`).join('')}</select>${button('track-play',t.id,currentTrack===t.id&&(embedPlaying||!audio.paused)?'Ⅱ':'▶','row-btn')}${t.sourceUrl?`<a class="row-btn track-source" href="${escapeHtml(t.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="Открыть источник">↗</a>`:''}${button('track-edit',t.id,'✎','row-btn')}${button('track-delete',t.id,'×','row-btn')}</div></div></div>`).join(''):(selectedPlaylist==='favorites'?empty('Ты пока не отметил ни одного трека сердечком.'):''));
}
function playlistEditor(id) {
  const playlist=state.playlists.find(p=>p.id===id);
  openEditor(playlist?'Название плейлиста':'Новый плейлист',field('Название',input('name',playlist?.name||'','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');if(playlist){playlist.name=name;logAction('переименовал плейлист',`«${name}»`,playlist.id);}else{const id=uid();state.playlists.push({id,name});selectedPlaylist=id;logAction('создал плейлист',`«${name}»`,id);}saveAndRender();});
}
$('#createPlaylist').onclick=()=>playlistEditor(null);
$('#addTrack').onclick=()=>addTrackDialog('');
function trackMetaFromFileName(name){
  const base=String(name||'').replace(/\.[a-z0-9]{2,5}$/i,'').trim();
  const parts=base.split(/\s+[–—-]\s+/);
  if(parts.length>1){
    const artist=parts.pop().trim();
    const title=parts.join(' - ').trim();
    return {title:title||base,artist};
  }
  return {title:base,artist:''};
}
function addTrackDialog(playlistId){
  if(!state.playlists.length){
    state.playlists.push({id:uid(),name:'Моя музыка'});
    persist();
    renderMusic();
  }
  const playlists=state.playlists;
  const target=playlistId||(selectedPlaylist&&selectedPlaylist!=='favorites'?selectedPlaylist:'')||playlists[0].id;
  openEditor('Добавить трек',
    field('Аудиофайлы',`<input name="audio" type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac,.aac,.opus" multiple required>`)+
    field('Плейлист',`<select name="playlist">${playlists.map(p=>`<option value="${p.id}" ${p.id===target?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select>`)+
    field('Категория',`<select name="hit">${Object.entries(hits).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select>`)+
    '<p class="help-text">Можно выбрать несколько файлов. Название и исполнитель берутся из имени файла в формате «Название - артист».</p>',
    async data=>{
      const files=[...data.getAll('audio')].filter(file=>file instanceof File&&file.size);
      if(!files.length)throw new Error('Выберите хотя бы один аудиофайл.');
      if(files.length>50)throw new Error('За один раз можно добавить не больше 50 файлов.');
      for(const file of files){
        if(file.size>150*1024*1024)throw new Error(`Файл «${file.name}» больше 150 МБ.`);
        if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav|flac|aac|opus)$/i.test(file.name))throw new Error(`Файл «${file.name}» не является аудиофайлом.`);
      }
      const playlist=String(data.get('playlist')),hit=String(data.get('hit')),addedTracks=[];
      for(const file of files){
        const id=uid(),meta=trackMetaFromFileName(file.name),cover=await embeddedCover(file).catch(()=>'');
        await audioStore('put',id,file);
        addedTracks.push({id,title:meta.title,artist:meta.artist,playlist,hit,favorite:false,created:Date.now()+addedTracks.length,cover});
      }
      state.tracks.push(...addedTracks);
      selectedPlaylist=playlist;
      const playlistName=playlists.find(item=>item.id===playlist)?.name||'';
      logAction('добавил треки',`${addedTracks.length} шт. · ${playlistName}`,addedTracks[0]?.id||'');
      saveAndRender();
      toast(addedTracks.length===1?'Трек добавлен':`Добавлено треков: ${addedTracks.length}`);
    },'Добавить');
}
async function editTrack(id,playlistId) {
  const track=state.tracks.find(t=>t.id===id),playlists=state.playlists;
  if(!playlists.length){playlistEditor(null);return;}
  openEditor('Изменить трек',
    field('Название',input('title',track?.title||'','text','required maxlength="160"'))+field('Исполнитель',input('artist',track?.artist||'','text','maxlength="120"'))+
    field('Плейлист',`<select name="playlist">${playlists.map(p=>`<option value="${p.id}" ${p.id===(track?.playlist||playlistId)?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select>`)+
    field('Заменить аудиофайл (необязательно)',input('audio','','file','accept="audio/*"'))+
    (track?.sourceUrl?`<p class="help-text">Источник: <a class="source-link" href="${escapeHtml(track.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(track.service||track.sourceUrl)}</a></p>`:'<p class="help-text">Для MP3 обложка читается из ID3 автоматически.</p>')+
    field('Категория',`<select name="hit">${Object.entries(hits).map(([key,label])=>`<option value="${key}" ${key===(track?.hit||'')?'selected':''}>${label}</option>`).join('')}</select>`),async data=>{
      const title=String(data.get('title')).trim(),file=data.get('audio'),id=track?.id||uid();if(!title)throw new Error('Введите название.');
      if(file?.size>150*1024*1024)throw new Error('Максимальный размер аудиофайла — 150 МБ.');
      let cover=track?.cover||'';
      if(file?.size){if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav|flac)$/i.test(file.name))throw new Error('Выберите аудиофайл.');cover=await embeddedCover(file)||cover;await audioStore('put',id,file);}
      const record={...track,id,title,artist:String(data.get('artist')).trim(),playlist:String(data.get('playlist')),hit:String(data.get('hit')),cover,created:track?.created||Date.now(),favorite:!!track?.favorite,audioUrl:file?.size?'':track?.audioUrl};
      if(track)state.tracks[state.tracks.indexOf(track)]=record;else state.tracks.push(record);
      logAction(track?'изменил трек':'добавил трек',`«${title}»${record.artist?` · ${record.artist}`:''}`,id);
      saveAndRender();toast('Трек сохранён');
    });
}
function playEmbed(track){
  audio.pause();if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}
  currentTrack=track.id;embedPlaying=true;
  $('#nowPlayingTitle').textContent=track.title;$('#nowPlayingArtist').textContent=`${track.artist||'Исполнитель не указан'}${track.service?` · ${track.service}`:''}`;
  $('.album-art').innerHTML=`<iframe class="music-embed" src="${escapeHtml(track.embedUrl)}" title="${escapeHtml(track.title)}" allow="autoplay; encrypted-media; fullscreen; clipboard-write" loading="lazy"></iframe>`;
  $('#musicHero').classList.remove('empty-player');$('#musicHero').classList.add('embed-playing');
  $('#musicCurrent').textContent='—';$('#musicDuration').textContent='—';$('#musicProgress').style.width='0%';$('#playBtn').textContent='Ⅱ';
  const bar=$('#musicProgressBar');if(bar){bar.classList.add('disabled');bar.setAttribute('aria-valuemax','0');bar.setAttribute('aria-valuenow','0');bar.setAttribute('aria-valuetext','Встроенный плеер');}
  startAura(track,{synthetic:true});renderMusic();
  toast('Трек открыт во встроенном плеере сервиса.');
}
async function playTrack(id) {
  if(currentTrack===id&&(embedPlaying||audio.src)){
    if(embedPlaying){stopCurrentTrack();return;}
    if(audio.paused){try{await audio.play();startAura(state.tracks.find(t=>t.id===id));}catch{toast('Не удалось воспроизвести файл.',true);}}
    else audio.pause();
    return;
  }
  const track=state.tracks.find(t=>t.id===id);if(!track)return;
  if(track.embedUrl&&!track.audioUrl){playEmbed(track);return;}
  const generation=++playGeneration;
  try{
    let src=track.audioUrl||'',fromBlob=false;
    if(!src){
      const blob=await audioStore('get',id);if(generation!==playGeneration)return;
      if(!blob){if(track.sourceUrl){toast('Прямой аудиопоток недоступен. Открой источник по ссылке ↗',true);return;}throw new Error('Аудиофайл не найден. Добавь его повторно.');}
      src=URL.createObjectURL(blob);fromBlob=true;
    }
    audio.pause();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=fromBlob?src:'';audio.src=src;currentTrack=id;embedPlaying=false;$('#musicProgressBar')?.classList.remove('disabled');
    $('#nowPlayingTitle').textContent=track.title;$('#nowPlayingArtist').textContent=track.artist||'Исполнитель не указан';$('.album-art').innerHTML=coverMarkup(track,'playing-cover');$('#musicHero').classList.remove('empty-player','embed-playing');await audio.play();startAura(track);
  }catch(error){stopAura();toast(error.message||'Не удалось воспроизвести трек.',true);}
}
function nextTrack(direction) {let list=selectedPlaylist==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist);if(musicSort!=='new'&&!selectedPlaylist)list=list.filter(t=>t.hit===musicSort);if(!list.length){toast(selectedPlaylist==='favorites'?'В любимых пока нет треков.':'Добавь треки в плейлист.');return;}const index=list.findIndex(t=>t.id===currentTrack);playTrack(list[(index+direction+list.length)%list.length].id);}
$('#playBtn').onclick=()=>currentTrack?playTrack(currentTrack):nextTrack(1);$('#prevTrack').onclick=()=>nextTrack(-1);$('#nextTrack').onclick=()=>nextTrack(1);
audio.onplay=()=>{$('#playBtn').textContent='Ⅱ';renderMusic();};audio.onpause=()=>{$('#playBtn').textContent='▶';if(!embedPlaying)stopAura();renderMusic();};audio.onended=()=>{stopAura();nextTrack(1);};audio.onerror=()=>{stopAura();toast('Формат аудио не поддерживается или файл повреждён.',true);};
function musicProgressUpdate(){
  const duration=Number.isFinite(audio.duration)?audio.duration:0;
  const current=Math.min(audio.currentTime||0,duration||0);
  const percent=duration?current/duration*100:0;
  $('#musicCurrent').textContent=timerText(Math.floor(current));
  $('#musicDuration').textContent=duration?timerText(Math.floor(duration)):'0:00';
  $('#musicProgress').style.width=percent+'%';
  const bar=$('#musicProgressBar');
  if(bar){
    bar.setAttribute('aria-valuemax',String(Math.round(duration)));
    bar.setAttribute('aria-valuenow',String(Math.round(current)));
    bar.setAttribute('aria-valuetext',`${timerText(Math.floor(current))} из ${timerText(Math.floor(duration))}`);
    bar.title=duration?'Нажми или перетащи, чтобы перемотать':'Перемотка появится после загрузки трека';
  }
}
audio.ontimeupdate=musicProgressUpdate;
audio.onloadedmetadata=musicProgressUpdate;
const musicProgressBar=$('#musicProgressBar');
let musicSeeking=false;
function seekMusicAt(event){
  if(embedPlaying||!audio.src)return false;
  const duration=audio.duration;
  if(!Number.isFinite(duration)||duration<=0)return false;
  const box=musicProgressBar.getBoundingClientRect();
  const ratio=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
  audio.currentTime=ratio*duration;
  musicProgressUpdate();
  return true;
}
if(musicProgressBar){
  musicProgressBar.addEventListener('pointerdown',e=>{
    if(embedPlaying){toast('Во встроенном плеере перемотка управляется сервисом.');return;}
    if(!seekMusicAt(e))return;
    musicSeeking=true;musicProgressBar.classList.add('seeking');
    try{musicProgressBar.setPointerCapture(e.pointerId);}catch{}
    e.preventDefault();
  });
  musicProgressBar.addEventListener('pointermove',e=>{if(musicSeeking)seekMusicAt(e);});
  const endSeek=e=>{if(!musicSeeking)return;musicSeeking=false;musicProgressBar.classList.remove('seeking');try{musicProgressBar.releasePointerCapture(e.pointerId);}catch{}};
  musicProgressBar.addEventListener('pointerup',endSeek);
  musicProgressBar.addEventListener('pointercancel',endSeek);
  musicProgressBar.addEventListener('keydown',e=>{
    if(embedPlaying)return;
    const duration=audio.duration;
    if(!audio.src||!Number.isFinite(duration)||duration<=0)return;
    if(e.key==='Home'){audio.currentTime=0;musicProgressUpdate();e.preventDefault();return;}
    if(e.key==='End'){audio.currentTime=Math.max(0,duration-.25);musicProgressUpdate();e.preventDefault();return;}
    const step=e.key==='ArrowRight'?5:e.key==='ArrowLeft'?-5:0;
    if(!step)return;
    audio.currentTime=Math.max(0,Math.min(duration,audio.currentTime+step));
    musicProgressUpdate();e.preventDefault();
  });
  musicProgressBar.title='Нажми или перетащи, чтобы перемотать';
}
musicProgressUpdate();
$('#musicSort').onclick=()=>{const modes=['new','day','week','month','year'];musicSort=modes[(modes.indexOf(musicSort)+1)%modes.length];$('#musicSort').textContent=musicSort==='new'?'Все · сначала новые':hits[musicSort];renderMusic();};
document.addEventListener('change',e=>{if(e.target.matches('.hit-select')){const track=state.tracks.find(t=>t.id===e.target.dataset.track);if(track){track.hit=e.target.value;persist();renderMusic();}}});

// Settings only expose actions that have a real local implementation.
$('.preferences').innerHTML=`<div class="preference-row" id="accountPreference"></div><div class="preference-row"><div><strong>Утренний план</strong><span>Показывать напоминание при открытии после 08:00</span></div><button class="toggle" data-setting="morning" aria-label="Утренний план"><i></i></button></div><div class="preference-row"><div><strong>Звук выполнения</strong><span>Короткий сигнал при завершении задачи</span></div><button class="toggle" data-setting="sound" aria-label="Звук выполнения"><i></i></button></div><div class="preference-row"><div><strong>Фокус-режим</strong><span>Скрывать колокольчик напоминаний</span></div><button class="toggle" data-setting="focus" aria-label="Фокус-режим"><i></i></button></div><div id="securityPreferences"></div><div class="preference-row"><div><strong>Хранение данных</strong><span>${CLOUD_ENABLED?'Синхронизируется с облаком Supabase. Аудио и видео — в этом браузере.':'Автоматически в этом браузере. Аудио и видео — в IndexedDB.'}</span></div>${button('export','','Экспорт данных')}</div>`;
function renderSettings(){
  $$('[data-setting]').forEach(el=>{el.classList.toggle('on',state.settings[el.dataset.setting]);el.setAttribute('aria-pressed',String(state.settings[el.dataset.setting]));});
  $('#notificationsBtn').hidden=state.settings.focus;
  const security=$('#securityPreferences');
  if(security)security.innerHTML=cloudSessionActive()?`<div class="preference-row"><div><strong>Пароль</strong><span>Сменить пароль от аккаунта</span></div><button class="secondary-btn" data-action="change-password">Сменить</button></div><div class="preference-row"><div><strong>Код восстановления</strong><span>Постоянный код, который вы задаёте сами</span></div><button class="secondary-btn" data-action="set-recovery">Задать</button></div>`:'';
  const account=$('#accountPreference');
  if(account)account.innerHTML=currentAccount?`<div><strong>Аккаунт</strong><span>${escapeHtml(currentAccount.email)} · @${escapeHtml(currentAccount.alias)}</span></div><button class="secondary-btn" data-action="logout">Выйти</button>`:'';
}
function updateSettingsCity(){ const el=$('#settingsWeatherCity'); if(el)el.textContent=state.weather.city; }
$$('[data-setting]').forEach(el=>el.onclick=()=>{state.settings[el.dataset.setting]=!state.settings[el.dataset.setting];logAction('изменил настройки',`${el.getAttribute('aria-label')}: ${state.settings[el.dataset.setting]?'вкл':'выкл'}`);persist();renderSettings();});
function completionSound(){if(!state.settings.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.07,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);osc.start();osc.stop(ctx.currentTime+.22);osc.onended=()=>ctx.close();}catch{}}

// --- Owner-only admin database -------------------------------------------
let adminSearch='',adminUsers=[],adminEvents=[],adminLoadedAt=0,adminRefreshSeq=0;
const formatAdminDate=value=>value?new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}):'—';
const formatAdminDateTime=value=>value?new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const adminInitials=account=>String(account?.name||account?.alias||account?.email||'?').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
function updateAdminAccess(){
  const owner=isOwner(currentAccount),nav=$('#adminNav');
  if(nav)nav.hidden=!owner;
  if(!owner&&activeView==='admin')showView('overview');
  const count=$('#adminNavCount');
  if(count&&owner)count.textContent=CLOUD_ENABLED?adminUsers.length:accounts.length;
  if(owner&&CLOUD_ENABLED&&Date.now()-adminLoadedAt>5000)refreshAdminData();
}
async function refreshAdminData(){
  if(!cloudSessionActive()||!isOwner(currentAccount))return;
  const seq=++adminRefreshSeq;
  adminLoadedAt=Date.now();
  try{
    const [users,events]=await Promise.all([
      cloudRpc('sphere_admin_users',{p_id:currentAccount.id,p_token:currentAccount.token}),
      cloudRpc('sphere_admin_events',{p_id:currentAccount.id,p_token:currentAccount.token,p_limit:200})
    ]);
    if(seq!==adminRefreshSeq)return;
    adminUsers=Array.isArray(users)?users:[];
    adminEvents=Array.isArray(events)?events:[];
    const count=$('#adminNavCount');if(count)count.textContent=adminUsers.length;
    if(activeView==='admin'&&isOwner(currentAccount))renderAdminCached();
  }catch(error){
    if(!error.cloudUnavailable&&Date.now()-cloudWarnedAt>15000){
      cloudWarnedAt=Date.now();toast(error.message,true);
    }
  }
}
function renderAdminStats(){
  const box=$('#adminStats');if(!box)return;
  const source=CLOUD_ENABLED?adminUsers:accounts;
  const warnings=CLOUD_ENABLED
    ?adminUsers.reduce((sum,account)=>sum+(+account.warnings||0),0)
    :Object.values(adminDb.users).reduce((sum,record)=>sum+(record.warnings?.length||0),0);
  const midnight=new Date();midnight.setHours(0,0,0,0);
  const active=source.filter(account=>{
    const lastSeen=CLOUD_ENABLED?(+account.lastSeen||0):(adminDb.users[account.id]?.lastSeen||0);
    return lastSeen>=midnight.getTime();
  }).length;
  const stats=[
    ['◉','ПОЛЬЗОВАТЕЛИ',source.length,'Всего аккаунтов'],
    ['⌁','АКТИВНЫ СЕГОДНЯ',active,'Заходили в Сферу'],
    ['⚑','ПРЕДУПРЕЖДЕНИЯ',warnings,'Выдано пользователям'],
    ['▤','СОБЫТИЯ',CLOUD_ENABLED?adminEvents.length:adminDb.events.length,'Записей в журнале']
  ];
  box.innerHTML=stats.map(([icon,label,value,note])=>`<article class="admin-stat"><span class="admin-stat-icon">${icon}</span><div><small>${label}</small><strong>${value}</strong><span>${note}</span></div></article>`).join('');
}
function renderAdminUsers(){
  const box=$('#adminUserList');if(!box)return;
  const source=CLOUD_ENABLED?adminUsers:accounts;
  const query=adminSearch.trim().toLowerCase();
  const list=[...source].filter(account=>{
    if(!query)return true;
    return [account.name,account.alias,account.email].filter(Boolean).some(value=>String(value).toLowerCase().includes(query));
  }).sort((a,b)=>(isOwner(b)?1:0)-(isOwner(a)?1:0)||(b.created||0)-(a.created||0));
  const meta=$('#adminUsersMeta');if(meta)meta.textContent=`${list.length} из ${source.length}`;
  box.innerHTML=list.length?list.map(account=>{
    const record=adminDb.users[account.id]||{warnings:[],lastSeen:0};
    const warnCount=CLOUD_ENABLED?(+account.warnings||0):(record.warnings?.length||0);
    const lastSeen=CLOUD_ENABLED?(+account.lastSeen||0):(record.lastSeen||0);
    const owner=isOwner(account);
    return `<div class="admin-user-row">
      <div class="admin-user-id"><span class="avatar admin-avatar">${escapeHtml(adminInitials(account))}</span><div><strong>${escapeHtml(account.name||account.alias||'Без имени')}${owner?'<em class="admin-owner-badge">владелец</em>':''}</strong><span>@${escapeHtml(account.alias||'без_псевдонима')} · ${escapeHtml(account.email||'')}</span><small>${lastSeen?`Был(а): ${formatAdminDateTime(lastSeen)}`:'Ещё не входил(а)'}</small></div></div>
      <span class="admin-date">${formatAdminDate(account.created)}</span>
      <span class="admin-warn-pill ${warnCount?'has':''}">${warnCount?`⚑ ${warnCount}`:'—'}</span>
      <div class="admin-user-actions">${button('admin-profile',account.id,'Профиль','text-btn')}${button('admin-warn',account.id,'Предупредить','text-btn')}${owner?'':button('admin-delete',account.id,'Удалить','text-btn admin-danger')}</div>
    </div>`;
  }).join(''):`<div class="admin-empty">${query?'Пользователи не найдены.':CLOUD_ENABLED?'В облачной базе пока нет пользователей.':'В базе пока нет пользователей.'}</div>`;
}
function renderAdminLog(){
  const box=$('#adminLogList');if(!box)return;
  const events=(CLOUD_ENABLED?adminEvents:adminDb.events).slice(0,120);
  box.innerHTML=events.length?events.map(event=>{
    const actor=event.actor||{};
    return `<div class="admin-log-item"><span class="admin-log-dot">•</span><div class="admin-log-body"><div class="admin-log-top"><strong>${escapeHtml(actor.name||actor.alias||actor.email||'Гость')}</strong><small>${formatAdminDateTime(event.at)}</small></div><p><b>${escapeHtml(event.action||'событие')}</b>${event.details?`<span>${escapeHtml(event.details)}</span>`:''}</p>${actor.email?`<small class="admin-log-email">${escapeHtml(actor.email)}</small>`:''}</div></div>`;
  }).join(''):'<div class="admin-empty">Журнал пока пуст. Действия пользователей появятся здесь.</div>';
}
function renderAdminCached(){
  if(!isOwner(currentAccount))return;
  if(!CLOUD_ENABLED)syncAdminDb();
  renderAdminStats();renderAdminUsers();renderAdminLog();
  const count=$('#adminNavCount');if(count)count.textContent=CLOUD_ENABLED?adminUsers.length:accounts.length;
}
function renderAdmin(){
  if(!isOwner(currentAccount))return;
  renderAdminCached();
  if(CLOUD_ENABLED&&Date.now()-adminLoadedAt>5000)refreshAdminData();
}
function adminProfileMarkup(account,warnings,stats,lastSeen){
  const owner=isOwner(account),id=account.id;
  const warningMarkup=warnings.length?warnings.map(warning=>`<div class="admin-warning"><div><strong>${escapeHtml(warning.text)}</strong><small>${formatAdminDateTime(warning.created)}${warning.by?` · ${escapeHtml(warning.by)}`:''}${warning.read?' · прочитано':' · новое'}</small></div></div>`).join(''):'<p class="admin-empty compact">Предупреждений нет.</p>';
  return `<div class="admin-profile-head"><span class="avatar admin-avatar">${escapeHtml(adminInitials(account))}</span><div><h3>${escapeHtml(account.name||account.alias||'Без имени')}</h3><p>@${escapeHtml(account.alias||'без_псевдонима')} · ${escapeHtml(account.email||'')}</p>${owner?'<span class="admin-owner-badge">владелец</span>':''}</div></div><div class="admin-profile-stats"><div><strong>${+stats.tasks||0}</strong><span>задач</span></div><div><strong>${+stats.completed||0}</strong><span>выполнено</span></div><div><strong>${+stats.goals||0}</strong><span>целей</span></div><div><strong>${+stats.tracks||0}</strong><span>треков</span></div></div><div class="admin-profile-meta"><span><b>Создан:</b> ${formatAdminDate(account.created)}</span><span><b>Последний вход:</b> ${lastSeen?formatAdminDateTime(lastSeen):'ещё не входил(а)'}</span><span><b>ID:</b> ${escapeHtml(account.id)}</span></div><div class="admin-warning-list"><div class="admin-subhead"><strong>Предупреждения</strong><span>${warnings.length}</span></div>${warningMarkup}</div><div class="admin-profile-actions">${button('admin-warn',id,'Выдать предупреждение','secondary-btn')}${owner?'':button('admin-delete',id,'Удалить профиль','secondary-btn admin-danger')}</div>`;
}
async function adminProfileDialog(id){
  if(CLOUD_ENABLED){
    let profile;
    try{profile=await cloudRpc('sphere_admin_profile',{p_id:currentAccount.id,p_token:currentAccount.token,p_target:id});}
    catch(error){toast(error.message,true);return;}
    const account=profile?.account||{};if(!account.id)return;
    const warnings=Array.isArray(profile.warnings)?profile.warnings:[];
    const stats=profile.stats||{};
    openEditor(`Профиль · ${account.name||account.alias}`,adminProfileMarkup(account,warnings,stats,account.lastSeen),null);
    logAction('открыл профиль пользователя',`${account.name||account.alias} (${account.email})`,id);
    return;
  }
  const account=accounts.find(item=>item.id===id);if(!account)return;
  const record=adminUserRecord(id),userState=normalizeState(readStore(accountKey(account),null)||emptyState());
  const warnings=[...record.warnings].reverse();
  const stats={tasks:userState.tasks.length,completed:userState.tasks.filter(task=>task.progress===100).length,goals:userState.goals.length,tracks:userState.tracks.length};
  openEditor(`Профиль · ${account.name||account.alias}`,adminProfileMarkup(account,warnings,stats,record.lastSeen),null);
  logAction('открыл профиль пользователя',`${account.name||account.alias} (${account.email})`,id);
}
function adminWarnDialog(id){
  const account=(CLOUD_ENABLED?adminUsers:accounts).find(item=>item.id===id);if(!account)return;
  openEditor('Выдать предупреждение',`<p class="help-text">Пользователь <strong>${escapeHtml(account.name||account.alias)}</strong> · @${escapeHtml(account.alias||'')}<br>Предупреждение увидят при следующем входе.</p>${field('Текст предупреждения',`<textarea name="warning" rows="4" required maxlength="500" placeholder="Например: пожалуйста, соблюдай правила сообщества."></textarea>`)}`,async data=>{
    const text=String(data.get('warning')||'').trim();if(!text)throw new Error('Введите текст предупреждения.');
    if(CLOUD_ENABLED){
      await cloudRpc('sphere_admin_warn',{p_id:currentAccount.id,p_token:currentAccount.token,p_target:id,p_warning_id:uid(),p_text:text});
      logAction('выдал предупреждение',`«${text}» · ${account.name||account.alias}`,id);
      await refreshAdminData();
      toast(`Предупреждение выдано: ${account.name||account.alias}`);
      return;
    }
    const record=adminUserRecord(id);
    record.warnings.push({id:uid(),text,created:Date.now(),by:currentAccount?.name||currentAccount?.alias||'Администратор',byEmail:currentAccount?.email||'',read:false});
    saveAdminDb();logAction('выдал предупреждение',`«${text}» · ${account.name||account.alias}`,id);
    renderAdmin();toast(`Предупреждение выдано: ${account.name||account.alias}`);
  },'Выдать');
}
function adminDeleteProfile(id){
  const account=(CLOUD_ENABLED?adminUsers:accounts).find(item=>item.id===id);if(!account)return;
  if(isOwner(account)){toast('Аккаунт владельца удалить нельзя.',true);return;}
  openEditor('Удаление профиля',`<p>Удалить профиль <strong>${escapeHtml(account.name||account.alias)}</strong>?</p><p class="help-text">Будут удалены ${CLOUD_ENABLED?'данные из облака и':'задачи, цели, плейлисты, треки, фото и видео из'} этого браузера. Действие необратимо.</p>`,async ()=>{
    if(CLOUD_ENABLED){
      await cloudRpc('sphere_admin_delete',{p_id:currentAccount.id,p_token:currentAccount.token,p_target:id});
    }
    const localAccount=accounts.find(item=>item.id===id);
    if(localAccount){
      const userState=normalizeState(readStore(accountKey(localAccount),null)||emptyState());
      const mediaKeys=[userState.profile.video,...userState.tracks.map(track=>track.id)].filter(Boolean);
      accounts=accounts.filter(item=>item.id!==id);
      localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
      localStorage.removeItem(accountKey(localAccount));
      if(sessionId===id)localStorage.removeItem(SESSION_KEY);
      mediaKeys.forEach(key=>audioStore('delete',key).catch(()=>{}));
    }
    delete adminDb.users[id];saveAdminDb();
    logAction('удалил профиль',`${account.name||account.alias} (${account.email})`,id);
    if(CLOUD_ENABLED){
      await refreshAdminData();
      toast('Профиль удалён из облака');
      return;
    }
    renderAdmin();toast('Профиль удалён');
  },'Удалить профиль');
}
async function adminExportDb(){
  let users,events;
  if(CLOUD_ENABLED){
    try{
      [users,events]=await Promise.all([
        cloudRpc('sphere_admin_users',{p_id:currentAccount.id,p_token:currentAccount.token}),
        cloudRpc('sphere_admin_events',{p_id:currentAccount.id,p_token:currentAccount.token,p_limit:600})
      ]);
    }catch(error){toast(error.message,true);return;}
    users=Array.isArray(users)?users:[];
    events=Array.isArray(events)?events:[];
  }else{
    users=accounts.map(({salt,passHash,recoveryHash,token,...account})=>({...account,warnings:adminDb.users[account.id]?.warnings||[]}));
    events=adminDb.events;
  }
  const payload={exportedAt:new Date().toISOString(),users,events};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`sphere-admin-db-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  logAction('экспортировал базу пользователей',`${users.length} пользователей`);
  toast('База пользователей и журнал экспортированы.');
}
function adminClearLog(){
  openEditor('Очистить журнал',`<p>Удалить все записи журнала действий?</p><p class="help-text">Это не удалит профили и предупреждения.</p>`,async ()=>{
    if(CLOUD_ENABLED)await cloudRpc('sphere_admin_clear_events',{p_id:currentAccount.id,p_token:currentAccount.token});
    adminDb.events=[];saveAdminDb();logAction('очистил журнал','Все записи удалены');
    if(CLOUD_ENABLED){await refreshAdminData();toast('Журнал действий очищен');return;}
    renderAdmin();toast('Журнал действий очищен');
  },'Очистить');
}
$('#adminSearch')?.addEventListener('input',e=>{adminSearch=e.target.value;renderAdminUsers();});
$('#adminExport')?.addEventListener('click',adminExportDb);
$('#adminClearLog')?.addEventListener('click',adminClearLog);

function stopCurrentTrack(){playGeneration++;embedPlaying=false;audio.pause();audio.removeAttribute('src');audio.load();currentTrack='';if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';stopAura();$('#nowPlayingTitle').textContent='Нет активного трека';$('#nowPlayingArtist').textContent='';$('.album-art').innerHTML='<span>♪</span>';$('#playBtn').textContent='▶';$('#musicHero').classList.add('empty-player');$('#musicHero').classList.remove('embed-playing','aura-on');$('#musicProgressBar')?.classList.remove('disabled','seeking');musicProgressUpdate();renderMusic();}
document.addEventListener('click',async e=>{
  const target=e.target.closest('[data-action]');if(!target)return;const {action,id}=target.dataset;
  try {
    if(action==='task-cycle'){const task=state.tasks.find(t=>t.id===id);if(!task||task.date>today())return;task.progress=task.progress===100?0:task.progress+50;task.activityDate=task.progress?today():null;if(task.progress===100)completionSound();logAction('изменил прогресс задачи',`«${task.title}» · ${statuses[task.progress]}`,task.id);saveAndRender();}
    if(action==='task-edit')editTask(id);
    if(action==='task-delete'){const task=state.tasks.find(t=>t.id===id);if(task)confirmDelete(task.title,()=>{state.tasks=state.tasks.filter(t=>t.id!==id);logAction('удалил задачу',`«${task.title}»`,id);});}
    if(action==='calendar-select'){selectedDate=id;renderCalendar();}
    if(action==='goal-edit')editGoal(id);
    if(action==='goal-delete'){const goal=state.goals.find(g=>g.id===id);if(goal)confirmDelete(goal.title,()=>{state.goals=state.goals.filter(g=>g.id!==id);logAction('удалил цель',`«${goal.title}»`,id);});}
    if(action==='habit-toggle'){const habit=state.habits.find(h=>h.id===id);if(habit){const done=habit.days.includes(today());habit.days=done?habit.days.filter(d=>d!==today()):[...habit.days,today()];logAction(done?'снял отметку привычки':'отметил привычку',habit.name,habit.id);saveAndRender();}}
    if(action==='habit-delete'){const habit=state.habits.find(h=>h.id===id);if(habit)logAction('удалил привычку',habit.name,id);state.habits=state.habits.filter(h=>h.id!==id);saveAndRender();$('#habitMore').click();}
    if(action==='timer-toggle'){if(focusRunning){focusRemaining=Math.max(0,Math.ceil((focusEnd-Date.now())/1000));focusRunning=false;}else{if(focusRemaining<=0)focusRemaining=1500;focusEnd=Date.now()+focusRemaining*1000;focusRunning=true;}focusDialog();}
    if(action==='timer-reset'){focusRunning=false;focusRemaining=1500;focusDialog();}
    if(action==='playlist-open'){selectedPlaylist=id;renderMusic();}
    if(action==='playlist-all'){selectedPlaylist='';renderMusic();}
    if(action==='playlist-edit')playlistEditor(id);
    if(action==='playlist-delete'){const p=state.playlists.find(p=>p.id===id);if(p)confirmDelete(p.name,()=>{const tracks=state.tracks.filter(t=>t.playlist===id);if(tracks.some(t=>t.id===currentTrack))stopCurrentTrack();tracks.forEach(t=>audioStore('delete',t.id).catch(()=>toast('Не удалось очистить файл из хранилища.',true)));state.tracks=state.tracks.filter(t=>t.playlist!==id);state.playlists=state.playlists.filter(p=>p.id!==id);if(selectedPlaylist===id)selectedPlaylist='';logAction('удалил плейлист',`«${p.name}» · ${tracks.length} треков`,id);});}
    if(action==='track-add')addTrackDialog(id);
    if(action==='track-edit')editTrack(id);
    if(action==='track-play')await playTrack(id);
    if(action==='track-favorite'){const track=state.tracks.find(t=>t.id===id);if(track){track.favorite=!track.favorite;logAction(track.favorite?'добавил трек в любимые':'убрал трек из любимых',`«${track.title}»`,id);persist();renderMusic();renderProfile();toast(track.favorite?'Добавлено в любимые':'Убрано из любимых');}}
    if(action==='track-delete'){const t=state.tracks.find(t=>t.id===id);if(t)confirmDelete(t.title,()=>{if(currentTrack===id)stopCurrentTrack();state.tracks=state.tracks.filter(t=>t.id!==id);audioStore('delete',id).catch(()=>toast('Не удалось очистить аудиофайл.',true));logAction('удалил трек',`«${t.title}»`,id);});}
    if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sphere-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);logAction('экспортировал данные','JSON-копия профиля');toast('Данные экспортированы. Аудио и видео в JSON не входят.');}
    if(action==='logout')logoutAccount();
    if(action==='change-password')changePasswordDialog();
    if(action==='set-recovery')setRecoveryDialog();
    if(action==='admin-profile')adminProfileDialog(id);
    if(action==='admin-warn')adminWarnDialog(id);
    if(action==='admin-delete')adminDeleteProfile(id);
  }catch(error){toast(error.message,true);}
});
function renderAll(){renderTasks();renderCalendar();renderGoals();renderProfile();renderHabits();renderMusic();renderNews();renderSettings();updateSettingsCity();updateAdminAccess();if(activeView==='admin')renderAdmin();}
function saveAndRender(){persist();renderAll();}

const accountKey = account => ACCOUNT_PREFIX + account.id;
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const normalizeAlias = value => String(value || '').trim().replace(/^@/,'').toLowerCase();
const normalizeRecovery = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
const randomHex = (size = 16) => [...crypto.getRandomValues(new Uint8Array(size))].map(byte => byte.toString(16).padStart(2,'0')).join('');
function randomRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('').replace(/(.{4})(.{4})/,'$1-$2');
}
async function hashSecret(secret, salt) {
  const value = `${salt}:${secret}`;
  if (window.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  }
  let hash = 2166136261;
  for (let i=0;i<value.length;i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8,'0');
}
function authMessage(text=''){const el=$('#authMessage');if(el)el.textContent=text;}
function showAuth(tab = 'login') {
  const screen=$('#authScreen'); if(!screen) return;
  screen.hidden=false; document.body.classList.add('auth-locked');
  const isRecovery=tab==='recovery';
  $('#loginForm').hidden=tab!=='login';
  $('#registerForm').hidden=tab!=='register';
  $('#recoveryForm').hidden=!isRecovery;
  $('#authTabs').hidden=isRecovery;
  $$('[data-auth-tab]').forEach(button=>button.classList.toggle('active',button.dataset.authTab===tab));
  $('#authTitle').textContent=isRecovery?'Восстановление доступа':tab==='register'?'Создай свой аккаунт':'Вход в Сферу';
  $('#authSub').textContent=isRecovery?'Восстановление работает по email и коду: одноразовому с регистрации или постоянному, который задан в настройках.':CLOUD_ENABLED?'Данные сохраняются в облаке и доступны с любого устройства.':'Данные сохраняются в этом браузере и привязаны к твоему аккаунту.';
  if(tab==='register'&&firstAccountSeed?.profile){
    const name=$('#registerForm [name="name"]'),alias=$('#registerForm [name="alias"]');
    if(name&&!name.value&&firstAccountSeed.profile.name)name.value=firstAccountSeed.profile.name;
    if(alias&&!alias.value&&firstAccountSeed.profile.alias)alias.value=firstAccountSeed.profile.alias;
  }
  authMessage('');
}
function applyStateAfterLogin() {
  selectedDate=today();calendarMonth=new Date().getMonth();calendarYear=new Date().getFullYear();
  taskFilter='all';taskSort='manual';selectedPlaylist='';currentTrack='';newsFilter='Все';
  applyTheme();showView('overview');renderAll();updateClock();
  if(state.settings.morning&&new Date().getHours()>=8&&state.lastMorning!==today()){
    state.lastMorning=today();persist();toast(`Твой план на сегодня: ${state.tasks.filter(t=>t.date===today()&&t.progress<100).length} незавершённых задач.`);
  }
}
async function startSession(account, options = {}) {
  currentAccount=account;STORAGE=accountKey(account);
  localStorage.setItem(SESSION_KEY,account.id);
  const useCloud=CLOUD_ENABLED&&!!account.token&&!options.localOnly;
  let cloudState=null,cloudWarnings=[],cloudDown=false;
  if(useCloud){
    try{
      cloudState=applyCloudState(await cloudRpc('sphere_state_get',{p_id:account.id,p_token:account.token}));
    }catch(error){
      if(String(error.code||'').toLowerCase()==='invalid_session'){
        currentAccount=null;localStorage.removeItem(SESSION_KEY);
        showAuth('login');toast('Сессия устарела. Войдите заново.',true);
        return;
      }
      cloudDown=true;
    }
    try{
      const list=await cloudRpc('sphere_warnings_take',{p_id:account.id,p_token:account.token});
      if(Array.isArray(list))cloudWarnings=list;
    }catch{}
  }
  state=cloudState||normalizeState(readStore(STORAGE,null)||emptyState());
  if(cloudState){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{}}
  const warnings=useCloud?cloudWarnings:unreadWarnings(account.id);
  if(!useCloud){
    const record=adminUserRecord(account.id);record.lastSeen=Date.now();saveAdminDb();
  }
  $('#authScreen').hidden=true;document.body.classList.remove('auth-locked');
  applyStateAfterLogin();
  if(cloudDown&&!cloudOfflineNotified){
    cloudOfflineNotified=true;
    setTimeout(()=>toast('Нет связи с облаком. Показаны локально сохранённые данные.',true),900);
  }
  if(warnings.length){
    if(!useCloud){warnings.forEach(warning=>warning.read=true);saveAdminDb();}
    setTimeout(()=>toast(`Предупреждение администратора: ${warnings.map(warning=>warning.text).join(' · ')}`,true),900);
  }
}
async function logoutAccount() {
  logAction('вышел из аккаунта',currentAccount?.email||'');
  persist();
  await saveCloudNow();
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}
function showRecoveryCode(code, title='Аккаунт создан') {
  openEditor(title,`<p class="help-text">Этот код нужен, если ты забудешь пароль. Он показывается один раз — сохрани его в надёжном месте.</p><div class="recovery-code">${escapeHtml(code)}</div><p class="help-text">Войти можно по email или псевдониму. Восстановление — по email и этому коду. Позже в настройках можно заменить его на постоянный код.</p>`);
}
function changePasswordDialog(){
  if(!cloudSessionActive())return;
  openEditor('Сменить пароль',`<p class="help-text">Пароль хранится только в виде необратимого хеша. После смены старый пароль перестанет работать, а код восстановления останется прежним.</p>${field('Текущий пароль',input('current','','password','required autocomplete="current-password"'))}${field('Новый пароль',input('next','','password','required minlength="6" autocomplete="new-password"'))}${field('Повторите новый пароль',input('next2','','password','required minlength="6" autocomplete="new-password"'))}`,async data=>{
    const current=String(data.get('current')||''),next=String(data.get('next')||''),next2=String(data.get('next2')||'');
    if(!current)throw new Error('Введите текущий пароль.');
    if(next.length<6)throw new Error('Новый пароль должен быть не короче 6 символов.');
    if(next!==next2)throw new Error('Новые пароли не совпадают.');
    const currentHash=await hashSecret(current,currentAccount.salt);
    const newHash=await hashSecret(next,currentAccount.salt);
    try{
      await cloudRpc('sphere_password_change',{p_id:currentAccount.id,p_token:currentAccount.token,p_current_hash:currentHash,p_new_hash:newHash});
    }catch(error){throw explainMissingCloudFunction(error);}
    currentAccount.passHash=newHash;
    cacheCloudAccount(currentAccount);
    logAction('сменил пароль','');
    toast('Пароль изменён');
  },'Сохранить');
}
function setRecoveryDialog(){
  if(!cloudSessionActive())return;
  openEditor('Постоянный код восстановления',`<p class="help-text">Придумайте код, который будете использовать для восстановления пароля. Он заменит одноразовый код с регистрации и будет действовать после восстановления. Минимум 10 символов: буквы и цифры. Запишите его в надёжном месте.</p>${field('Текущий пароль',input('current','','password','required autocomplete="current-password"'))}${field('Новый код',input('code','','text','required minlength="10" maxlength="32" autocomplete="off" placeholder="Например: MYSECRET2026"'))}${field('Повторите код',input('code2','','text','required minlength="10" maxlength="32" autocomplete="off"'))}`,async data=>{
    const current=String(data.get('current')||''),code=normalizeRecovery(data.get('code')),code2=normalizeRecovery(data.get('code2'));
    if(!current)throw new Error('Введите текущий пароль.');
    if(code.length<10)throw new Error('Код должен быть не короче 10 символов.');
    if(code!==code2)throw new Error('Коды не совпадают.');
    const currentHash=await hashSecret(current,currentAccount.salt);
    const recoveryHash=await hashSecret(code,currentAccount.salt);
    try{
      await cloudRpc('sphere_recovery_set',{p_id:currentAccount.id,p_token:currentAccount.token,p_current_hash:currentHash,p_recovery_hash:recoveryHash});
    }catch(error){throw explainMissingCloudFunction(error);}
    currentAccount.recoveryHash=recoveryHash;
    cacheCloudAccount(currentAccount);
    logAction('задал постоянный код восстановления','');
    toast('Постоянный код восстановления сохранён');
  },'Сохранить');
}
$$('[data-auth-tab]').forEach(button=>button.onclick=()=>showAuth(button.dataset.authTab));
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();authMessage('');const form=e.currentTarget,submit=$('button[type="submit"]',form);
  submit.disabled=true;
  try{
    const data=new FormData(form),login=String(data.get('login')||'').trim(),password=String(data.get('password')||'');
    if(CLOUD_ENABLED){
      let account=null;
      try{
        const salt=await cloudRpc('sphere_salt',{p_identifier:login});
        if(!salt){
          const local=findLocalAccount(login);
          if(local){
            // Псевдоним мог измениться в профиле. Если в облаке уже есть аккаунт
            // с email из локальной копии, пробуем войти по email, а не создавать дубль.
            const emailSalt=await cloudRpc('sphere_salt',{p_identifier:local.email});
            if(emailSalt){
              const emailHash=await hashSecret(password,emailSalt);
              try{
                const result=await cloudRpc('sphere_login',{p_identifier:local.email,p_hash:emailHash});
                account={id:result.id,name:result.name,alias:result.alias,email:result.email,salt:emailSalt,passHash:emailHash,created:+result.created||Date.now(),token:result.token};
                cacheCloudAccount(account);
              }catch(loginError){
                if(String(loginError.code||'').toLowerCase()==='invalid_credentials')throw new Error('Неверный пароль. Если не помнишь его, восстанови доступ по коду или сбрось пароль.');
                throw loginError;
              }
            }else{
              const localHash=await hashSecret(password,local.salt);
              if(localHash!==local.passHash)throw new Error('Неверный пароль.');
              account=await migrateLocalAccount(local);
            }
          }
          if(!account)throw new Error('Аккаунт не найден. Проверь email или псевдоним. Если псевдоним менялся, войди по email.');
        }else{
          const hash=await hashSecret(password,salt);
          const result=await cloudRpc('sphere_login',{p_identifier:login,p_hash:hash});
          account={id:result.id,name:result.name,alias:result.alias,email:result.email,salt,passHash:hash,created:+result.created||Date.now(),token:result.token};
          cacheCloudAccount(account);
        }
      }catch(error){
        if(error.cloudUnavailable){
          const local=findLocalAccount(login);
          if(local&&await hashSecret(password,local.salt)===local.passHash){
            await startSession(local,{localOnly:true});
            logAction('вошёл в аккаунт (локальная копия)',local.email,local.id);
            toast('Облако недоступно. Вход выполнен по локальной копии.',true);
            return;
          }
        }
        throw error;
      }
      await startSession(account);
      logAction('вошёл в аккаунт',account.email,account.id);
      return;
    }
    const account=findLocalAccount(login);
    if(!account)throw new Error('Аккаунт не найден. Проверь email или псевдоним. Если псевдоним менялся, войди по email.');
    const hash=await hashSecret(password,account.salt);
    if(hash!==account.passHash)throw new Error('Неверный пароль.');
    await startSession(account);logAction('вошёл в аккаунт',account.email,account.id);
  }catch(error){authMessage(error.message||'Не удалось войти.');}
  finally{submit.disabled=false;}
};
$('#registerForm').onsubmit=async e=>{
  e.preventDefault();authMessage('');const form=e.currentTarget,submit=$('button[type="submit"]',form);
  submit.disabled=true;
  try{
    const data=new FormData(form),email=normalizeEmail(data.get('email')),alias=String(data.get('alias')||'').trim().replace(/^@/,''),password=String(data.get('password')||''),password2=String(data.get('password2')||''),name=String(data.get('name')||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Введите корректный email.');
    if(alias.length<3)throw new Error('Псевдоним должен быть не короче 3 символов.');
    if(/\s/.test(alias))throw new Error('Псевдоним не должен содержать пробелы.');
    if(password.length<6)throw new Error('Пароль должен быть не короче 6 символов.');
    if(password!==password2)throw new Error('Пароли не совпадают.');
    const salt=randomHex(),recoveryCode=randomRecoveryCode(),passHash=await hashSecret(password,salt),recoveryHash=await hashSecret(normalizeRecovery(recoveryCode),salt);
    const seed=firstAccountSeed?JSON.parse(JSON.stringify(firstAccountSeed)):emptyState();
    seed.profile.name=name||seed.profile.name||alias;seed.profile.alias=alias;
    const seedState=normalizeState(seed);
    if(CLOUD_ENABLED){
      const id=uid(),token=randomHex(32);
      const result=await cloudRpc('sphere_register',{
        p_id:id,p_name:name||alias,p_alias:alias,p_email:email,p_salt:salt,p_hash:passHash,
        p_recovery_hash:recoveryHash,p_token:token,p_state:seedState
      });
      const account={id:result.id||id,name:result.name||name||alias,alias:result.alias||normalizeAlias(alias),email:result.email||email,
        salt,passHash,recoveryHash,created:+result.created||Date.now(),token:result.token||token};
      localStorage.setItem(accountKey(account),JSON.stringify(seedState));
      cacheCloudAccount(account);
      await startSession(account);
      logAction('зарегистрировался',`${account.name} · @${account.alias}`,account.id);
      showRecoveryCode(recoveryCode);
      return;
    }
    if(accounts.some(item=>normalizeEmail(item.email)===email))throw new Error('Аккаунт с таким email уже существует.');
    if(accounts.some(item=>normalizeAlias(item.alias)===normalizeAlias(alias)))throw new Error('Такой псевдоним уже занят.');
    const account={id:uid(),email,alias,name:name||alias,salt,passHash,recoveryHash,created:Date.now()};
    localStorage.setItem(accountKey(account),JSON.stringify(seedState));
    accounts.push(account);localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
    await startSession(account);logAction('зарегистрировался',`${account.name} · @${account.alias}`,account.id);showRecoveryCode(recoveryCode);
  }catch(error){authMessage(error.message||'Не удалось создать аккаунт.');}
  finally{submit.disabled=false;}
};
$('#recoveryForm').onsubmit=async e=>{
  e.preventDefault();authMessage('');const form=e.currentTarget,submit=$('button[type="submit"]',form);
  submit.disabled=true;
  try{
    const data=new FormData(form),email=normalizeEmail(data.get('email')),code=normalizeRecovery(data.get('code')),password=String(data.get('password')||''),password2=String(data.get('password2')||'');
    if(password.length<6)throw new Error('Пароль должен быть не короче 6 символов.');
    if(password!==password2)throw new Error('Пароли не совпадают.');
    if(CLOUD_ENABLED){
      const salt=await cloudRpc('sphere_salt',{p_identifier:email});
      if(!salt)throw new Error('Аккаунт с таким email не найден.');
      const recoveryHash=await hashSecret(code,salt);
      const passHash=await hashSecret(password,salt);
      // Код восстановления остаётся тем же: его можно использовать повторно.
      const result=await cloudRpc('sphere_recover',{p_email:email,p_recovery_hash:recoveryHash,p_hash:passHash,p_new_recovery_hash:recoveryHash});
      const account={id:result.id,name:result.name,alias:result.alias,email:result.email,salt,passHash,recoveryHash,created:+result.created||Date.now(),token:result.token};
      cacheCloudAccount(account);
      await startSession(account);
      logAction('восстановил доступ',account.email,account.id);
      openEditor('Пароль изменён',`<p class="help-text">Пароль обновлён. Код восстановления остался прежним — используйте тот, который вы ввели. Если он мог стать известен кому-то ещё, смените его в настройках.</p>`);
      return;
    }
    const account=accounts.find(item=>normalizeEmail(item.email)===email);
    if(!account)throw new Error('Аккаунт с таким email не найден.');
    const recoveryHash=await hashSecret(code,account.salt);
    if(recoveryHash!==account.recoveryHash)throw new Error('Неверный код восстановления.');
    account.passHash=await hashSecret(password,account.salt);
    account.recoveryHash=recoveryHash;
    localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
    await startSession(account);logAction('восстановил доступ',account.email,account.id);
    openEditor('Пароль изменён',`<p class="help-text">Пароль обновлён. Код восстановления остался прежним — используйте тот, который вы ввели.</p>`);
  }catch(error){authMessage(error.message||'Не удалось восстановить доступ.');}
  finally{submit.disabled=false;}
};

// Clear the old visual demo counts immediately; no fabricated activity is migrated.
$('.focus-mini span').textContent='Прогресс задач';
$('#musicProgress').style.width='0%';

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveCloudNow();});
window.addEventListener('pagehide',()=>{saveCloudNow();});

function hydrateCachedSession(){
  if(!currentAccount)return;
  try{
    document.body.classList.remove('auth-locked');
    $('#authScreen').hidden=true;
    applyTheme();renderAll();updateClock();
  }catch{}
}
async function boot(){
  if(CLOUD_ENABLED&&currentAccount&&!currentAccount.token){
    currentAccount=null;
    localStorage.removeItem(SESSION_KEY);
  }
  if(currentAccount){
    hydrateCachedSession();
    await startSession(currentAccount);
    return;
  }
  showAuth(CLOUD_ENABLED||accounts.length?'login':'register');
}
boot().catch(error=>{console.error(error);showAuth(CLOUD_ENABLED||accounts.length?'login':'register');});
