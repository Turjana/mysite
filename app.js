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
const THEME_PRESETS = {
  blue:{label:'Лазурный',darkLabel:'Тёмно-лазурный',color:'#76a9ff'},
  violet:{label:'Фиолетовый',darkLabel:'Тёмно-фиолетовый',color:'#a78bff'},
  mint:{label:'Мятный',darkLabel:'Тёмно-мятный',color:'#63e0c0'},
  sunset:{label:'Закатный',darkLabel:'Тёмно-оранжевый',color:'#ff936b'},
  rose:{label:'Розовый',darkLabel:'Тёмно-розовый',color:'#ff7fae'},
  gold:{label:'Золотой',darkLabel:'Тёмно-золотой',color:'#f0c96a'},
  ice:{label:'Ледяной',darkLabel:'Тёмно-ледяной',color:'#72d6ff'},
  lime:{label:'Лаймовый',darkLabel:'Тёмно-лаймовый',color:'#b8e36a'},
  black:{label:'Чёрный',color:'#000000'}
};
const THEME_LABELS = {black:'Чёрная',light:'Светлая'};
const emptyState = () => ({version:3,tasks:[],goals:[],playlists:[],tracks:[],favoriteArticles:[],gallery:[],profile:{name:'',alias:'',photo:'',photoX:50,photoY:50,photoScale:1,layout:'card',video:'',videoDuration:0,ownerPrefix:'Владелец',status:'✦ В своём ритме'},habits:[{id:uid(),name:'Утренняя зарядка',days:[]},{id:uid(),name:'Читать 20 минут',days:[]}],note:'',theme:'black',accent:'blue',settings:{sound:false,focus:false,morning:false,glass:false,volume:.85},weather:{city:'Москва',lat:55.7558,lon:37.6173,timezone:'Europe/Moscow',temp:null,code:null,desc:'',updated:0},newsSources:[],newsFeed:[],newsCustom:[],sessions:0});
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
  next.favoriteArticles = Array.isArray(source.favoriteArticles) ? source.favoriteArticles : [];
  next.gallery = Array.isArray(source.gallery) ? source.gallery : [];
  if (!['black','light'].includes(next.theme)) next.theme = 'black';
  if (!THEME_PRESETS[next.accent]) next.accent = 'blue';
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
const ADMIN_SEEN_KEY = 'sphere-admin-seen';
const ADMIN_NOTIFY_KEY = 'sphere-admin-notify';
const SUPPORT_THREAD_KEY = 'sphere-support-thread';
const ADMIN_LOG_LIMIT = 600;
const HIDDEN_LOG_ACTIONS = new Set(['переключил тему','изменил тему','изменил цвет темы','изменил громкость','открыл профиль пользователя']);
const visibleLogEvents = events => (Array.isArray(events)?events:[]).filter(event=>!HIDDEN_LOG_ACTIONS.has(String(event?.action||'')));
const SUPPORT_FILE_LIMIT = 2 * 1024 * 1024;
let adminSeenAt = +localStorage.getItem(ADMIN_SEEN_KEY) || 0;
let adminSupportThreads = [], adminSupportCurrent = null, adminSupportAvailable = true, adminSupportPollTimer = 0;
let supportThreadState = readSupportThread(), supportMessages = [], supportPollTimer = 0, supportSending = false;
let supportAttachment = null, adminSupportAttachment = null;
let adminNotifyStore = readStore(ADMIN_NOTIFY_KEY, null);
let adminNotifySeen = adminNotifyStore && typeof adminNotifyStore==='object' && adminNotifyStore.seen && typeof adminNotifyStore.seen==='object' ? adminNotifyStore.seen : {};
let adminNotifyInitialized = !!adminNotifyStore?.initialized, adminNotifyBusy = false;
let shownWarningIds = new Set(), warningPollTimer = 0;
let adminRefreshBusy = false, adminLiveTimer = 0, presenceTimer = 0, presenceLastAt = 0;
let ageGateResolve = null;
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
  if (HIDDEN_LOG_ACTIONS.has(String(action || ''))) return;
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
    if (isOwner(currentAccount)) updateAdminAlert();
  } catch {}
}
function unreadWarnings(accountId) {
  return adminUserRecord(accountId).warnings.filter(warning => !warning.read);
}
function readSupportThread() {
  try {
    const value = JSON.parse(localStorage.getItem(SUPPORT_THREAD_KEY));
    if (value && typeof value === 'object' && value.id && value.secret) return value;
  } catch {}
  return null;
}
function saveSupportThread(value) {
  supportThreadState = value || null;
  try {
    if (supportThreadState) localStorage.setItem(SUPPORT_THREAD_KEY, JSON.stringify(supportThreadState));
    else localStorage.removeItem(SUPPORT_THREAD_KEY);
  } catch {}
}
function saveAdminSeen(value = Date.now()) {
  adminSeenAt = value;
  try { localStorage.setItem(ADMIN_SEEN_KEY, String(value)); } catch {}
}
function adminUnreadCount() {
  if (!isOwner(currentAccount)) return 0;
  const seen = +adminSeenAt || 0;
  const ownId = String(currentAccount?.id || '');
  const events = visibleLogEvents(CLOUD_ENABLED ? adminEvents : adminDb.events).filter(event => {
    const actorId = String(event?.actor?.id || '');
    return (+event?.at || 0) > seen && actorId !== ownId;
  });
  const users = (CLOUD_ENABLED ? adminUsers : accounts).filter(account => !isOwner(account) && (+account?.created || 0) > seen);
  const support = adminSupportThreads.filter(thread => {
    const updated = +thread?.updated || 0;
    const lastSender = String(thread?.lastSender || (thread?.ownerUnread ? 'user' : ''));
    return updated > seen && lastSender === 'user';
  });
  return events.length + users.length + support.length;
}
function updateAdminAlert() {
  const dot = $('#adminNavDot');
  if (!dot) return;
  const visible = isOwner(currentAccount) && activeView !== 'admin' && adminUnreadCount() > 0;
  dot.hidden = !visible;
  dot.title = visible ? `Новых уведомлений: ${adminUnreadCount()}` : 'Есть новые уведомления';
}
function markAdminSeen() {
  saveAdminSeen();
  updateAdminAlert();
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
  warning_empty: 'Введите текст предупреждения.',
  support_invalid: 'Не удалось открыть чат поддержки. Попробуйте ещё раз.',
  support_forbidden: 'Этот чат поддержки недоступен.',
  support_empty: 'Введите сообщение или прикрепите файл.',
  support_not_found: 'Обращение в поддержку не найдено.',
  support_file_too_large: 'Файл слишком большой для отправки. Прикрепите файл меньше 2 МБ.'
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
  if (activeView === 'admin' && view !== 'admin') markAdminSeen();
  activeView = view;
  if (view !== 'profile') hideProfilePhotoViewer();
  applyCabinetBackground();
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === view); el.setAttribute('aria-current', el.dataset.view === view ? 'page' : 'false'); });
  $('#sidebar').classList.remove('open'); document.body.classList.remove('sidebar-open'); window.scrollTo({top:0,behavior:'smooth'});
  if (view === 'admin') { markAdminSeen(); renderAdmin(); }
  updateAdminAlert();
}
$$('.nav-item[data-view]').forEach(el => el.onclick = () => showView(el.dataset.view));
$$('[data-view-target]').forEach(el => el.onclick = () => showView(el.dataset.viewTarget));
function setSidebarOpen(open){
  $('#sidebar').classList.toggle('open', open);
  document.body.classList.toggle('sidebar-open', open);
}
$('#menuBtn').onclick = () => setSidebarOpen(!$('#sidebar').classList.contains('open'));
document.addEventListener('click', e => {
  if(!$('#sidebar').classList.contains('open'))return;
  if(e.target.closest('#sidebar')||e.target.closest('#menuBtn'))return;
  setSidebarOpen(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) setSidebarOpen(false); });
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
function darkenThemeColor(value, amount = .32) {
  const rgb = mixThemeColor(themeRgb(value), [0, 0, 0], amount);
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}
function themeAccentColor(key, theme = state.theme) {
  const color = THEME_PRESETS[key]?.color || THEME_PRESETS.blue.color;
  return theme === 'black' ? darkenThemeColor(color) : color;
}
function themeAccentLabel(key, theme = state.theme) {
  const preset = THEME_PRESETS[key] || THEME_PRESETS.blue;
  return theme === 'black' ? (preset.darkLabel || preset.label) : preset.label;
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
function themeContrast(rgb) {
  const luminance = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
  return luminance > 0.62 ? '#101722' : '#ffffff';
}
function applyTheme() {
  const theme = state.theme === 'light' ? 'light' : 'black';
  state.theme = theme;
  const light = theme === 'light', black = !light;
  const color = themeAccentColor(state.accent, theme), accent = themeRgb(color), hsl = themeHsl(color);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = state.accent;
  const themeBtn = $('#themeBtn');
  if (themeBtn) {
    themeBtn.textContent = light ? '☾' : '☼';
    themeBtn.title = `Тема: ${THEME_LABELS[theme]}. Нажми, чтобы сменить тему.`;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#eef3f9' : '#000000');
  document.documentElement.style.setProperty('--blue', color);
  document.documentElement.style.setProperty('--accent-ink', light ? themeRgbCss(mixThemeColor([62,114,201],accent,.12)) : themeRgbCss(mixThemeColor(accent,[255,255,255],.24)));
  document.documentElement.style.setProperty('--accent-contrast', themeContrast(accent));
  const tone2=themeTone(hsl,46), tone3=themeTone(hsl,-52), toneStart=themeTone(hsl,38), toneEnd=themeTone(hsl,-42);
  const darkTone=value=>black?`color-mix(in srgb, ${value} 78%, #000)`:value;
  document.documentElement.style.setProperty('--accent-2', darkTone(tone2));
  document.documentElement.style.setProperty('--accent-3', darkTone(tone3));
  document.documentElement.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${darkTone(toneStart)}, ${color} 48%, ${darkTone(toneEnd)})`);
  const base = light
    ? {bg:'#f3f6fb',sidebar:'#eaf0f8',panel:'#ffffff',panel2:'#f5f8fc',line:'#d2dce9'}
    : {bg:'#000000',sidebar:'#000000',panel:'#080808',panel2:'#0d0d0d',line:'#232323'};
  const weights = light
    ? {bg:.12,sidebar:.18,panel:.06,panel2:.10,line:.22}
    : {bg:0,sidebar:0,panel:0,panel2:0,line:0};
  for (const key of ['bg','sidebar','panel','panel2','line']) document.documentElement.style.setProperty(`--${key}`,themeRgbCss(mixThemeColor(themeRgb(base[key]),accent,weights[key])));
  const textStyles = light
    ? {text:['#141c2a',.04],muted:['#4b596e',.14],dim:['#4f5c70',.10]}
    : {text:['#ffffff',0],muted:['#a1a1a1',0],dim:['#6e6e6e',0]};
  for (const [key,[baseColor,amount]] of Object.entries(textStyles)) document.documentElement.style.setProperty(`--${key}`,themeRgbCss(mixThemeColor(themeRgb(baseColor),accent,amount)));
  const glow = light ? .20 : 0, glow2 = light ? .14 : 0;
  const ambient = light ? .22 : 0;
  document.documentElement.style.setProperty('--bg-gradient', black ? 'none' : `radial-gradient(circle at 14% 18%, ${themeTone(hsl,0,glow)} 0%, transparent 54%), radial-gradient(circle at 86% 14%, ${themeTone(hsl,54,glow2)} 0%, transparent 52%), radial-gradient(circle at 52% 92%, ${themeTone(hsl,-58,glow2)} 0%, transparent 58%)`);
  document.documentElement.style.setProperty('--ambient-a', themeTone(hsl,0,ambient));
  document.documentElement.style.setProperty('--ambient-b', themeTone(hsl,54,ambient * .86));
  document.documentElement.style.setProperty('--ambient-c', themeTone(hsl,-58,ambient * .8));
  document.documentElement.style.setProperty('--ambient-opacity', light ? '.28' : '0');
  document.body.classList.toggle('glass-ui', !!state.settings.glass);
}
$('#themeBtn').onclick = () => {
  state.theme = state.theme === 'light' ? 'black' : 'light';
  applyTheme(); renderThemePreferences(); persist();
};
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
function cabinetBackgroundValue(){
  return isOwner(currentAccount) ? String(state.profile.cabinetBg||'') : '';
}
function cabinetVideoValue(){
  return isOwner(currentAccount) ? String(state.profile.cabinetBgVideo||'') : '';
}
const CABINET_SHADER_LAYER='idmw3v7s4chuot04689';
const CABINET_SHADER_DEFAULTS={colorA:'#000000',colorB:'#cd00ff',colorC:'#cd00ff',colorD:'#000000'};
function normalizeHexColor(value){
  let v=String(value||'').trim().replace(/^#/,'');
  if(/^[0-9a-fA-F]{3}$/.test(v))v=v.split('').map(c=>c+c).join('');
  return /^[0-9a-fA-F]{6}$/.test(v)?'#'+v.toLowerCase():'';
}
function cabinetShaderValue(){
  if(!isOwner(currentAccount))return null;
  const raw=state.profile.cabinetBgShader;
  if(!raw||typeof raw!=='object')return null;
  const colors={};
  for(const key of Object.keys(CABINET_SHADER_DEFAULTS))colors[key]=normalizeHexColor(raw[key])||CABINET_SHADER_DEFAULTS[key];
  return colors;
}
function cabinetShaderOpacity(){
  const raw=state.profile&&state.profile.cabinetBgShader;
  const value=raw&&raw.opacity!=null?Number(raw.opacity):NaN;
  if(!isFinite(value))return 100;
  return Math.min(100,Math.max(0,value));
}
let cabinetVideoURL='';
function resetCabinetVideo(video=$('#cabinetBgVideo')){
  if(!video)return;
  if(cabinetVideoURL){URL.revokeObjectURL(cabinetVideoURL);cabinetVideoURL='';}
  video.pause();video.onloadedmetadata=null;video.removeAttribute('src');delete video.dataset.mediaKey;video.load();
}
async function loadCabinetVideo(key){
  const video=$('#cabinetBgVideo');if(!video||!key)return;
  if(video.dataset.mediaKey===key&&cabinetVideoURL)return;
  try{
    const blob=await audioStore('get',key);
    if(!blob||cabinetVideoValue()!==key)return;
    if(cabinetVideoURL)URL.revokeObjectURL(cabinetVideoURL);
    cabinetVideoURL=URL.createObjectURL(blob);video.dataset.mediaKey=key;video.src=cabinetVideoURL;
    video.onloadedmetadata=()=>{video.currentTime=0;if(document.body.classList.contains('profile-cabinet-video'))video.play().catch(()=>{});};
  }catch{}
}
let cabinetShader=null,cabinetShaderColors='',cabinetShaderBusy=false;
const shaderColorsKey=colors=>colors?`${colors.colorA}|${colors.colorB}|${colors.colorC}|${colors.colorD}`:'';
function cabinetShaderPreset(colors){return {components:[{type:'FlowingGradient',id:CABINET_SHADER_LAYER,props:{...colors,seed:100,speed:0.5}}]};}
let shadersRuntimePromise=null;
function loadShadersRuntime(){
  if(shadersRuntimePromise)return shadersRuntimePromise;
  shadersRuntimePromise=import('./vendor/shaders-bundle.js')
    .catch(()=>import('https://cdn.jsdelivr.net/npm/shaders@4.0.6/dist/js/bundle.js'))
    .catch(error=>{shadersRuntimePromise=null;throw error;});
  return shadersRuntimePromise;
}
function destroyCabinetShader(){
  if(cabinetShader){try{cabinetShader.destroy();}catch{}cabinetShader=null;}
  cabinetShaderColors='';
  clearTimeout(cabinetShaderResizeTimer);
  if(cabinetShaderResizeBound){window.removeEventListener('resize',handleCabinetShaderResize);cabinetShaderResizeBound=false;}
}
async function applyCabinetShader(colors,active){
  const canvas=$('#cabinetBgShader');
  if(!colors){destroyCabinetShader();if(canvas)canvas.style.opacity='';return;}
  if(!canvas||!navigator.gpu)return;
  canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;'+(document.body.classList.contains('profile-cabinet-shader')?'display:block;':'');
  canvas.style.opacity=(cabinetShaderOpacity()/100).toFixed(3);
  if(cabinetShader){
    const key=shaderColorsKey(colors);
    if(key!==cabinetShaderColors){cabinetShader.update(CABINET_SHADER_LAYER,{...colors});cabinetShaderColors=key;}
    if(active)cabinetShader.resume();else cabinetShader.pause();
    return;
  }
  if(cabinetShaderBusy)return;
  cabinetShaderBusy=true;
  try{
    if(!document.body.classList.contains('profile-cabinet-shader'))document.body.classList.add('profile-cabinet-shader');
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2){cabinetShaderBusy=false;return;}
    const {createShader}=await loadShadersRuntime();
    const current=cabinetShaderValue();
    if(!current||!navigator.gpu)return;
    const instance=await createShader(canvas,cabinetShaderPreset(current));
    const fresh=cabinetShaderValue();
    if(!fresh){try{instance.destroy();}catch{}return;}
    cabinetShader=instance;
    cabinetShaderColors=shaderColorsKey(fresh);
    if(shaderColorsKey(fresh)!==shaderColorsKey(current))instance.update(CABINET_SHADER_LAYER,{...fresh});
    const stillActive=!document.body.classList.contains('auth-locked');
    if(!stillActive)instance.pause();
    if(!cabinetShaderResizeBound){cabinetShaderResizeBound=true;window.addEventListener('resize',handleCabinetShaderResize,{passive:true});}
  }catch(error){
    console.warn('Не удалось запустить живой фон кабинета:',error);
    toast('Живой градиент недоступен: не удалось загрузить шейдер-рантайм. Проверьте интернет или обновите страницу.',true);
  }finally{
    cabinetShaderBusy=false;
  }
}
let cabinetShaderResizeTimer=0,cabinetShaderResizeBound=false;
function handleCabinetShaderResize(){
  if(!cabinetShader)return;
  clearTimeout(cabinetShaderResizeTimer);
  cabinetShaderResizeTimer=setTimeout(()=>{
    if(!cabinetShader)return;
    try{cabinetShader.resize&&cabinetShader.resize();}catch{}
  },160);
}
function applyCabinetBackground(){
  const value=cabinetBackgroundValue(),videoValue=cabinetVideoValue(),shaderValue=navigator.gpu?cabinetShaderValue():null;
  const unlocked=!document.body.classList.contains('auth-locked');
  const activeProfile=activeView==='profile'&&unlocked;
  document.documentElement.style.setProperty('--cabinet-bg',value?`url("${value}")`:'none');
  document.body.classList.toggle('profile-cabinet-bg',!!value&&activeProfile);
  document.body.classList.toggle('profile-cabinet-video',!!videoValue&&activeProfile);
  document.body.classList.toggle('profile-cabinet-shader',!!shaderValue&&unlocked);
  const video=$('#cabinetBgVideo');
  if(!videoValue){resetCabinetVideo(video);}
  else{
    loadCabinetVideo(videoValue);
    if(video){if(activeProfile)video.play().catch(()=>{});else video.pause();}
  }
  applyCabinetShader(shaderValue,unlocked);
}
let profileSection='tracks';
const galleryURLs=new Map();
function articleKey(item){return String(item?.url||item?.id||item?.title||'');}
function favoriteArticle(item){
  const key=articleKey(item);
  return (state.favoriteArticles||[]).some(entry=>articleKey(entry)===key);
}
function toggleFavoriteArticle(item){
  const key=articleKey(item);
  const list=Array.isArray(state.favoriteArticles)?state.favoriteArticles:[];
  if(list.some(entry=>articleKey(entry)===key)){
    state.favoriteArticles=list.filter(entry=>articleKey(entry)!==key);
    toast('Статья убрана из любимых');
  }else{
    state.favoriteArticles=[{id:item.id||uid(),title:item.title||'Без названия',description:item.description||'',image:item.image||'',url:item.url||'',source:item.source||'',category:item.category||'Другое',created:Date.now()},...list].slice(0,120);
    toast('Статья добавлена в любимые');
  }
  persist();renderProfile();renderNews();
}
function showProfilePhoto(){
  const box=$('#profilePhotoViewer');if(!box)return;
  const photo=state.profile.photo;
  box.dataset.mode='photo';
  box.hidden=false;
  box.innerHTML=`<div class="photo-viewer-head"><div><p class="eyebrow">ФОТО ПРОФИЛЯ</p><strong>${escapeHtml(state.profile.name||'Твой профиль')}</strong></div><button type="button" class="row-btn" data-photo-close title="Скрыть">×</button></div><div class="photo-viewer-stage"><img src="${escapeHtml(photo)}" alt="Фото профиля" style="object-position:${Math.min(100,Math.max(0,+state.profile.photoX||50))}% ${Math.min(100,Math.max(0,+state.profile.photoY||50))}%"></div><div class="photo-viewer-actions"><a class="secondary-btn" href="${escapeHtml(photo)}" download="sphere-photo.jpg">Скачать</a>${isOwner(currentAccount)?'<button type="button" class="secondary-btn" data-photo-edit>Изменить</button>':''}</div>`;
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function galleryPhotoSrc(photo){
  if(!photo)return '';
  if(photo.src)return String(photo.src);
  if(!photo.key)return '';
  let url=galleryURLs.get(photo.key);
  if(!url){
    try{
      const blob=await audioStore('get',photo.key);
      if(blob){url=URL.createObjectURL(blob);galleryURLs.set(photo.key,url);}
    }catch{}
  }
  return url||'';
}
async function showGalleryPhoto(index){
  const box=$('#profilePhotoViewer');if(!box)return;
  const list=Array.isArray(state.gallery)?state.gallery:[];
  const position=Math.min(list.length-1,Math.max(0,index));
  const photo=list[position];if(!photo)return;
  const src=await galleryPhotoSrc(photo);
  box.dataset.mode='gallery';
  box.dataset.index=String(position);
  box.hidden=false;
  box.innerHTML=`<div class="photo-viewer-head"><div><p class="eyebrow">ГАЛЕРЕЯ · ${position+1} ИЗ ${list.length}</p><strong>${escapeHtml(photo.title||'Фото галереи')}</strong></div><button type="button" class="row-btn" data-photo-close title="Скрыть">×</button></div><div class="photo-viewer-stage"><img src="${escapeHtml(src||'')}" alt="${escapeHtml(photo.title||'Фото галереи')}"></div><div class="photo-viewer-actions">${list.length>1?'<button type="button" class="secondary-btn" data-photo-prev>← Назад</button><button type="button" class="secondary-btn" data-photo-next>Вперёд →</button>':''}<button type="button" class="secondary-btn" data-photo-remove="${escapeHtml(photo.id)}">Удалить</button></div>`;
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function hideProfilePhotoViewer(){
  const box=$('#profilePhotoViewer');if(!box)return;
  box.hidden=true;box.dataset.mode='';box.innerHTML='';
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-photo-close]')){hideProfilePhotoViewer();return;}
  const edit=e.target.closest('[data-photo-edit]');
  if(edit){hideProfilePhotoViewer();editProfile();return;}
  const prev=e.target.closest('[data-photo-prev]');
  if(prev){const box=$('#profilePhotoViewer');showGalleryPhoto(+box.dataset.index-1);return;}
  const next=e.target.closest('[data-photo-next]');
  if(next){const box=$('#profilePhotoViewer');showGalleryPhoto(+box.dataset.index+1);return;}
  const removeInViewer=e.target.closest('[data-photo-remove]');
  if(removeInViewer){
    const id=removeInViewer.dataset.photoRemove;
    const photo=(state.gallery||[]).find(item=>item.id===id);
    if(photo?.key){
      audioStore('delete',photo.key).catch(()=>{});
      const url=galleryURLs.get(photo.key);
      if(url){URL.revokeObjectURL(url);galleryURLs.delete(photo.key);}
    }
    state.gallery=(state.gallery||[]).filter(item=>item.id!==id);
    hideProfilePhotoViewer();
    persist();renderProfile();
    toast('Фото удалено из галереи');
    return;
  }
  const openAvatar=e.target.closest('#profileCard .profile-avatar');
  if(openAvatar){
    if(!state.profile.photo)return;
    showProfilePhoto();
    return;
  }
  const galleryPhoto=e.target.closest('[data-gallery-index]');
  if(galleryPhoto){showGalleryPhoto(+galleryPhoto.dataset.galleryIndex);return;}
});
function renderProfileHub(){
  const panel=$('#profileHubPanel'); if(!panel)return;
  $$('.profile-hub-tab').forEach(tab=>{const active=tab.dataset.profileSection===profileSection;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
  if(profileSection==='articles'){
    const articles=Array.isArray(state.favoriteArticles)?state.favoriteArticles:[];
    panel.innerHTML=articles.length?`<div class="profile-hub-list">${articles.map(item=>`<div class="profile-hub-item"><div class="profile-hub-copy"><strong>${escapeHtml(item.title||'Без названия')}</strong><small>${escapeHtml(item.source||'Источник')}${item.category?` · ${escapeHtml(item.category)}`:''}</small></div><div class="profile-hub-actions">${item.url?`<a class="row-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="Открыть статью">↗</a>`:''}<button type="button" class="row-btn" data-remove-article="${escapeHtml(articleKey(item))}" title="Убрать из любимых">×</button></div></div>`).join('')}</div>`:'<p class="empty-state">Любимых статей пока нет. Нажми ♥ на карточке в разделе «Статьи».</p>';
    return;
  }
  if(profileSection==='gallery'){
    const gallery=Array.isArray(state.gallery)?state.gallery:[];
    panel.innerHTML=`<div class="profile-gallery-toolbar"><button type="button" class="secondary-btn" id="addGalleryPhoto">＋ Добавить фото</button><input type="file" id="galleryPhotoInput" accept="image/*" multiple hidden></div>${gallery.length?`<div class="profile-gallery">${gallery.map((photo,index)=>`<figure class="profile-gallery-item"><img ${photo.key?`data-gallery-key="${escapeHtml(photo.key)}"`:''} ${photo.src?`src="${escapeHtml(photo.src)}"`:''} data-gallery-index="${index}" alt="${escapeHtml(photo.title||'Фото галереи')}"><button type="button" class="profile-gallery-remove" data-remove-gallery="${escapeHtml(photo.id)}" title="Удалить фото">×</button></figure>`).join('')}</div>`:'<p class="empty-state">Галерея пока пуста. Добавь фотографии, которые тебе нравятся.</p>'}`;
    $$('[data-gallery-key]',panel).forEach(async img=>{
      const key=img.dataset.galleryKey;
      try{
        let url=galleryURLs.get(key);
        if(!url){
          const blob=await audioStore('get',key);
          if(!blob)return;
          url=URL.createObjectURL(blob);
          galleryURLs.set(key,url);
        }
        if(img.isConnected)img.src=url;
      }catch{}
    });
    const addBtn=$('#addGalleryPhoto'),input=$('#galleryPhotoInput');
    if(addBtn&&input){addBtn.onclick=()=>input.click();input.onchange=async()=>{
      const files=[...input.files].filter(file=>file.type.startsWith('image/'));
      if(!files.length)return;
      if((state.gallery||[]).length+files.length>40){toast('В галерее может быть не больше 40 фото.',true);return;}
      let added=0;
      for(const file of files.slice(0,40)){
        if(file.size>15*1024*1024){toast(`Файл «${file.name}» больше 15 МБ.`,true);continue;}
        try{
          const id=uid(),key=`gallery-${id}`;
          await audioStore('put',key,file);
          state.gallery=[{id,key,title:file.name.replace(/\.[^.]+$/,''),created:Date.now()},...(state.gallery||[])];
          added++;
        }catch{}
      }
      if(!added)return;
      persist();renderProfile();toast(added===1?'Фото добавлено в галерею':`Добавлено фото: ${added}`);
    };}
    return;
  }
  const favorites=state.tracks.filter(track=>track.favorite);
  panel.innerHTML=favorites.length?`<div class="profile-hub-list">${favorites.map(track=>`<button type="button" class="profile-hub-item profile-hub-track" data-action="track-play" data-id="${track.id}"><span class="profile-hub-note">♪</span><div class="profile-hub-copy"><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist||'Исполнитель не указан')}</small></div><span class="row-btn">▶</span></button>`).join('')}</div><button type="button" class="text-btn profile-hub-open" data-open-favorites>Открыть плейлист любимых →</button>`:'<p class="empty-state">Любимых треков пока нет. Отметь трек сердечком в разделе «Музыка».</p>';
  const open=$('.profile-hub-open',panel);
  if(open)open.onclick=()=>{showView('music');selectedPlaylist='favorites';renderMusic();};
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
  if(!state.profile.photo&&$('#profilePhotoViewer')?.dataset.mode==='photo')hideProfilePhotoViewer();
  const cabinetBtn=$('#profileCabinetBgBtn');
  if(cabinetBtn){cabinetBtn.hidden=!owner;cabinetBtn.classList.toggle('has-bg',!!(cabinetBackgroundValue()||cabinetVideoValue()||cabinetShaderValue()));}
  applyCabinetBackground();
  $('#profileAliasLine').textContent=`@${state.profile.alias||'без_псевдонима'}`;
  $$('.profile-status').forEach(el=>el.remove());
  const favorites=state.tracks.filter(track=>track.favorite);
  const articles=Array.isArray(state.favoriteArticles)?state.favoriteArticles:[];
  const gallery=Array.isArray(state.gallery)?state.gallery:[];
  const trackCounter=$('#favoriteTrackCount');if(trackCounter)trackCounter.textContent=favorites.length;
  const articleCounter=$('#favoriteArticleCount');if(articleCounter)articleCounter.textContent=articles.length;
  const galleryCounter=$('#galleryCount');if(galleryCounter)galleryCounter.textContent=gallery.length;
  renderProfileHub();
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
  $('#newsList').innerHTML=items.length?items.map((item,index)=>`<article class="news-card card ${index===0?'featured-news':''}"><div class="article-icon ${item.image?'news-thumb':' '+(index%2?'blue':'orange')}" ${item.image?`style="background-image:url('${escapeHtml(item.image)}')"`:''}>${item.image?'':(index%2?'⌁':'✦')}</div><div class="news-content"><div class="news-meta"><span>${escapeHtml(String(item.category||'Другое').toUpperCase())}</span><small>${escapeHtml(item.source||'Источник')}</small><button type="button" class="news-favorite ${favoriteArticle(item)?'active':''}" data-news-favorite="${escapeHtml(articleKey(item))}" title="${favoriteArticle(item)?'Убрать из любимых статей':'Добавить в любимые статьи'}" aria-pressed="${favoriteArticle(item)}">${favoriteArticle(item)?'♥':'♡'}</button></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description||'')}</p><a href="${escapeHtml(item.url||'#')}" target="_blank" rel="noopener noreferrer">Читать источник →</a></div></article>`).join(''):empty('По выбранным фильтрам статей нет. Добавь источник или статью по ссылке.');
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
async function imageData(file,maxSide=900,quality=.86) {
  if(!file || !file.size) return null;
  if(!file.type.startsWith('image/')) throw new Error('Выберите изображение.');
  const bitmap=await createImageBitmap(file), scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',quality);
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
  releaseShaderPreview();
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
    const previousName=state.profile.name||'',previousAlias=state.profile.alias||'';
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
    const photoFile=data.get('photo');
    const videoFile=data.get('video');
    if(photoFile?.size&&!(await requireAdult('Установка фото на аватар доступна только с подтверждением 18+.'))){
      throw new Error('Сохранение отменено: нужно подтвердить возраст 18+.');
    }
    const newPhoto=await imageData(photoFile);
    const removePhoto=data.has('removePhoto');
    const photo=removePhoto&&!newPhoto?'':(newPhoto||state.profile.photo);
    let video=state.profile.video,videoDuration=+state.profile.videoDuration||0;
    if(data.has('removeVideo')){video='';videoDuration=0;}
    else if(videoFile?.size){const info=await videoData(videoFile);video=info.key;videoDuration=info.duration;}
    const previousVideo=state.profile.video;
    const newStatus=ownerAccount?(String(data.get('status')).trim()||'✦ В своём ритме'):state.profile.status;
    state.profile={...state.profile,name,alias:newAlias,status:newStatus,photo,photoX:photo?cropState.x:50,photoY:photo?cropState.y:50,photoScale:photo?cropState.scale:1,video,videoStart:0,videoEnd:0,videoDuration:video?videoDuration:0};
    if(previousVideo&&previousVideo!==video)audioStore('delete',previousVideo).catch(()=>{});
    if(previousAlias&&normalizeAlias(newAlias)!==normalizeAlias(previousAlias))logAction('изменил псевдоним',`@${normalizeAlias(previousAlias)} → @${normalizeAlias(newAlias)}`,currentAccount?.id||'');
    if(previousName&&name!==previousName)logAction('изменил ник',`${previousName} → ${name}`,currentAccount?.id||'');
    saveAndRender();toast('Профиль сохранён');
  });
  initPhotoCrop();
  loadProfileVideoPreview();
}
let shaderPreview=null,shaderPreviewBusy=false,shaderPreviewToken=0;
function releaseShaderPreview(){
  shaderPreviewToken++;
  if(shaderPreview){try{shaderPreview.destroy();}catch{}shaderPreview=null;}
  shaderPreviewBusy=false;
}
function shaderFormColors(){
  const colors={};
  for(const key of Object.keys(CABINET_SHADER_DEFAULTS)){
    const text=$(`[name="${key}"]`,editor);
    colors[key]=normalizeHexColor(text?.value)||CABINET_SHADER_DEFAULTS[key];
  }
  return colors;
}
function updateShaderPreview(key,hex){
  if(shaderPreview)shaderPreview.update(CABINET_SHADER_LAYER,{[key]:hex});
}
async function startShaderPreview(){
  const canvas=$('#shaderBgPreview',editor);
  if(!canvas||shaderPreview||shaderPreviewBusy)return;
  canvas.style.cssText='display:block;width:100%;height:100%;';
  shaderPreviewBusy=true;
  const token=++shaderPreviewToken;
  try{
    const {createShader}=await loadShadersRuntime();
    if(token!==shaderPreviewToken||!editor.open)return;
    const instance=await createShader(canvas,cabinetShaderPreset(shaderFormColors()));
    if(token!==shaderPreviewToken){try{instance.destroy();}catch{}return;}
    shaderPreview=instance;
  }catch(error){
    console.warn('Не удалось показать превью градиента:',error);
  }finally{
    if(token===shaderPreviewToken)shaderPreviewBusy=false;
  }
}
function shaderBgEditorMarkup(colors,opacity){
  const values=colors||CABINET_SHADER_DEFAULTS;
  if(!isFinite(opacity))opacity=100;
  const labels={colorA:'Цвет A',colorB:'Цвет B',colorC:'Цвет C',colorD:'Цвет D'};
  const cells=Object.keys(CABINET_SHADER_DEFAULTS).map(key=>`<div class="shader-color-cell"><span>${labels[key]}</span><input type="color" name="${key}Pick" value="${values[key]}"><input type="text" name="${key}" value="${values[key]}" maxlength="7" spellcheck="false" aria-label="${labels[key]} HEX"></div>`).join('');
  return `<label class="checkbox-label"><input type="checkbox" name="shaderBg" ${colors?'checked':''}> Живой градиент «Evening Starling»</label><div class="shader-bg-panel" id="shaderBgPanel" hidden><div class="shader-bg-preview"><canvas id="shaderBgPreview"></canvas></div><div class="shader-opacity-row"><label for="shaderOpacity">Прозрачность</label><input type="range" id="shaderOpacity" name="shaderOpacity" min="0" max="100" step="1" value="${opacity}"><output id="shaderOpacityOut">${opacity}%</output></div><div class="shader-color-grid">${cells}</div><p class="help-text" id="shaderBgHint">До четырёх HEX-цветов: #rgb, #rrggbb или без решётки. Градиент заменяет фото/видео-фон и работает на WebGPU.</p></div>`;
}
function initShaderBgEditor(){
  const check=$('[name="shaderBg"]',editor),panel=$('#shaderBgPanel',editor);
  if(!check||!panel)return;
  if(!navigator.gpu){
    check.disabled=true;
    const hint=$('#shaderBgHint',editor);
    if(hint)hint.textContent='Ваш браузер не поддерживает WebGPU — живой градиент недоступен.';
  }
  for(const key of Object.keys(CABINET_SHADER_DEFAULTS)){
    const text=$(`[name="${key}"]`,editor),pick=$(`[name="${key}Pick"]`,editor);
    if(!text||!pick)continue;
    const cell=text.closest('.shader-color-cell');
    pick.addEventListener('input',()=>{text.value=pick.value;cell?.classList.remove('invalid');updateShaderPreview(key,pick.value.toLowerCase());});
    text.addEventListener('input',()=>{
      const hex=normalizeHexColor(text.value);
      if(hex){cell?.classList.remove('invalid');pick.value=hex;updateShaderPreview(key,hex);}
      else cell?.classList.add('invalid');
    });
  }
  const range=$('[name="shaderOpacity"]',editor),out=$('#shaderOpacityOut',editor);
  if(range)range.addEventListener('input',()=>{
    const v=Math.min(100,Math.max(0,Math.round(+range.value||0)));
    range.value=String(v);
    if(out)out.textContent=v+'%';
    const main=$('#cabinetBgShader');
    if(main)main.style.opacity=(v/100).toFixed(3);
  });
  const sync=()=>{panel.hidden=!check.checked;if(check.checked)startShaderPreview();};
  check.addEventListener('change',sync);
  sync();
}
function editCabinetBackground(){
  if(!isOwner(currentAccount)){toast('Фон личного кабинета может менять только владелец.',true);return;}
  const currentImage=cabinetBackgroundValue(),currentVideo=cabinetVideoValue(),currentShader=cabinetShaderValue(),currentOpacity=cabinetShaderOpacity();
  const hasBg=!!(currentImage||currentVideo||currentShader);
  openEditor('Фон личного кабинета',`<p class="help-text">Это фон всей страницы личного кабинета, а не область рядом с аватаркой. Можно загрузить фото или видео до минуты (до 80 МБ) либо включить живой градиент — он отображается на всех вкладках.</p>${field('Фото или видео',input('bg','','file','accept="image/*,video/*"'))}${shaderBgEditorMarkup(currentShader,currentOpacity)}${hasBg?'<label class="checkbox-label"><input type="checkbox" name="removeBg"> Удалить текущий фон</label>':''}`,async data=>{
    const file=data.get('bg');
    const remove=data.has('removeBg');
    let image=remove?'':currentImage;
    let videoKey=remove?'':currentVideo;
    let shader=remove?null:currentShader;
    if(data.has('shaderBg')){
      if(!navigator.gpu)throw new Error('Ваш браузер не поддерживает WebGPU — живой градиент недоступен.');
      const colors={};
      for(const key of Object.keys(CABINET_SHADER_DEFAULTS)){
        const hex=normalizeHexColor(data.get(key));
        if(!hex)throw new Error('Цвета градиента должны быть в формате HEX, например #cd00ff.');
        colors[key]=hex;
      }
      const rawOp=Number(data.get('shaderOpacity'));
      const op=isFinite(rawOp)?Math.min(100,Math.max(0,Math.round(rawOp))):100;
      shader={...colors,opacity:op};image='';videoKey='';
    }else if(file?.size){
      if(file.type.startsWith('image/')){
        image=await imageData(file,1920,.84);
        videoKey='';shader=null;
      }else if(file.type.startsWith('video/')){
        const info=await videoData(file);
        videoKey=info.key;image='';shader=null;
      }else{
        throw new Error('Выберите фото или видео.');
      }
    }else{
      shader=null;
    }
    if(currentVideo&&currentVideo!==videoKey)audioStore('delete',currentVideo).catch(()=>{});
    if(image)state.profile.cabinetBg=image;else delete state.profile.cabinetBg;
    if(videoKey)state.profile.cabinetBgVideo=videoKey;else delete state.profile.cabinetBgVideo;
    if(shader)state.profile.cabinetBgShader=shader;else delete state.profile.cabinetBgShader;
    logAction(shader?'установил живой градиент фоном личного кабинета':videoKey?'установил видео-фон личного кабинета':image?'изменил фон личного кабинета':'убрал фон личного кабинета','');
    saveAndRender();applyCabinetBackground();
    toast(shader?'Живой градиент сохранён':videoKey?'Видео-фон личного кабинета сохранён':image?'Фон личного кабинета сохранён':'Фон личного кабинета удалён');
  },'Сохранить');
  initShaderBgEditor();
}
$$('[data-profile-tool="edit"]').forEach(b=>b.onclick=editProfile);
$('#profileCabinetBgBtn')?.addEventListener('click',editCabinetBackground);
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
document.addEventListener('click',e=>{
  const hubTab=e.target.closest('[data-profile-section]');
  if(hubTab){profileSection=hubTab.dataset.profileSection;renderProfileHub();return;}
  const removeArticle=e.target.closest('[data-remove-article]');
  if(removeArticle){
    const key=removeArticle.dataset.removeArticle;
    state.favoriteArticles=(state.favoriteArticles||[]).filter(item=>articleKey(item)!==key);
    persist();renderProfile();renderNews();toast('Статья убрана из любимых');return;
  }
  const removePhoto=e.target.closest('[data-remove-gallery]');
  if(removePhoto){
    const id=removePhoto.dataset.removeGallery;
    const viewer=$('#profilePhotoViewer');
    if(viewer?.dataset.mode==='gallery'&&viewer.innerHTML.includes(`data-photo-remove="${id}"`))hideProfilePhotoViewer();
    const photo=(state.gallery||[]).find(item=>item.id===id);
    if(photo?.key){
      audioStore('delete',photo.key).catch(()=>{});
      const url=galleryURLs.get(photo.key);
      if(url){URL.revokeObjectURL(url);galleryURLs.delete(photo.key);}
    }
    state.gallery=(state.gallery||[]).filter(item=>item.id!==id);
    persist();renderProfile();toast('Фото удалено из галереи');return;
  }
  const newsFavorite=e.target.closest('[data-news-favorite]');
  if(newsFavorite){
    const key=newsFavorite.dataset.newsFavorite;
    const item=newsAllItems().find(entry=>articleKey(entry)===key);
    if(item)toggleFavoriteArticle(item);
    return;
  }
});
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
// --- Синхронизация аудио между устройствами (Supabase Storage) ---
const MEDIA_BUCKET='sphere-audio';
let mediaSyncing=false;
function mediaPathUrl(path,publicUrl){
  const clean=String(path||'').split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/${publicUrl?'public/':''}${MEDIA_BUCKET}/${clean}`;
}
function mediaPublicUrl(path){return mediaPathUrl(path,true);}
function mediaExt(file){
  const match=/\.([a-z0-9]{2,5})$/i.exec(String(file?.name||''));
  if(match)return match[1].toLowerCase();
  const type=String(file?.type||'').split('/')[1]||'bin';
  return type.replace(/[^a-z0-9]/gi,'').toLowerCase()||'bin';
}
async function uploadTrackMedia(track,blob,file){
  if(!CLOUD_ENABLED||!currentAccount?.id||!track?.id||!blob?.size)return '';
  if(blob.size>45*1024*1024)return '';
  const path=`${currentAccount.id}/${track.id}.${mediaExt(file||blob)}`;
  try{
    const response=await fetch(mediaPathUrl(path,false),{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,'x-upsert':'true','Content-Type':blob.type||'application/octet-stream'},body:blob});
    if(!response.ok)return '';
    track.cloudPath=path;
    return path;
  }catch{return '';}
}
async function deleteTrackMedia(track){
  if(!CLOUD_ENABLED||!track?.cloudPath)return;
  try{await fetch(mediaPathUrl(track.cloudPath,false),{method:'DELETE',headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});}catch{}
}
function cacheCloudAudio(track){
  if(!track?.cloudPath)return;
  audioStore('get',track.id).then(existing=>{
    if(existing)return null;
    return fetch(mediaPublicUrl(track.cloudPath)).then(response=>response.ok?response.blob():null).then(blob=>blob?.size?audioStore('put',track.id,blob):null);
  }).catch(()=>{});
}
function offerTrackUpload(track){
  if(!track)return;
  openEditor('Аудиофайл не найден',
    `<p class="help-text">Файл «${escapeHtml(track.title)}» хранится только на том устройстве, где трек был добавлен. Выбери этот аудиофайл здесь — он привяжется к треку и загрузится в облако.</p>`+field('Аудиофайл',input('audio','','file','accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac,.aac,.opus" required')),
    async data=>{
      const file=data.get('audio');
      if(!file?.size)throw new Error('Выберите аудиофайл.');
      if(file.size>150*1024*1024)throw new Error('Максимальный размер аудиофайла — 150 МБ.');
      await audioStore('put',track.id,file);
      const duration=await trackDuration(file);
      if(duration)track.duration=duration;
      const path=await uploadTrackMedia(track,file,file);
      persist();renderMusic();
      toast(path?'Файл привязан к треку и загружен в облако':'Файл привязан к треку');
      playTrack(track.id);
    },'Привязать файл');
}
async function syncMediaToCloud(){
  if(!CLOUD_ENABLED){toast('Облако не настроено.',true);return;}
  if(!currentAccount?.id){toast('Войди в аккаунт, чтобы синхронизировать аудио.',true);return;}
  if(mediaSyncing){toast('Синхронизация уже идёт.');return;}
  const list=state.tracks.filter(track=>!track.cloudPath&&!track.embedUrl);
  if(!list.length){toast('Все аудиофайлы уже синхронизированы.');return;}
  mediaSyncing=true;
  toast(`Загружаю аудио: ${list.length}…`);
  let done=0,failed=0;
  for(const track of list){
    try{
      const blob=await audioStore('get',track.id);
      if(!blob){failed++;continue;}
      const path=await uploadTrackMedia(track,blob);
      if(path)done++;else failed++;
    }catch{failed++;}
  }
  mediaSyncing=false;
  if(done)persist();
  if(!done)toast('Не удалось загрузить аудио. Проверь облачное хранилище.',true);
  else if(failed)toast(`Синхронизировано: ${done}. Не удалось: ${failed}.`,true);
  else toast(`Аудио синхронизировано: ${done}`);
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
const audio=new Audio();audio.preload='metadata';let objectURL='',playGeneration=0,embedPlaying=false,lastAudibleVolume=.85;
const volumeSlider=$('#volumeSlider'),volumeValue=$('#volumeValue'),muteBtn=$('#muteBtn');
const playlistVolumeSlider=$('#playlistVolumeSlider'),playlistVolumeValue=$('#playlistVolumeValue'),playlistMuteBtn=$('#playlistVolumeMuteBtn');
function volumeFromState(){const value=+state?.settings?.volume;return Number.isFinite(value)?Math.min(1,Math.max(0,value)):.85;}
function updateVolumeUI(){
  const percent=Math.round(audio.volume*100);
  if(volumeSlider)volumeSlider.value=String(percent);
  if(playlistVolumeSlider){playlistVolumeSlider.value=String(percent);playlistVolumeSlider.disabled=embedPlaying;playlistVolumeSlider.title=embedPlaying?'Громкость встроенного плеера регулируется в сервисе':'Громкость трека';}
  if(volumeValue)volumeValue.textContent=embedPlaying?'в сервисе':`${percent}%`;
  if(playlistVolumeValue)playlistVolumeValue.textContent=embedPlaying?'—':`${percent}%`;
  const muted=percent===0,muteLabel=muted?'Включить звук':'Выключить звук';
  [muteBtn,playlistMuteBtn].forEach(btn=>{if(!btn)return;btn.textContent=muted?'🔇':'🔊';btn.title=muteLabel;btn.setAttribute('aria-label',muteLabel);btn.setAttribute('aria-pressed',String(muted));});
  if(volumeSlider){volumeSlider.disabled=embedPlaying;volumeSlider.closest('.volume-control')?.classList.toggle('is-disabled',embedPlaying);volumeSlider.title=embedPlaying?'Громкость встроенного плеера регулируется в сервисе':'Громкость трека';}
}
function applyVolumeFromState(){audio.volume=volumeFromState();lastAudibleVolume=audio.volume||.85;updateVolumeUI();}
function commitVolume(){state.settings.volume=audio.volume;persist();}
volumeSlider?.addEventListener('input',()=>{audio.volume=Math.min(1,Math.max(0,+volumeSlider.value/100));if(audio.volume>0)lastAudibleVolume=audio.volume;updateVolumeUI();});
volumeSlider?.addEventListener('change',()=>{commitVolume();});
function toggleMute(){if(audio.volume>0){lastAudibleVolume=audio.volume;audio.volume=0;}else audio.volume=lastAudibleVolume||volumeFromState()||.85;commitVolume();updateVolumeUI();}
muteBtn?.addEventListener('click',toggleMute);
playlistVolumeSlider?.addEventListener('input',()=>{audio.volume=Math.min(1,Math.max(0,+playlistVolumeSlider.value/100));if(audio.volume>0)lastAudibleVolume=audio.volume;updateVolumeUI();});
playlistVolumeSlider?.addEventListener('change',()=>{commitVolume();});
playlistMuteBtn?.addEventListener('click',toggleMute);
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
function updateNowPlayingLike(){
  const btn=$('#nowPlayingLike');if(!btn)return;
  const track=state.tracks.find(t=>t.id===currentTrack);
  btn.hidden=!track;
  if(!track)return;
  btn.dataset.id=track.id;
  btn.classList.toggle('liked',!!track.favorite);
  btn.textContent=track.favorite?'♥':'♡';
  const label=track.favorite?'Убрать из любимых':'Добавить в любимые';
  btn.setAttribute('aria-label',label);
  btn.setAttribute('aria-pressed',String(!!track.favorite));
  btn.title=label;
}
function tracksWord(n){const m=n%100;if(m>=11&&m<=14)return 'треков';const d=n%10;return d===1?'трек':d>=2&&d<=4?'трека':'треков';}
function tracksLabel(n){return `${n} ${tracksWord(n)}`;}
function playlistCoverMarkup(playlist){
  if(!playlist?.cover)return '<span>♪</span>';
  return `<img src="${escapeHtml(playlist.cover)}" alt="Обложка плейлиста ${escapeHtml(playlist.name||'')}">`;
}
function trackDurationText(track){
  const value=+track?.duration||0;
  if(value>0)return timerText(Math.floor(value));
  if(track&&track.id===currentTrack&&Number.isFinite(audio.duration)&&audio.duration>0)return timerText(Math.floor(audio.duration));
  return '—';
}
function trackLineMarkup(track){
  const active=track.id===currentTrack;
  const playing=active&&(embedPlaying||(!audio.paused&&!!audio.src));
  const liked=!!track.favorite;
  const likeLabel=liked?'Убрать из любимых':'Добавить в любимые';
  return `<div class="track-line ${active?'playing':''}" data-track-row="${track.id}" role="button" tabindex="0" aria-label="Играть: ${escapeHtml(track.title)}">
    <button type="button" class="track-line-index" data-action="track-play" data-id="${track.id}" title="${playing?'Пауза':'Играть'}" aria-label="${playing?'Пауза':'Играть'}">${track.cover?`<img src="${escapeHtml(track.cover)}" alt="">`:(playing?'Ⅱ':'♪')}</button>
    <div class="track-line-main">
      <div class="track-line-title"><strong>${escapeHtml(track.title)}</strong></div>
      <div class="track-line-actions">
        <span class="track-line-dur">${trackDurationText(track)}</span>
        <button type="button" class="heart-btn${liked?' liked':''}" data-action="track-favorite" data-id="${track.id}" aria-label="${likeLabel}" aria-pressed="${liked}" title="${likeLabel}">${liked?'♥':'♡'}</button>
        ${track.sourceUrl?`<a class="track-line-link" href="${escapeHtml(track.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="Открыть источник">↗</a>`:''}
        <button type="button" data-action="track-edit" data-id="${track.id}" title="Изменить трек" aria-label="Изменить трек">✎</button>
        <button type="button" data-action="track-delete" data-id="${track.id}" title="Удалить трек" aria-label="Удалить трек">×</button>
      </div>
      <div class="track-line-artist"><span>${escapeHtml(track.artist||'Исполнитель не указан')}${track.service?` · ${escapeHtml(track.service)}`:''}</span><select class="hit-select track-line-select" data-track="${track.id}" aria-label="Категория ${escapeHtml(track.title)}">${Object.entries(hits).map(([key,label])=>`<option value="${key}" ${key===track.hit?'selected':''}>${label}</option>`).join('')}</select></div>
    </div>
  </div>`;
}
function renderMusic() {
  updateNowPlayingLike();
  $('#musicHero')?.classList.toggle('empty-player', !currentTrack);
  const page=$('#musicPlaylistPage'),library=$('#musicLibrary'),libraryCard=$('#musicLibraryCard');
  const playlist=state.playlists.find(p=>p.id===selectedPlaylist);
  const favoritesView=selectedPlaylist==='favorites';
  const open=!!selectedPlaylist;
  if(page)page.hidden=!open;
  if(library)library.hidden=open;
  if(libraryCard)libraryCard.hidden=open;
  $('#playlistGrid').innerHTML=state.playlists.length?state.playlists.map(p=>`<article class="playlist-card ${p.id===selectedPlaylist?'selected':''}" data-playlist="${p.id}" role="button" tabindex="0" aria-label="Открыть плейлист «${escapeHtml(p.name)}»"><div class="playlist-card-cover">${playlistCoverMarkup(p)}</div><strong>${escapeHtml(p.name)}</strong><small>${tracksLabel(state.tracks.filter(t=>t.playlist===p.id).length)}</small><div class="tool-controls">${button('track-add',p.id,'+','text-btn')}${button('playlist-edit',p.id,'✎','row-btn')}${button('playlist-delete',p.id,'×','row-btn')}</div></article>`).join(''):'';
  let list=selectedPlaylist==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist);
  if(musicSort!=='new'&&!selectedPlaylist)list=list.filter(t=>t.hit===musicSort);
  list=[...list].sort((a,b)=>b.created-a.created);
  if(open){
    const title=$('#playlistTitle'),meta=$('#playlistMeta'),art=$('#playlistCoverArt');
    if(title)title.textContent=favoritesView?'Любимые треки':(playlist?.name||'Плейлист');
    if(meta){const total=list.reduce((sum,t)=>sum+(+t.duration||0),0);meta.textContent=`${tracksLabel(list.length)}${total?' · '+timerText(Math.round(total)):''}`;}
    if(art){if(playlist?.cover){art.innerHTML=`<img src="${escapeHtml(playlist.cover)}" alt="">`;art.classList.add('has-cover');}else{art.textContent='♪';art.classList.remove('has-cover');}}
    const coverBtn=$('#playlistCoverBtn'),editBtn=$('#playlistEditBtn'),addBtn=$('#playlistAddTrack');
    if(coverBtn)coverBtn.hidden=favoritesView;
    if(editBtn)editBtn.hidden=favoritesView||!playlist;
    if(addBtn)addBtn.hidden=favoritesView;
    const playAll=$('#playlistPlayAll'),shuffleAll=$('#playlistShuffleAll');
    if(playAll)playAll.disabled=!list.length;
    if(shuffleAll)shuffleAll.disabled=!list.length;
    $('#playlistTracks').innerHTML=list.length?list.map(trackLineMarkup).join(''):`<p class="empty-state">${favoritesView?'Ты пока не отметил ни одного трека сердечком.':'В этом плейлисте пока нет треков. Добавь первый.'}</p>`;
  }else{
    $('#trackCount').textContent=tracksLabel(list.length);
    $('#trackList').innerHTML=list.length?list.map(trackLineMarkup).join(''):'<p class="empty-state">Добавь первый трек, чтобы начать собирать фонотеку.</p>';
  }
}
function playlistEditor(id) {
  const playlist=state.playlists.find(p=>p.id===id);
  openEditor(playlist?'Название плейлиста':'Новый плейлист',field('Название',input('name',playlist?.name||'','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');if(playlist){playlist.name=name;logAction('переименовал плейлист',`«${name}»`,playlist.id);}else{const id=uid();state.playlists.push({id,name});selectedPlaylist=id;logAction('создал плейлист',`«${name}»`,id);}saveAndRender();});
}
$('#createPlaylist').onclick=()=>playlistEditor(null);
$('#addTrack').onclick=()=>addTrackDialog('');
function choosePlaylistCover(id){
  const playlist=state.playlists.find(p=>p.id===id);if(!playlist)return;
  const input=document.createElement('input');input.type='file';input.accept='image/*';
  input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    if(file.size>12*1024*1024){toast('Обложка больше 12 МБ.',true);return;}
    try{
      const cover=await imageData(file,640,.85);
      if(!cover)return;
      playlist.cover=cover;persist();renderMusic();
      toast('Обложка плейлиста обновлена');
    }catch(error){toast(error.message||'Не удалось загрузить обложку.',true);}
  };
  input.click();
}
$('#playlistBack').onclick=()=>{selectedPlaylist='';renderMusic();};
$('#playlistPlayAll').onclick=()=>playPlaylist(selectedPlaylist);
$('#playlistShuffleAll').onclick=()=>{setMusicShuffle(true);playPlaylist(selectedPlaylist);};
$('#playlistAddTrack').onclick=()=>addTrackDialog(selectedPlaylist&&selectedPlaylist!=='favorites'?selectedPlaylist:'');
$('#playlistEditBtn').onclick=()=>{if(selectedPlaylist&&selectedPlaylist!=='favorites')playlistEditor(selectedPlaylist);};
$('#playlistCoverBtn').onclick=()=>choosePlaylistCover(selectedPlaylist);
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
async function trackDuration(file){
  if(!file?.size)return 0;
  try{
    const value=await probeVideoDuration(URL.createObjectURL(file));
    return Number.isFinite(value)&&value>0?value:0;
  }catch{return 0;}
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
        const duration=await trackDuration(file);
        const record={id,title:meta.title,artist:meta.artist,playlist,hit,favorite:false,created:Date.now()+addedTracks.length,cover,duration};
        await uploadTrackMedia(record,file,file);
        addedTracks.push(record);
      }
      state.tracks.push(...addedTracks);
      selectedPlaylist=playlist;
      const playlistName=playlists.find(item=>item.id===playlist)?.name||'';
      logAction(addedTracks.length===1?'добавил трек':'добавил треки',`${addedTracks.length} шт. · ${playlistName}`,addedTracks[0]?.id||'');
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
      const duration=file?.size?await trackDuration(file):(+track?.duration||0);
      const record={...track,id,title,artist:String(data.get('artist')).trim(),playlist:String(data.get('playlist')),hit:String(data.get('hit')),cover,duration,created:track?.created||Date.now(),favorite:!!track?.favorite,audioUrl:file?.size?'':track?.audioUrl};
      if(file?.size){const oldPath=track?.cloudPath||'';const path=await uploadTrackMedia(record,file,file);if(path&&oldPath&&oldPath!==path)deleteTrackMedia({cloudPath:oldPath});}
      if(track)state.tracks[state.tracks.indexOf(track)]=record;else state.tracks.push(record);
      logAction(track?'изменил трек':'добавил трек',`«${title}»${record.artist?` · ${record.artist}`:''}`,id);
      saveAndRender();toast('Трек сохранён');
    });
}
function playEmbed(track){
  audio.pause();if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}
  currentTrack=track.id;embedPlaying=true;updateVolumeUI();
  const titleEl=$('#nowPlayingTitle'),artistEl=$('#nowPlayingArtist'),artEl=$('.album-art'),heroEl=$('#musicHero');
  if(titleEl)titleEl.textContent=track.title;
  if(artistEl)artistEl.textContent=`${track.artist||'Исполнитель не указан'}${track.service?` · ${track.service}`:''}`;
  if(artEl)artEl.innerHTML=`<iframe class="music-embed" src="${escapeHtml(track.embedUrl)}" title="${escapeHtml(track.title)}" allow="autoplay; encrypted-media; fullscreen; clipboard-write" loading="lazy"></iframe>`;
  if(heroEl){heroEl.classList.remove('empty-player');heroEl.classList.add('embed-playing');}
  const currentEl=$('#musicCurrent'),durationEl=$('#musicDuration'),progressEl=$('#musicProgress'),playEl=$('#playBtn');
  if(currentEl)currentEl.textContent='—';if(durationEl)durationEl.textContent='—';if(progressEl)progressEl.style.width='0%';if(playEl)playEl.textContent='Ⅱ';
  const bar=$('#musicProgressBar');if(bar){bar.classList.add('disabled');bar.setAttribute('aria-valuemax','0');bar.setAttribute('aria-valuenow','0');bar.setAttribute('aria-valuetext','Встроенный плеер');}
  startAura(track,{synthetic:true});updateMiniPlayer();renderMusic();
  toast('Трек открыт во встроенном плеере сервиса.');
}
async function playTrack(id) {
  if(currentTrack===id&&(embedPlaying||audio.src)){
    if(embedPlaying){stopCurrentTrack();return;}
    if(audio.paused){try{await audio.play();startAura(state.tracks.find(t=>t.id===id));updateMiniPlayer();}catch{toast('Не удалось воспроизвести файл.',true);}}
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
      if(!blob){
        if(track.cloudPath){src=mediaPublicUrl(track.cloudPath);cacheCloudAudio(track);}
        else if(track.sourceUrl){toast('Прямой аудиопоток недоступен. Открой источник по ссылке ↗',true);return;}
        else{offerTrackUpload(track);return;}
      }else{
        src=URL.createObjectURL(blob);fromBlob=true;
        if(!track.cloudPath){uploadTrackMedia(track,blob).then(path=>{if(path)persist();});}
      }
    }
    audio.pause();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=fromBlob?src:'';audio.src=src;currentTrack=id;embedPlaying=false;updateVolumeUI();updateNowPlayingLike();$('#musicProgressBar')?.classList.remove('disabled');
    const titleEl=$('#nowPlayingTitle'),artistEl=$('#nowPlayingArtist'),artEl=$('.album-art'),heroEl=$('#musicHero');
    if(titleEl)titleEl.textContent=track.title;if(artistEl)artistEl.textContent=track.artist||'Исполнитель не указан';if(artEl)artEl.innerHTML=coverMarkup(track,'playing-cover');if(heroEl)heroEl.classList.remove('empty-player','embed-playing');await audio.play();startAura(track);updateMiniPlayer();
  }catch(error){stopAura();toast(error.message||'Не удалось воспроизвести трек.',true);}
}
let musicShuffle=false,musicLoop=false;
function playPlaylist(id,quiet){
  const list=id==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>t.playlist===id);
  if(!list.length){toast(id==='favorites'?'В любимых пока нет треков.':'В этом плейлисте пока нет треков.');return;}
  selectedPlaylist=id;renderMusic();
  const start=(list.find(t=>t.id!==currentTrack)||list[0]).id;
  playTrack(start);
}
function nextTrack(direction) {
  let list=selectedPlaylist==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist);
  if(musicSort!=='new'&&!selectedPlaylist)list=list.filter(t=>t.hit===musicSort);
  if(!list.length){toast(selectedPlaylist==='favorites'?'В любимых пока нет треков.':'Добавь треки в плейлист.');return;}
  const count=list.length,index=list.findIndex(t=>t.id===currentTrack);
  let step=(index+direction+count)%count;
  if(musicShuffle&&count>1){do{step=Math.floor(Math.random()*count);}while(step===index);}
  playTrack(list[step].id);
}
const playBtnEl=$('#playBtn'),prevBtnEl=$('#prevTrack'),nextBtnEl=$('#nextTrack');
if(playBtnEl)playBtnEl.onclick=()=>currentTrack?playTrack(currentTrack):nextTrack(1);
if(prevBtnEl)prevBtnEl.onclick=()=>nextTrack(-1);
if(nextBtnEl)nextBtnEl.onclick=()=>nextTrack(1);
audio.onplay=()=>{const btn=$('#playBtn');if(btn)btn.textContent='Ⅱ';updateMiniPlayer();renderMusic();};audio.onpause=()=>{const btn=$('#playBtn');if(btn)btn.textContent='▶';if(!embedPlaying)stopAura();updateMiniPlayer();renderMusic();};audio.onended=()=>{if(musicLoop&&currentTrack){audio.currentTime=0;audio.play().catch(()=>{stopAura();nextTrack(1);});return;}stopAura();nextTrack(1);};audio.onerror=()=>{stopAura();toast('Формат аудио не поддерживается или файл повреждён.',true);};
function musicProgressUpdate(){
  const duration=Number.isFinite(audio.duration)?audio.duration:0;
  const current=Math.min(audio.currentTime||0,duration||0);
  const percent=duration?current/duration*100:0;
  const currentEl=$('#musicCurrent'),durationEl=$('#musicDuration'),progressEl=$('#musicProgress');
  if(currentEl)currentEl.textContent=timerText(Math.floor(current));
  if(durationEl)durationEl.textContent=duration?timerText(Math.floor(duration)):'0:00';
  if(progressEl)progressEl.style.width=percent+'%';
  const miniBar=$('#miniPlayerBar');if(miniBar)miniBar.style.width=percent+'%';
  const miniSeek=$('#miniPlayerSeek');
  if(miniSeek){
    if(embedPlaying)miniSeek.setAttribute('aria-valuetext','Встроенный плеер');
    else{miniSeek.setAttribute('aria-valuemax',String(Math.round(duration)));miniSeek.setAttribute('aria-valuenow',String(Math.round(current)));miniSeek.setAttribute('aria-valuetext',`${timerText(Math.floor(current))} из ${timerText(Math.floor(duration))}`);}
  }
  const bar=$('#musicProgressBar');
  if(bar){
    bar.setAttribute('aria-valuemax',String(Math.round(duration)));
    bar.setAttribute('aria-valuenow',String(Math.round(current)));
    bar.setAttribute('aria-valuetext',`${timerText(Math.floor(current))} из ${timerText(Math.floor(duration))}`);
    bar.title=duration?'Нажми или перетащи, чтобы перемотать':'Перемотка появится после загрузки трека';
  }
}
audio.ontimeupdate=musicProgressUpdate;
audio.onloadedmetadata=()=>{const track=state.tracks.find(t=>t.id===currentTrack);if(track&&Number.isFinite(audio.duration)&&audio.duration>0&&Math.abs((+track.duration||0)-audio.duration)>.5){track.duration=audio.duration;persist();renderMusic();}musicProgressUpdate();};
const musicProgressBar=$('#musicProgressBar');
let musicSeeking=false;
function seekMusicAt(event){
  if(embedPlaying||!audio.src)return false;
  const duration=audio.duration;
  if(!Number.isFinite(duration)||duration<=0)return false;
  const box=musicProgressBar.getBoundingClientRect();
  if(box.width<=0)return false;
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
function miniCoverMarkup(track){
  if(!track?.cover)return '<span>♪</span>';
  return `<img src="${escapeHtml(track.cover)}" alt="">`;
}
function updateMiniPlayer(){
  const panel=$('#miniPlayer');if(!panel)return;
  const track=state.tracks.find(item=>item.id===currentTrack);
  const playing=!!track&&(embedPlaying||(!audio.paused&&!!audio.src));
  if(!track){panel.hidden=true;panel.classList.remove('visible');return;}
  panel.hidden=false;
  panel.classList.add('visible');
  const title=$('#miniPlayerTitle'),artist=$('#miniPlayerArtist');
  if(title)title.textContent=track.title||'Без названия';
  if(artist)artist.textContent=track.artist||'Исполнитель не указан';
  const cover=$('#miniPlayerCover');
  if(cover)cover.innerHTML=miniCoverMarkup(track);
  const play=$('#miniPlayerPlay');
  if(play){
    play.textContent=embedPlaying?'■':(playing?'Ⅱ':'▶');
    const label=embedPlaying?'Остановить встроенный плеер':(playing?'Пауза':'Воспроизведение');
    play.setAttribute('aria-label',label);
    play.title=label;
  }
  const bar=$('#miniPlayerBar');
  if(bar)bar.style.width=embedPlaying?'0%':((()=>{const duration=Number.isFinite(audio.duration)?audio.duration:0;return duration?Math.min(1,(audio.currentTime||0)/duration)*100:0;})()+'%');
}
$('#miniPlayerPlay')?.addEventListener('click',()=>{if(currentTrack)playTrack(currentTrack);});
$('#miniPlayerPrev')?.addEventListener('click',()=>nextTrack(-1));
$('#miniPlayerNext')?.addEventListener('click',()=>nextTrack(1));
const miniPlayerSeek=$('#miniPlayerSeek');
let miniSeeking=false;
function seekMiniAt(event){
  if(embedPlaying||!audio.src)return false;
  const duration=audio.duration;
  if(!Number.isFinite(duration)||duration<=0)return false;
  const box=miniPlayerSeek.getBoundingClientRect();
  if(box.width<=0)return false;
  const ratio=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
  audio.currentTime=ratio*duration;
  musicProgressUpdate();
  return true;
}
if(miniPlayerSeek){
  miniPlayerSeek.title=embedPlaying?'Встроенный плеер управляет треком':'Нажми или перетащи, чтобы перемотать';
  miniPlayerSeek.addEventListener('pointerdown',e=>{
    if(embedPlaying||!audio.src)return;
    if(!seekMiniAt(e))return;
    miniSeeking=true;
    try{miniPlayerSeek.setPointerCapture(e.pointerId);}catch{}
    e.preventDefault();
  });
  miniPlayerSeek.addEventListener('pointermove',e=>{if(miniSeeking)seekMiniAt(e);});
  const endMiniSeek=e=>{if(!miniSeeking)return;miniSeeking=false;try{miniPlayerSeek.releasePointerCapture(e.pointerId);}catch{}};
  miniPlayerSeek.addEventListener('pointerup',endMiniSeek);
  miniPlayerSeek.addEventListener('pointercancel',endMiniSeek);
  miniPlayerSeek.addEventListener('keydown',e=>{
    if(embedPlaying||!audio.src)return;
    const duration=audio.duration;
    if(!Number.isFinite(duration)||duration<=0)return;
    const step=e.key==='ArrowRight'?5:e.key==='ArrowLeft'?-5:0;
    if(!step)return;
    audio.currentTime=Math.max(0,Math.min(duration,audio.currentTime+step));
    musicProgressUpdate();e.preventDefault();
  });
}
function syncMusicToggles(){
  [['#miniPlayerShuffle','shuffle'],['#playerShuffle','shuffle'],['#miniPlayerLoop','loop'],['#playerLoop','loop']].forEach(([selector,kind])=>{
    const btn=$(selector);if(!btn)return;
    const on=kind==='shuffle'?musicShuffle:musicLoop;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-pressed',String(on));
  });
}
function setMusicShuffle(value){
  musicShuffle=!!value;syncMusicToggles();
  toast(musicShuffle?'Перемешка треков включена':'Перемешка треков выключена');
}
function setMusicLoop(value){
  musicLoop=!!value;audio.loop=musicLoop;syncMusicToggles();
  toast(musicLoop?'Трек зациклен':'Зацикливание выключено');
}
$('#miniPlayerShuffle')?.addEventListener('click',()=>setMusicShuffle(!musicShuffle));
$('#miniPlayerLoop')?.addEventListener('click',()=>setMusicLoop(!musicLoop));
$('#playerShuffle')?.addEventListener('click',()=>setMusicShuffle(!musicShuffle));
$('#playerLoop')?.addEventListener('click',()=>setMusicLoop(!musicLoop));
syncMusicToggles();
$('#miniPlayerClose')?.addEventListener('click',()=>stopCurrentTrack());
$('#miniPlayerCover')?.addEventListener('click',()=>{showView('music');});
$('#musicSort').onclick=()=>{const modes=['new','day','week','month','year'];musicSort=modes[(modes.indexOf(musicSort)+1)%modes.length];$('#musicSort').textContent=musicSort==='new'?'Все · сначала новые':hits[musicSort];renderMusic();};
document.addEventListener('change',e=>{if(e.target.matches('.hit-select')){const track=state.tracks.find(t=>t.id===e.target.dataset.track);if(track){track.hit=e.target.value;persist();renderMusic();}}});

// Settings only expose actions that have a real local implementation.
$('.preferences').innerHTML=`<div id="themePreferences"></div><div class="preference-row" id="accountPreference"></div><div class="preference-row"><div><strong>Утренний план</strong><span>Показывать напоминание при открытии после 08:00</span></div><button class="toggle" data-setting="morning" aria-label="Утренний план"><i></i></button></div><div class="preference-row"><div><strong>Звук выполнения</strong><span>Короткий сигнал при завершении задачи</span></div><button class="toggle" data-setting="sound" aria-label="Звук выполнения"><i></i></button></div><div class="preference-row"><div><strong>Фокус-режим</strong><span>Скрывать колокольчик напоминаний</span></div><button class="toggle" data-setting="focus" aria-label="Фокус-режим"><i></i></button></div><div class="preference-row"><div><strong>Стеклянный интерфейс</strong><span>Размытие фона и полупрозрачные панели</span></div><button class="toggle" data-setting="glass" aria-label="Стеклянный интерфейс"><i></i></button></div><div id="securityPreferences"></div><div class="preference-row"><div><strong>Хранение данных</strong><span>${CLOUD_ENABLED?'Данные и плейлисты синхронизируются с облаком Supabase. Аудио загружается в облачное хранилище, видео — в этом браузере.':'Автоматически в этом браузере. Аудио и видео — в IndexedDB.'}</span></div>${CLOUD_ENABLED?button('sync-media','','Синхронизировать аудио'):''}${button('export','','Экспорт данных')}</div>`;
function renderThemePreferences(){
  const box=$('#themePreferences'); if(!box)return;
  const previewColor=themeAccentColor(state.accent,state.theme);
  box.innerHTML=`<div class="theme-preferences"><div class="theme-pref-head"><div><strong>Оформление</strong><span>Тема и цвет акцента · фон плавно переливается</span></div><span class="theme-preview-dot" style="--preview:${previewColor}"></span></div><div class="theme-pref-grid single"><label class="theme-field">Тема<select id="themeSelect">${Object.entries(THEME_LABELS).map(([key,label])=>`<option value="${key}" ${state.theme===key?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="theme-swatches" role="radiogroup" aria-label="Цвет акцента">${Object.entries(THEME_PRESETS).map(([key,item])=>`<span class="theme-swatch-wrap"><button type="button" class="theme-swatch ${state.accent===key?'active':''}" data-accent="${key}" style="--swatch:${themeAccentColor(key,state.theme)}" title="${escapeHtml(themeAccentLabel(key,state.theme))}" aria-label="${escapeHtml(themeAccentLabel(key,state.theme))}" aria-pressed="${state.accent===key}"></button><span class="theme-swatch-name">${escapeHtml(themeAccentLabel(key,state.theme))}</span></span>`).join('')}</div></div>`;
  $('#themeSelect').onchange=e=>{
    state.theme=e.target.value==='light'?'light':'black';
    applyTheme();persist();renderThemePreferences();
  };
  $$('.theme-swatch',box).forEach(swatch=>swatch.onclick=()=>{
    state.accent=THEME_PRESETS[swatch.dataset.accent]?swatch.dataset.accent:'blue';
    applyTheme();persist();renderThemePreferences();
  });
}
function renderSettings(){
  renderThemePreferences();
  $$('[data-setting]').forEach(el=>{el.classList.toggle('on',state.settings[el.dataset.setting]);el.setAttribute('aria-pressed',String(state.settings[el.dataset.setting]));});
  $('#notificationsBtn').hidden=state.settings.focus;
  const security=$('#securityPreferences');
  if(security)security.innerHTML=cloudSessionActive()?`<div class="preference-row"><div><strong>Пароль</strong><span>Сменить пароль от аккаунта</span></div><button class="secondary-btn" data-action="change-password">Сменить</button></div><div class="preference-row"><div><strong>Код восстановления</strong><span>Постоянный код, который вы задаёте сами</span></div><button class="secondary-btn" data-action="set-recovery">Задать</button></div>`:'';
  const account=$('#accountPreference');
  if(account)account.innerHTML=currentAccount?`<div><strong>Аккаунт</strong><span>${escapeHtml(currentAccount.email)} · @${escapeHtml(currentAccount.alias)}</span></div><button class="secondary-btn" data-action="logout">Выйти</button>`:'';
}
function updateSettingsCity(){ const el=$('#settingsWeatherCity'); if(el)el.textContent=state.weather.city; }
$$('[data-setting]').forEach(el=>el.onclick=()=>{state.settings[el.dataset.setting]=!state.settings[el.dataset.setting];logAction('изменил настройки',`${el.getAttribute('aria-label')}: ${state.settings[el.dataset.setting]?'вкл':'выкл'}`);persist();renderSettings();if(el.dataset.setting==='glass')applyTheme();});
function completionSound(){if(!state.settings.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.07,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);osc.start();osc.stop(ctx.currentTime+.22);osc.onended=()=>ctx.close();}catch{}}

// --- Owner-only admin database -------------------------------------------
let adminSearch='',adminUsers=[],adminEvents=[],adminLoadedAt=0,adminRefreshSeq=0,adminRenderSignature='';
let adminProfileData=null,adminProfilePhoto='';
const formatAdminDate=value=>value?new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}):'—';
const formatAdminDateTime=value=>value?new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const adminInitials=account=>String(account?.name||account?.alias||account?.email||'?').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
function adminPhotoData(account){
  let local=null;
  if(account?.id){
    try{local=normalizeState(readStore(ACCOUNT_PREFIX+account.id,null)||emptyState());}catch{}
  }
  const photo=account?.photo||local?.profile?.photo||'';
  const source=photo?account:local?.profile;
  const x=Math.min(100,Math.max(0,+(source?.photoX??50)));
  const y=Math.min(100,Math.max(0,+(source?.photoY??50)));
  const scale=Math.min(2.5,Math.max(1,+(source?.photoScale??1)));
  return {photo,x,y,scale};
}
function adminAvatarMarkup(account,extraClass=''){
  const {photo,x,y,scale}=adminPhotoData(account);
  const cls=`avatar admin-avatar${extraClass?` ${extraClass}`:''}`;
  if(!photo)return `<span class="${cls}">${escapeHtml(adminInitials(account))}</span>`;
  return `<span class="${cls} has-photo"><img src="${escapeHtml(photo)}" alt="Аватар ${escapeHtml(account?.name||account?.alias||'')}" style="object-position:${x}% ${y}%;transform:scale(${scale})"></span>`;
}
function updateAdminAccess(){
  const owner=isOwner(currentAccount),nav=$('#adminNav'),supportNav=$('#supportNav');
  if(nav)nav.hidden=!owner;
  if(supportNav)supportNav.hidden=owner;
  if(!owner&&activeView==='admin')showView('overview');
  if(owner&&!adminSeenAt)saveAdminSeen();
  updateAdminAlert();
  if(owner&&CLOUD_ENABLED&&Date.now()-adminLoadedAt>5000)refreshAdminData();
}
async function refreshAdminData(){
  if(!cloudSessionActive()||!isOwner(currentAccount)||adminRefreshBusy)return;
  adminRefreshBusy=true;
  const seq=++adminRefreshSeq;
  adminLoadedAt=Date.now();
  try{
    const [usersResult,eventsResult,supportResult]=await Promise.allSettled([
      cloudRpc('sphere_admin_users',{p_id:currentAccount.id,p_token:currentAccount.token}),
      cloudRpc('sphere_admin_events',{p_id:currentAccount.id,p_token:currentAccount.token,p_limit:200}),
      cloudRpc('sphere_support_threads',{p_id:currentAccount.id,p_token:currentAccount.token})
    ]);
    if(seq!==adminRefreshSeq)return;
    if(usersResult.status==='fulfilled')adminUsers=Array.isArray(usersResult.value)?usersResult.value:[];
    if(eventsResult.status==='fulfilled')adminEvents=Array.isArray(eventsResult.value)?eventsResult.value:[];
    adminSupportAvailable=supportResult.status==='fulfilled';
    if(adminSupportAvailable){
      adminSupportThreads=Array.isArray(supportResult.value)?supportResult.value:[];
      processSupportNotifications(adminSupportThreads);
    }
    const failure=[usersResult,eventsResult].find(result=>result.status==='rejected')?.reason;
    if(failure&&!failure.cloudUnavailable&&Date.now()-cloudWarnedAt>15000){
      cloudWarnedAt=Date.now();toast(failure.message,true);
    }
    const signature=JSON.stringify([
      adminUsers.map(account=>[account.id,account.lastSeen,account.warnings]),
      adminEvents.map(event=>event.id),
      adminSupportThreads.map(thread=>[thread.id,thread.updated,thread.ownerUnread,!!thread.online,thread.lastSeen])
    ]);
    const changed=signature!==adminRenderSignature;
    adminRenderSignature=signature;
    updateAdminAlert();
    if(changed&&activeView==='admin'&&isOwner(currentAccount))renderAdminCached();
    if($('#adminLogDialog')?.open)renderAdminLogFull();
  }finally{adminRefreshBusy=false;}
}
function startAdminLive(){
  clearInterval(adminLiveTimer);adminLiveTimer=0;
  if(!cloudSessionActive()||!isOwner(currentAccount))return;
  adminLiveTimer=setInterval(()=>{
    if(document.visibilityState==='hidden')return;
    if(activeView==='admin'||$('#adminLogDialog')?.open)refreshAdminData();
    else pollSupportNotifications();
  },3000);
  pollSupportNotifications();
}
function stopAdminLive(){clearInterval(adminLiveTimer);adminLiveTimer=0;}
async function presenceHeartbeat(force=false){
  if(!cloudSessionActive()||document.visibilityState==='hidden')return;
  if(!force&&Date.now()-presenceLastAt<45000)return;
  presenceLastAt=Date.now();
  try{await cloudRpc('sphere_presence',{p_id:currentAccount.id,p_token:currentAccount.token});}catch{}
}
function startPresence(){
  clearInterval(presenceTimer);presenceTimer=0;
  if(!cloudSessionActive())return;
  presenceHeartbeat(true);
  presenceTimer=setInterval(()=>presenceHeartbeat(false),45000);
}
function presenceMarkup(online,lastSeen,onlineText='в сети',offlineText='не в сети'){
  const label=online?onlineText:(lastSeen?`${offlineText} · ${formatAdminDateTime(lastSeen)}`:offlineText);
  return `<i class="presence ${online?'online':'offline'}">${escapeHtml(label)}</i>`;
}
function applyPresenceElement(el,online,lastSeen,onlineText='в сети',offlineText='не в сети'){
  if(!el)return;
  el.classList.toggle('online',!!online);
  el.classList.toggle('offline',!online);
  el.textContent=online?onlineText:(lastSeen?`${offlineText} · ${formatAdminDateTime(lastSeen)}`:offlineText);
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
    ['▤','СОБЫТИЯ',visibleLogEvents(CLOUD_ENABLED?adminEvents:adminDb.events).length,'Записей в журнале']
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
      <div class="admin-user-id" data-admin-profile="${escapeHtml(account.id)}" role="button" tabindex="0" title="Открыть профиль и данные пользователя">${adminAvatarMarkup(account)}<div><strong>${escapeHtml(account.name||account.alias||'Без имени')}${owner?'<em class="admin-owner-badge">владелец</em>':''}</strong><span>@${escapeHtml(account.alias||'без_псевдонима')} · ${escapeHtml(account.email||'')}</span><small>${lastSeen&&Date.now()-lastSeen<120000?presenceMarkup(true,lastSeen):lastSeen?`Был(а): ${formatAdminDateTime(lastSeen)}`:'Ещё не входил(а)'}</small></div></div>
      <span class="admin-date">${formatAdminDate(account.created)}</span>
      <span class="admin-warn-pill ${warnCount?'has':''}">${warnCount?`⚑ ${warnCount}`:'—'}</span>
      <div class="admin-user-actions">${button('admin-warn',account.id,'Предупредить','text-btn')}${owner?'':button('admin-delete',account.id,'Удалить','text-btn admin-danger')}</div>
    </div>`;
  }).join(''):`<div class="admin-empty">${query?'Пользователи не найдены.':CLOUD_ENABLED?'В облачной базе пока нет пользователей.':'В базе пока нет пользователей.'}</div>`;
}
function renderAdminLog(){
  const box=$('#adminLogList');if(!box)return;
  const events=visibleLogEvents(CLOUD_ENABLED?adminEvents:adminDb.events).slice(0,120);
  box.innerHTML=events.length?events.map(event=>{
    const actor=event.actor||{};
    return `<div class="admin-log-item" data-log-event="${escapeHtml(event.id)}" role="button" tabindex="0"><span class="admin-log-dot">•</span><div class="admin-log-body"><div class="admin-log-top"><strong>${escapeHtml(actor.name||actor.alias||actor.email||'Гость')}</strong><small>${formatAdminDateTime(event.at)}</small></div><p><b>${escapeHtml(event.action||'событие')}</b>${event.details?`<span>${escapeHtml(event.details)}</span>`:''}</p>${actor.email?`<small class="admin-log-email">${escapeHtml(actor.email)}</small>`:''}</div></div>`;
  }).join(''):'<div class="admin-empty">Журнал пока пуст. Действия пользователей появятся здесь.</div>';
}
function renderAdminSupport(){
  const box=$('#adminSupportList');if(!box)return;
  const meta=$('#adminSupportMeta');if(meta)meta.textContent=adminSupportThreads.length;
  if(!adminSupportAvailable){
    box.innerHTML='<div class="admin-empty">Чат поддержки ещё не подключён. Выполните <b>supabase-support-update.sql</b> в Supabase SQL Editor.</div>';
    return;
  }
  if(!adminSupportThreads.length){
    box.innerHTML='<div class="admin-empty">Обращений пока нет. Сообщения с экрана входа и из профиля появятся здесь.</div>';
    return;
  }
  box.innerHTML=adminSupportThreads.map(thread=>{
    const name=thread.name||thread.email||'Гость';
    const preview=String(thread.preview||'').replace(/\s+/g,' ').slice(0,150);
    return `<button type="button" class="admin-support-row" data-support-thread="${escapeHtml(thread.id)}">${supportAvatarMarkup(thread,'admin-support-avatar')}<div><strong>${escapeHtml(name)}${thread.ownerUnread?'<i class="admin-support-unread">новое</i>':''}</strong><span>${escapeHtml(thread.email||'')}${thread.alias?` · @${escapeHtml(thread.alias)}`:''}</span><p>${preview?escapeHtml(preview):'Нет сообщений'}</p></div><div class="admin-support-meta"><small>${formatAdminDateTime(thread.updated)}</small><b>${thread.messages||0}</b>${thread.online!==undefined?presenceMarkup(thread.online,thread.lastSeen):''}</div></button>`;
  }).join('');
}
function renderAdminCached(){
  if(!isOwner(currentAccount))return;
  if(!CLOUD_ENABLED)syncAdminDb();
  renderAdminStats();renderAdminUsers();renderAdminLog();renderAdminSupport();
  updateAdminAlert();
}
function renderAdmin(){
  if(!isOwner(currentAccount))return;
  renderAdminCached();
  if(CLOUD_ENABLED&&Date.now()-adminLoadedAt>5000)refreshAdminData();
}
function adminProfileDate(value){
  if(!value)return 'Без даты';
  try{return formatDate(value);}catch{return String(value);}
}
function adminProfileListMarkup(kind='tasks'){
  const stateData=adminProfileData?.state;
  if(!stateData||typeof stateData!=='object')return '<p class="admin-empty compact">Подробные списки появятся после обновления SQL-функции в Supabase.</p>';
  const tasks=Array.isArray(stateData.tasks)?stateData.tasks:[];
  const goals=Array.isArray(stateData.goals)?stateData.goals:[];
  const tracks=Array.isArray(stateData.tracks)?stateData.tracks:[];
  const playlists=Array.isArray(stateData.playlists)?stateData.playlists:[];
  if(kind==='tasks'||kind==='completed'){
    const list=[...tasks].filter(task=>kind==='tasks'||+task.progress===100).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.time||'').localeCompare(String(b.time||'')));
    if(!list.length)return `<p class="admin-empty compact">${kind==='completed'?'Выполненных задач пока нет.':'Задач пока нет.'}</p>`;
    const goalsById=new Map(goals.map(goal=>[String(goal.id),goal.title]));
    return `<div class="admin-profile-list">${list.map(task=>{
      const progress=+task.progress||0,priority=normalizePriority(task.priority),linked=task.goal?goalsById.get(String(task.goal)):'';
      return `<div class="admin-profile-item"><div><strong>${escapeHtml(task.title||'Без названия')}</strong><span>${adminProfileDate(task.date)}${task.time?` · ${escapeHtml(task.time)}`:''}${linked?` · цель: ${escapeHtml(linked)}`:''}</span></div><div class="admin-profile-item-side"><span class="admin-profile-pill ${progress===100?'done':''}">${escapeHtml(statuses[progress]||`${progress}%`)}</span><small>${escapeHtml(priorityLabels[priority]||'')}</small></div></div>`;
    }).join('')}</div>`;
  }
  if(kind==='goals'){
    const list=[...goals].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    if(!list.length)return '<p class="admin-empty compact">Целей пока нет.</p>';
    return `<div class="admin-profile-list">${list.map(goal=>`<div class="admin-profile-item"><div><strong>${escapeHtml(goal.title||'Без названия')}</strong><span>${escapeHtml(String(goal.description||'Без описания').slice(0,220))}</span><span>До ${adminProfileDate(goal.date)}</span></div><div class="admin-profile-item-side"><span class="admin-profile-pill ${+goal.progress===100?'done':''}">${escapeHtml(statuses[+goal.progress||0]||`${+goal.progress||0}%`)}</span></div></div>`).join('')}</div>`;
  }
  if(kind==='tracks'){
    const list=[...tracks].sort((a,b)=>(+b.created||0)-(+a.created||0));
    if(!list.length)return '<p class="admin-empty compact">Треков пока нет.</p>';
    const playlistsById=new Map(playlists.map(playlist=>[String(playlist.id),playlist.name]));
    return `<div class="admin-profile-list">${list.map(track=>{
      const playlistName=track.playlist?playlistsById.get(String(track.playlist)):'';
      const source=/^https?:\/\//i.test(track.sourceUrl||'')?track.sourceUrl:'';
      return `<div class="admin-profile-item"><div><strong>${escapeHtml(track.title||'Без названия')}</strong><span>${escapeHtml(track.artist||'Исполнитель не указан')}${playlistName?` · ${escapeHtml(playlistName)}`:''}${track.hit?` · ${escapeHtml(hits[track.hit]||track.hit)}`:''}${track.favorite?' · ♥':''}</span>${source?`<a class="admin-profile-source" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>`:''}</div></div>`;
    }).join('')}</div>`;
  }
  return '';
}
function adminProfileMarkup(account,warnings,stats,lastSeen){
  const owner=isOwner(account),id=account.id;
  const stateData=adminProfileData?.state||null;
  const tasks=stateData&&Array.isArray(stateData.tasks)?stateData.tasks:[];
  const goals=stateData&&Array.isArray(stateData.goals)?stateData.goals:[];
  const tracks=stateData&&Array.isArray(stateData.tracks)?stateData.tracks:[];
  const taskCount=stateData?tasks.length:+stats.tasks||0;
  const completedCount=stateData?tasks.filter(task=>+task.progress===100).length:+stats.completed||0;
  const goalCount=stateData?goals.length:+stats.goals||0;
  const trackCount=stateData?tracks.length:+stats.tracks||0;
  const photo=adminPhotoData(account).photo;
  const avatarMarkup=photo?`<button type="button" class="admin-avatar-button" data-admin-photo-view title="Посмотреть фото крупнее">${adminAvatarMarkup(account,'admin-avatar-large')}<span class="admin-avatar-hint">⌕</span></button>`:adminAvatarMarkup(account,'admin-avatar-large');
  const email=account.email?`<a class="admin-profile-link" href="mailto:${escapeHtml(account.email)}">${escapeHtml(account.email)}</a>`:'—';
  const statButton=(kind,value,label)=>`<button type="button" class="admin-profile-stat ${kind==='tasks'?'active':''}" data-admin-profile-tab="${kind}"><strong>${value}</strong><span>${label}</span></button>`;
  const tabButton=(kind,label,count)=>`<button type="button" class="admin-profile-tab ${kind==='tasks'?'active':''}" data-admin-profile-tab="${kind}" role="tab" aria-selected="${kind==='tasks'}">${label} <b>${count}</b></button>`;
  const warningMarkup=warnings.length?warnings.map(warning=>`<div class="admin-warning"><div><strong>${escapeHtml(warning.text)}</strong><small>${formatAdminDateTime(warning.created)}${warning.by?` · ${escapeHtml(warning.by)}`:''}${warning.read?' · прочитано':' · новое'}</small></div>${warning.id?`<button type="button" class="admin-warning-delete" data-warning-delete="${escapeHtml(warning.id)}" data-warning-target="${escapeHtml(id)}" title="Удалить предупреждение" aria-label="Удалить предупреждение">×</button>`:''}</div>`).join(''):'<p class="admin-empty compact">Предупреждений нет.</p>';
  return `<div class="admin-profile-head">${avatarMarkup}<div><h3>${escapeHtml(account.name||account.alias||'Без имени')}</h3><p>@${escapeHtml(account.alias||'без_псевдонима')} · ${email}</p>${owner?'<span class="admin-owner-badge">владелец</span>':''}</div></div><div class="admin-profile-stats">${statButton('tasks',taskCount,'задач')}${statButton('completed',completedCount,'выполнено')}${statButton('goals',goalCount,'целей')}${statButton('tracks',trackCount,'треков')}</div><div class="admin-profile-meta"><span><b>Создан:</b> ${formatAdminDate(account.created)}</span><span><b>Последний вход:</b> ${lastSeen?formatAdminDateTime(lastSeen):'ещё не входил(а)'}</span><span><b>ID:</b> <span class="mono">${escapeHtml(account.id)}</span></span></div><div class="admin-profile-sections"><div class="admin-profile-tabs" role="tablist">${tabButton('tasks','Задачи',taskCount)}${tabButton('completed','Выполненные',completedCount)}${tabButton('goals','Цели',goalCount)}${tabButton('tracks','Треки',trackCount)}</div><div class="admin-profile-panel" id="adminProfilePanel">${adminProfileListMarkup('tasks')}</div></div><div class="admin-warning-list"><div class="admin-subhead"><strong>Предупреждения</strong><span>${warnings.length}</span></div>${warningMarkup}</div><div class="admin-profile-actions">${button('admin-warn',id,'Выдать предупреждение','secondary-btn')}${owner?'':button('admin-delete',id,'Удалить профиль','secondary-btn admin-danger')}</div>`;
}
async function adminProfileDialog(id){
  if(CLOUD_ENABLED){
    let profile;
    try{profile=await cloudRpc('sphere_admin_profile',{p_id:currentAccount.id,p_token:currentAccount.token,p_target:id});}
    catch(error){toast(error.message,true);return;}
    const account=profile?.account||{};if(!account.id)return;
    const warnings=Array.isArray(profile.warnings)?profile.warnings:[];
    const stats=profile.stats||{};
    adminProfileData={account,warnings,stats,lastSeen:account.lastSeen,state:profile.state&&typeof profile.state==='object'?profile.state:null};
    adminProfilePhoto=adminPhotoData(account).photo||'';
    openEditor(`Профиль · ${account.name||account.alias}`,adminProfileMarkup(account,warnings,stats,account.lastSeen),null);
    return;
  }
  const account=accounts.find(item=>item.id===id);if(!account)return;
  const record=adminUserRecord(id),userState=normalizeState(readStore(accountKey(account),null)||emptyState());
  const warnings=[...record.warnings].reverse();
  const stats={tasks:userState.tasks.length,completed:userState.tasks.filter(task=>task.progress===100).length,goals:userState.goals.length,tracks:userState.tracks.length};
  adminProfileData={account,warnings,stats,lastSeen:record.lastSeen,state:{tasks:userState.tasks,goals:userState.goals,tracks:userState.tracks,playlists:userState.playlists}};
  adminProfilePhoto=adminPhotoData(account).photo||'';
  openEditor(`Профиль · ${account.name||account.alias}`,adminProfileMarkup(account,warnings,stats,record.lastSeen),null);
}
function adminWarnDialog(id){
  const account=(CLOUD_ENABLED?adminUsers:accounts).find(item=>item.id===id);if(!account)return;
  openEditor('Выдать предупреждение',`<p class="help-text">Пользователь <strong>${escapeHtml(account.name||account.alias)}</strong> · @${escapeHtml(account.alias||'')}<br>Предупреждение появится у пользователя в ближайшее время.</p>${field('Текст предупреждения',`<textarea name="warning" rows="4" required maxlength="500" placeholder="Например: пожалуйста, соблюдай правила сообщества."></textarea>`)}`,async data=>{
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
function adminDeleteWarning(warningId,targetId){
  if(!warningId||!targetId||!isOwner(currentAccount))return;
  openEditor('Удалить предупреждение',`<p>Удалить это предупреждение?</p><p class="help-text">Пользователь больше не увидит его в списке. Действие необратимо.</p>`,async ()=>{
    if(CLOUD_ENABLED){
      await cloudRpc('sphere_admin_warning_delete',{p_id:currentAccount.id,p_token:currentAccount.token,p_warning:warningId,p_target:targetId});
      logAction('удалил предупреждение',`ID ${warningId}`,targetId);
      await refreshAdminData();
      await adminProfileDialog(targetId);
      toast('Предупреждение удалено');
      return false;
    }
    const record=adminUserRecord(targetId);
    record.warnings=record.warnings.filter(warning=>warning.id!==warningId);
    saveAdminDb();logAction('удалил предупреждение',`ID ${warningId}`,targetId);
    renderAdmin();toast('Предупреждение удалено');
    adminProfileDialog(targetId);
    return false;
  },'Удалить');
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
function adminClearSupport(){
  if(!isOwner(currentAccount))return;
  const count=adminSupportThreads.length;
  openEditor('Очистить поддержку',`<p>Удалить все чаты поддержки${count?` (${count})`:''}?</p><p class="help-text">Сообщения и вложения будут удалены без возможности восстановления. Пользователи смогут написать в поддержку заново.</p>`,async()=>{
    let deleted=count;
    if(CLOUD_ENABLED){
      const result=await cloudRpc('sphere_admin_clear_support',{p_id:currentAccount.id,p_token:currentAccount.token});
      deleted=Math.max(0,+result?.deleted||0);
    }
    adminSupportThreads=[];
    adminSupportCurrent=null;
    adminSupportAvailable=true;
    if(adminSupportDialog.open)adminSupportDialog.close();
    if($('#supportDialog')?.open)$('#supportDialog').close();
    saveSupportThread(null);
    supportMessages=[];
    $('#supportNotifications').innerHTML='';
    adminNotifySeen={};
    persistAdminNotifySeen();
    logAction('очистил чаты поддержки',`Удалено обращений: ${deleted}`);
    if(CLOUD_ENABLED)await refreshAdminData();
    renderAdminSupport();
    updateAdminAlert();
    toast(deleted?`Чаты поддержки очищены: ${deleted}`:'Чатов поддержки не было');
  },'Очистить всё');
}
$('#adminSupportClear')?.addEventListener('click',adminClearSupport);
$('#adminSupportRefresh')?.addEventListener('click',()=>{adminLoadedAt=0;refreshAdminData();});
function openAdminPhotoViewer(){
  const dialog=$('#adminPhotoDialog'),image=$('#adminPhotoImage');
  if(!dialog||!image||!adminProfilePhoto)return;
  image.src=adminProfilePhoto;
  const name=adminProfileData?.account?.name||adminProfileData?.account?.alias||'Пользователь';
  $('#adminPhotoTitle').textContent=`Фото · ${name}`;
  const download=$('#adminPhotoDownload');
  if(download){download.href=adminProfilePhoto;download.download=`sphere-photo-${String(adminProfileData?.account?.alias||'user')}.jpg`;}
  if(!dialog.open)dialog.showModal();
}
document.addEventListener('click',e=>{
  const warningDelete=e.target.closest('[data-warning-delete]');
  if(warningDelete){adminDeleteWarning(warningDelete.dataset.warningDelete,warningDelete.dataset.warningTarget);return;}
  const profileRow=e.target.closest('[data-admin-profile]');
  if(profileRow){adminProfileDialog(profileRow.dataset.adminProfile);return;}
  const tab=e.target.closest('[data-admin-profile-tab]');
  if(tab){
    const kind=tab.dataset.adminProfileTab;
    if(!['tasks','completed','goals','tracks'].includes(kind))return;
    $$('[data-admin-profile-tab]').forEach(button=>{
      const active=button.dataset.adminProfileTab===kind;
      button.classList.toggle('active',active);
      if(button.classList.contains('admin-profile-tab'))button.setAttribute('aria-selected',String(active));
    });
    const panel=$('#adminProfilePanel');if(panel)panel.innerHTML=adminProfileListMarkup(kind);
    return;
  }
  const photo=e.target.closest('[data-admin-photo-view]');
  if(photo)openAdminPhotoViewer();
});
document.addEventListener('keydown',e=>{
  const profileRow=e.target.closest('[data-admin-profile]');
  if(profileRow&&(e.key==='Enter'||e.key===' ')){e.preventDefault();adminProfileDialog(profileRow.dataset.adminProfile);}
});

// --- Предупреждения, поддержка и подробный журнал -------------------------
document.body.insertAdjacentHTML('beforeend', `
<dialog id="warningDialog" class="warning-dialog card" aria-labelledby="warningTitle">
  <button type="button" class="modal-close" id="warningClose" aria-label="Закрыть">×</button>
  <div class="warning-icon">⚑</div>
  <p class="eyebrow">СООБЩЕНИЕ ОТ АДМИНИСТРАТОРА</p>
  <h2 id="warningTitle">Предупреждение</h2>
  <div class="warning-body" id="warningList"></div>
</dialog>
<dialog id="supportDialog" class="support-dialog card" aria-labelledby="supportTitle">
  <button type="button" class="modal-close" id="supportClose" aria-label="Закрыть">×</button>
  <header class="support-head"><span class="support-mark">✉</span><div><h2 id="supportTitle">Чат с поддержкой</h2><i class="presence offline" id="supportPresence">Проверяем статус…</i></div></header>
  <div class="support-identity" id="supportIdentity"></div>
  <div class="support-messages" id="supportMessages"></div>
  <p class="support-status" id="supportStatus" role="alert"></p>
  <form class="support-form" id="supportForm"><label class="support-attach" title="Прикрепить фото, аудио или документ"><span class="support-attach-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.53 12.53 21a5.48 5.48 0 0 1-7.75-7.75l8.4-8.4a3.65 3.65 0 0 1 5.17 5.17l-8.4 8.4a1.83 1.83 0 0 1-2.59-2.59l7.9-7.9"/></svg></span><input id="supportFile" type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.rtf,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.epub"></label><div class="support-file-chip" id="supportFileChip" hidden></div><textarea id="supportInput" rows="2" maxlength="2000" placeholder="Напишите сообщение… Enter — отправить, Shift+Enter — новая строка"></textarea><button class="primary-btn" type="submit" id="supportSend">Отправить</button></form>
</dialog>
<dialog id="adminSupportDialog" class="support-dialog admin-support-dialog card" aria-labelledby="adminSupportTitle">
  <button type="button" class="modal-close" id="adminSupportClose" aria-label="Закрыть">×</button>
  <header class="support-head"><span class="support-mark">✉</span><div><p class="eyebrow">ПОДДЕРЖКА · ДИАЛОГ</p><h2 id="adminSupportTitle">Обращение</h2><span id="adminSupportSub"></span><i class="presence offline" id="adminSupportPresence">Проверяем статус…</i></div><button type="button" class="text-btn admin-support-hide" id="adminSupportHide" hidden>Удалить у себя</button></header>
  <div class="support-messages" id="adminSupportMessages"></div>
  <p class="support-status" id="adminSupportStatus" role="alert"></p>
  <form class="support-form" id="adminSupportForm"><label class="support-attach" title="Прикрепить фото, аудио или документ"><span class="support-attach-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.53 12.53 21a5.48 5.48 0 0 1-7.75-7.75l8.4-8.4a3.65 3.65 0 0 1 5.17 5.17l-8.4 8.4a1.83 1.83 0 0 1-2.59-2.59l7.9-7.9"/></svg></span><input id="adminSupportFile" type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.rtf,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.epub"></label><div class="support-file-chip" id="adminSupportFileChip" hidden></div><textarea id="adminSupportInput" rows="2" maxlength="2000" placeholder="Ответ пользователю… Enter — отправить, Shift+Enter — новая строка"></textarea><button class="primary-btn" type="submit">Ответить</button></form>
</dialog>
<dialog id="adminLogDialog" class="admin-log-dialog card" aria-labelledby="adminLogTitle">
  <div class="admin-log-dialog-head"><div><h2 id="adminLogTitle">Журнал действий</h2></div><label class="admin-search admin-log-search"><span>⌕</span><input id="adminLogSearch" type="search" placeholder="Поиск по действию, пользователю, деталям" autocomplete="off" /></label><button type="button" class="modal-close" id="adminLogClose" aria-label="Закрыть">×</button></div>
  <div class="admin-log-dialog-body"><div class="admin-log-full-list" id="adminLogFullList"></div><aside class="admin-log-detail" id="adminLogDetail"></aside></div>
</dialog>
<dialog id="adminPhotoDialog" class="admin-photo-dialog card" aria-labelledby="adminPhotoTitle">
  <button type="button" class="modal-close" id="adminPhotoClose" aria-label="Закрыть">×</button>
  <div class="admin-photo-stage"><img id="adminPhotoImage" alt="Фото профиля" /></div>
  <div class="admin-photo-foot"><strong id="adminPhotoTitle">Фото профиля</strong><a class="text-btn" id="adminPhotoDownload" download>Скачать</a></div>
</dialog>
<dialog id="ageGateDialog" class="age-gate-dialog card" aria-labelledby="ageGateTitle">
  <div class="age-gate-badge">18+</div>
  <p class="eyebrow">ПОДТВЕРЖДЕНИЕ ВОЗРАСТА</p>
  <h2 id="ageGateTitle">Вам есть 18 лет?</h2>
  <p class="age-gate-text" id="ageGateReason">Для этого действия нужно подтвердить совершеннолетие.</p>
  <div class="modal-actions"><button type="button" class="secondary-btn" id="ageGateNo">Нет, отменить</button><button type="button" class="primary-btn" id="ageGateYes">Да, мне 18+</button></div>
</dialog>
<div class="support-notifications" id="supportNotifications" aria-live="polite" aria-label="Уведомления поддержки"></div>`);

const warningDialog=$('#warningDialog');
$('#warningClose').onclick=()=>warningDialog.close();
warningDialog.addEventListener('cancel',e=>e.preventDefault());
warningDialog.addEventListener('click',e=>e.stopPropagation());
const adminPhotoDialog=$('#adminPhotoDialog');
$('#adminPhotoClose').onclick=()=>adminPhotoDialog.close();
adminPhotoDialog.addEventListener('click',e=>{if(e.target===adminPhotoDialog)adminPhotoDialog.close();});
function showWarnings(list){
  const pending=(Array.isArray(list)?list:[]).filter(warning=>warning&&warning.text&&!shownWarningIds.has(String(warning.id||warning.text)));
  if(!pending.length)return;
  pending.forEach(warning=>shownWarningIds.add(String(warning.id||warning.text)));
  $('#warningList').innerHTML=pending.map(warning=>`<div class="warning-card"><strong>${escapeHtml(warning.text)}</strong><small>${warning.by?`${escapeHtml(warning.by)} · `:''}${formatAdminDateTime(warning.created)}</small></div>`).join('');
  $('#warningTitle').textContent=pending.length>1?`Новые предупреждения · ${pending.length}`:'Предупреждение';
  if(!warningDialog.open)warningDialog.showModal();
}
async function pollWarnings(){
  if(!cloudSessionActive()||document.visibilityState==='hidden')return;
  try{
    const list=await cloudRpc('sphere_warnings_take',{p_id:currentAccount.id,p_token:currentAccount.token});
    if(Array.isArray(list)&&list.length)showWarnings(list);
  }catch{}
}
function startWarningPolling(){
  clearInterval(warningPollTimer);
  warningPollTimer=setInterval(pollWarnings,25000);
}

function settleAgeGate(value){
  const resolve=ageGateResolve;ageGateResolve=null;
  const dialog=$('#ageGateDialog');
  if(dialog?.open)dialog.close();
  if(resolve)resolve(!!value);
}
function requireAdult(reason='Для этого действия нужно подтвердить совершеннолетие.'){
  const dialog=$('#ageGateDialog');
  if(!dialog)return Promise.resolve(true);
  if(dialog.open)settleAgeGate(false);
  return new Promise(resolve=>{
    ageGateResolve=resolve;
    const text=$('#ageGateReason');if(text)text.textContent=reason;
    dialog.showModal();
  });
}
$('#ageGateYes').onclick=()=>settleAgeGate(true);
$('#ageGateNo').onclick=()=>settleAgeGate(false);
$('#ageGateDialog').addEventListener('cancel',e=>{e.preventDefault();settleAgeGate(false);});
$('#ageGateDialog').addEventListener('click',e=>e.stopPropagation());

function supportInitials(name){
  return String(name||'Гость').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
}
function supportAvatarMarkup(thread,className='support-notify-avatar'){
  const name=thread?.name||thread?.email||'Гость';
  const photo=String(thread?.photo||'');
  if(!photo)return `<span class="${className}">${escapeHtml(supportInitials(name))}</span>`;
  const x=Math.min(100,Math.max(0,+(thread?.photoX??50)));
  const y=Math.min(100,Math.max(0,+(thread?.photoY??50)));
  const scale=Math.min(2.5,Math.max(1,+(thread?.photoScale??1)));
  return `<span class="${className} has-photo"><img src="${escapeHtml(photo)}" alt="Аватар ${escapeHtml(name)}" style="object-position:${x}% ${y}%;transform:scale(${scale})"></span>`;
}
function persistAdminNotifySeen(){
  try{localStorage.setItem(ADMIN_NOTIFY_KEY,JSON.stringify({initialized:adminNotifyInitialized,seen:adminNotifySeen}));}catch{}
}
function processSupportNotifications(threads){
  if(!Array.isArray(threads)||!isOwner(currentAccount))return;
  const present=new Set(threads.map(thread=>String(thread.id)));
  threads.forEach(thread=>{
    const id=String(thread.id),updated=+thread.updated||0,previous=+adminNotifySeen[id]||0;
    const fresh=updated>previous;
    const threadOpen=!!$('#adminSupportDialog')?.open&&String(adminSupportCurrent?.id||'')===id;
    if(adminNotifyInitialized&&fresh&&thread.lastSender==='user'&&thread.ownerUnread&&!threadOpen)showSupportNotification(thread);
    if(fresh)adminNotifySeen[id]=updated;
  });
  Object.keys(adminNotifySeen).forEach(id=>{if(!present.has(id))delete adminNotifySeen[id];});
  adminNotifyInitialized=true;
  persistAdminNotifySeen();
}
function showSupportNotification(thread){
  const box=$('#supportNotifications');if(!box)return;
  const name=thread?.name||thread?.email||'Гость';
  const preview=String(thread?.preview||'').replace(/\s+/g,' ').trim()||'Новое сообщение';
  const card=document.createElement('div');
  card.className='support-notification';
  card.dataset.supportThread=thread.id;
  card.setAttribute('role','button');
  card.tabIndex=0;
  card.innerHTML=`${supportAvatarMarkup(thread)}<div class="support-notify-body"><small>НОВОЕ СООБЩЕНИЕ · ПОДДЕРЖКА</small><strong>${escapeHtml(name)}</strong><p>${escapeHtml(preview.slice(0,180))}</p><time>${formatAdminDateTime(thread.updated)}</time></div><button type="button" class="support-notify-close" aria-label="Закрыть уведомление">×</button>`;
  box.appendChild(card);
  requestAnimationFrame(()=>card.classList.add('show'));
  let removed=false;
  const remove=()=>{
    if(removed)return;removed=true;
    card.classList.remove('show');
    setTimeout(()=>card.remove(),260);
  };
  card.addEventListener('click',e=>{
    if(e.target.closest('.support-notify-close')){e.stopPropagation();remove();return;}
    remove();openAdminSupportThread(thread.id);
  });
  card.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();remove();openAdminSupportThread(thread.id);}
  });
  setTimeout(remove,9000);
}
async function pollSupportNotifications(){
  if(!cloudSessionActive()||!isOwner(currentAccount)||adminNotifyBusy||document.visibilityState==='hidden')return;
  adminNotifyBusy=true;
  try{
    const threads=await cloudRpc('sphere_support_threads',{p_id:currentAccount.id,p_token:currentAccount.token});
    if(Array.isArray(threads)){
      adminSupportThreads=threads;adminSupportAvailable=true;
      processSupportNotifications(threads);
      if(activeView==='admin')renderAdminSupport();
    }
  }catch{}
  finally{adminNotifyBusy=false;}
}

function supportErrorText(error){
  const message=String(error?.message||'');
  if(message.includes('Could not find the function')||message.includes('function public.sphere_support'))return 'Чат поддержки ещё не активирован. Напишите на 369turush@gmail.com.';
  return message||'Не удалось связаться с поддержкой.';
}
function supportIdentityMarkup(){
  const box=$('#supportIdentity');if(!box)return;
  if(currentAccount){
    box.innerHTML=`<div class="support-login-line">Вы вошли как <strong>${escapeHtml(state.profile.name||currentAccount.name||currentAccount.alias)}</strong><span>${escapeHtml(currentAccount.email)}</span></div>`;
    return;
  }
  if(supportThreadState){
    box.innerHTML=`<div class="support-login-line">Гость<span>${escapeHtml(supportThreadState.email||'')}</span></div>`;
    return;
  }
  box.innerHTML=`<div class="form-row"><label>Имя<input id="supportName" maxlength="80" placeholder="Как к вам обращаться"></label><label>Email<input id="supportEmail" type="email" maxlength="120" placeholder="you@example.com"></label></div>`;
}
function humanFileSize(bytes){
  const value=+bytes||0;
  if(value>=1024*1024)return `${(value/1024/1024).toLocaleString('ru-RU',{maximumFractionDigits:1})} МБ`;
  if(value>=1024)return `${Math.round(value/1024)} КБ`;
  return `${value} Б`;
}
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}
async function prepareSupportAttachment(file){
  if(!file?.size)return null;
  if(file.size>SUPPORT_FILE_LIMIT)throw new Error(`Файл должен быть не больше ${humanFileSize(SUPPORT_FILE_LIMIT)}.`);
  let type=file.type||'application/octet-stream';
  let data;
  if(type.startsWith('image/')){
    data=await imageData(file,1600,.82);
    type='image/jpeg';
  }else{
    data=await fileToDataURL(file);
  }
  return {name:file.name||'Файл',type,size:file.size,data};
}
function supportAttachmentMarkup(attachment){
  if(!attachment?.data)return '';
  const name=String(attachment.name||'Файл');
  const type=String(attachment.type||'');
  const size=humanFileSize(attachment.size);
  if(type.startsWith('image/')){
    return `<a class="support-attachment support-attachment-image" href="${escapeHtml(attachment.data)}" target="_blank" rel="noopener" download="${escapeHtml(name)}"><img src="${escapeHtml(attachment.data)}" alt="${escapeHtml(name)}" loading="lazy"></a>`;
  }
  if(type.startsWith('audio/')){
    return `<div class="support-attachment support-attachment-audio"><audio controls preload="metadata" src="${escapeHtml(attachment.data)}"></audio><small>${escapeHtml(name)} · ${size}</small></div>`;
  }
  return `<a class="support-attachment support-attachment-file" href="${escapeHtml(attachment.data)}" download="${escapeHtml(name)}"><span>📎</span><span><b>${escapeHtml(name)}</b><small>${size}</small></span></a>`;
}
function supportAttachmentUi(kind){
  return kind==='admin'
    ?{file:$('#adminSupportFile'),chip:$('#adminSupportFileChip'),value:()=>adminSupportAttachment}
    :{file:$('#supportFile'),chip:$('#supportFileChip'),value:()=>supportAttachment};
}
function renderSupportAttachmentChip(kind){
  const ui=supportAttachmentUi(kind),file=ui.value(),chip=ui.chip;
  if(!chip)return;
  if(!file){chip.hidden=true;chip.innerHTML='';return;}
  const icon=file.type.startsWith('image/')?'🖼':file.type.startsWith('audio/')?'♫':'📎';
  chip.hidden=false;
  chip.innerHTML=`<span class="support-file-icon">${icon}</span><span class="support-file-copy"><strong>${escapeHtml(file.name||'Файл')}</strong><small>${humanFileSize(file.size)}</small></span><button type="button" class="support-file-remove" aria-label="Убрать файл">×</button>`;
  $('.support-file-remove',chip).onclick=()=>clearSupportAttachment(kind);
}
function setSupportAttachment(kind,file){
  if(kind==='admin')adminSupportAttachment=file||null;else supportAttachment=file||null;
  renderSupportAttachmentChip(kind);
}
function clearSupportAttachment(kind){
  const ui=supportAttachmentUi(kind);
  setSupportAttachment(kind,null);
  if(ui.file)ui.file.value='';
}
function supportMessagesMarkup(list,viewer='user'){
  if(!list.length)return '<div class="support-empty">Напишите первое сообщение — владелец увидит его в админ-панели.</div>';
  return list.map(message=>{
    const owner=message.sender==='owner';
    const label=owner?(viewer==='owner'?'Вы · поддержка':'Поддержка'):(viewer==='owner'?'Пользователь':'Вы');
    const body=message.body?escapeHtml(message.body).replace(/\n/g,'<br>'):'';
    const attachment=supportAttachmentMarkup(message.attachment);
    return `<div class="support-msg ${owner?'owner':'user'}"><div class="support-bubble ${attachment?'has-attachment':''}">${body}${attachment}</div><small>${escapeHtml(label)} · ${formatAdminDateTime(message.created)}</small></div>`;
  }).join('');
}
function scrollSupportBox(selector){const box=$(selector);if(box)box.scrollTop=box.scrollHeight;}
async function supportPayload(){
  if(!supportThreadState)return null;
  return {p_thread:supportThreadState.id,p_secret_hash:await hashSecret(supportThreadState.secret,'sphere-support'),p_account:currentAccount?.id||null,p_token:currentAccount?.token||null};
}
async function loadSupportMessages(silent=false){
  const payload=await supportPayload();if(!payload)return;
  try{
    const data=await cloudRpc('sphere_support_fetch',payload);
    if(data&&Array.isArray(data.messages))supportMessages=data.messages;
    if(data?.thread&&supportThreadState){supportThreadState={...supportThreadState,email:data.thread.email||supportThreadState.email,name:data.thread.name||supportThreadState.name};}
    if(data&&data.supportOnline!==undefined)applyPresenceElement($('#supportPresence'),data.supportOnline,data.supportLastSeen,'Поддержка в сети','Поддержка не в сети');
    const markup=supportMessagesMarkup(supportMessages,'user'),box=$('#supportMessages');
    if(box&&box.innerHTML!==markup){box.innerHTML=markup;scrollSupportBox('#supportMessages');}
    if(!silent)$('#supportStatus').textContent='';
  }catch(error){
    if(!silent)$('#supportStatus').textContent=supportErrorText(error);
  }
}
function startSupportPolling(){
  clearInterval(supportPollTimer);
  supportPollTimer=setInterval(()=>{
    if(document.visibilityState!=='hidden'&&$('#supportDialog').open)loadSupportMessages(true);
  },3000);
}
function stopSupportPolling(){clearInterval(supportPollTimer);supportPollTimer=0;}
async function openSupportDialog(){
  const dialog=$('#supportDialog');
  supportIdentityMarkup();
  $('#supportStatus').textContent='';
  $('#supportMessages').innerHTML=supportThreadState?'<div class="support-empty">Загружаем сообщения…</div>':'<div class="support-empty">Напишите первое сообщение — владелец увидит его в админ-панели.</div>';
  if(!supportThreadState)applyPresenceElement($('#supportPresence'),false,0,'Поддержка в сети','Статус появится после первого сообщения');
  if(!dialog.open)dialog.showModal();
  presenceHeartbeat(true);
  if(supportThreadState){await loadSupportMessages();startSupportPolling();}
  setTimeout(()=>$('#supportInput')?.focus(),80);
}
$('#authSupport')?.addEventListener('click',openSupportDialog);
$('#supportNav')?.addEventListener('click',openSupportDialog);
$('#supportClose').onclick=()=>$('#supportDialog').close();
$('#supportDialog').addEventListener('click',e=>{if(e.target===$('#supportDialog'))$('#supportDialog').close();});
$('#supportDialog').addEventListener('close',()=>{stopSupportPolling();clearSupportAttachment('user');});
async function createSupportThread(){
  let email=currentAccount?.email||'',name=currentAccount?state.profile.name||currentAccount.name||currentAccount.alias:'';
  if(!supportThreadState){
    if(!currentAccount){
      email=String($('#supportEmail')?.value||'').trim().toLowerCase();
      name=String($('#supportName')?.value||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Укажите корректный email для ответа.');
    }
    const id=uid(),secret=randomHex(24);
    await cloudRpc('sphere_support_open',{p_thread:id,p_account:currentAccount?.id||null,p_email:email,p_name:name||'Гость',p_alias:currentAccount?.alias||'',p_secret_hash:await hashSecret(secret,'sphere-support')});
    saveSupportThread({id,secret,email,name});
    supportIdentityMarkup();
  }
  return supportThreadState;
}
$('#supportForm').onsubmit=async e=>{
  e.preventDefault();
  if(supportSending)return;
  const input=$('#supportInput'),text=String(input.value||'').trim(),file=supportAttachment;
  if(!text&&!file){$('#supportStatus').textContent='Введите сообщение или прикрепите файл.';return;}
  supportSending=true;$('#supportSend').disabled=true;$('#supportStatus').textContent='';
  try{
    const attachment=file?await prepareSupportAttachment(file):null;
    const thread=await createSupportThread();
    await cloudRpc('sphere_support_send',{p_thread:thread.id,p_secret_hash:await hashSecret(thread.secret,'sphere-support'),p_account:currentAccount?.id||null,p_token:currentAccount?.token||null,p_body:text,p_attachment:attachment});
    input.value='';clearSupportAttachment('user');
    await loadSupportMessages(true);
    startSupportPolling();
  }catch(error){
    if(String(error?.code||'').toLowerCase()==='support_not_found'){
      saveSupportThread(null);supportIdentityMarkup();$('#supportStatus').textContent='Обращение не найдено. Напишите новое сообщение.';
    }else{
      $('#supportStatus').textContent=supportErrorText(error);
    }
  }finally{
    supportSending=false;$('#supportSend').disabled=false;
  }
};
$('#supportFile').addEventListener('change',e=>setSupportAttachment('user',e.target.files[0]||null));
$('#adminSupportFile').addEventListener('change',e=>setSupportAttachment('admin',e.target.files[0]||null));
[['#supportInput','#supportForm'],['#adminSupportInput','#adminSupportForm']].forEach(([inputSelector,formSelector])=>{
  $(inputSelector).addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;
    e.preventDefault();
    $(formSelector).requestSubmit();
  });
});

async function loadAdminSupportThread(id,silent=false){
  const status=$('#adminSupportStatus');if(status&&!silent)status.textContent='';
  try{
    const data=await cloudRpc('sphere_support_thread',{p_id:currentAccount.id,p_token:currentAccount.token,p_thread:id});
    adminSupportCurrent=data?.thread||null;
    $('#adminSupportTitle').textContent=adminSupportCurrent?.name||adminSupportCurrent?.email||'Обращение';
    $('#adminSupportSub').textContent=[adminSupportCurrent?.email,adminSupportCurrent?.alias?`@${adminSupportCurrent.alias}`:''].filter(Boolean).join(' · ');
    const hideBtn=$('#adminSupportHide');if(hideBtn)hideBtn.hidden=!adminSupportCurrent?.id;
    applyPresenceElement($('#adminSupportPresence'),adminSupportCurrent?.online,adminSupportCurrent?.lastSeen,'Пользователь в сети','Пользователь не в сети');
    const markup=supportMessagesMarkup(Array.isArray(data?.messages)?data.messages:[],'owner'),box=$('#adminSupportMessages');
    if(box&&box.innerHTML!==markup){box.innerHTML=markup;scrollSupportBox('#adminSupportMessages');}
    if(!silent)refreshAdminData();
  }catch(error){
    if(status)status.textContent=supportErrorText(error);
  }
}
function startAdminSupportPolling(){
  clearInterval(adminSupportPollTimer);
  adminSupportPollTimer=setInterval(()=>{
    if(document.visibilityState!=='hidden'&&adminSupportDialog.open&&adminSupportCurrent?.id)loadAdminSupportThread(adminSupportCurrent.id,true);
  },3000);
}
function stopAdminSupportPolling(){clearInterval(adminSupportPollTimer);adminSupportPollTimer=0;}
async function openAdminSupportThread(id){
  const dialog=$('#adminSupportDialog');
  clearSupportAttachment('admin');
  $('#adminSupportMessages').innerHTML='<div class="support-empty">Загружаем диалог…</div>';
  $('#adminSupportStatus').textContent='';
  const hideBtn=$('#adminSupportHide');if(hideBtn)hideBtn.hidden=true;
  if(!dialog.open)dialog.showModal();
  await loadAdminSupportThread(id);
  startAdminSupportPolling();
}
const adminSupportDialog=$('#adminSupportDialog');
$('#adminSupportClose').onclick=()=>adminSupportDialog.close();
adminSupportDialog.addEventListener('click',e=>{if(e.target===adminSupportDialog)adminSupportDialog.close();});
adminSupportDialog.addEventListener('close',()=>{stopAdminSupportPolling();clearSupportAttachment('admin');});
$('#adminSupportList').addEventListener('click',e=>{const row=e.target.closest('[data-support-thread]');if(row)openAdminSupportThread(row.dataset.supportThread);});
$('#adminSupportForm').onsubmit=async e=>{
  e.preventDefault();
  const input=$('#adminSupportInput'),text=String(input.value||'').trim(),file=adminSupportAttachment;
  if(!text&&!file)return;
  if(!adminSupportCurrent?.id){$('#adminSupportStatus').textContent='Сначала выберите обращение.';return;}
  const btn=$('#adminSupportForm button[type="submit"]');btn.disabled=true;
  try{
    const attachment=file?await prepareSupportAttachment(file):null;
    await cloudRpc('sphere_support_reply',{p_id:currentAccount.id,p_token:currentAccount.token,p_thread:adminSupportCurrent.id,p_body:text,p_attachment:attachment});
    input.value='';clearSupportAttachment('admin');
    await loadAdminSupportThread(adminSupportCurrent.id,true);
  }catch(error){
    $('#adminSupportStatus').textContent=supportErrorText(error);
  }finally{btn.disabled=false;}
};
$('#adminSupportHide').onclick=()=>{
  if(!adminSupportCurrent?.id)return;
  const threadId=adminSupportCurrent.id,name=adminSupportCurrent.name||adminSupportCurrent.email||'обращение';
  openEditor('Удалить чат у себя',`<p>Удалить диалог с <b>${escapeHtml(name)}</b> из вашего списка?</p><p class="help-text">У пользователя чат и сообщения останутся. Если он напишет снова, обращение вернётся в список.</p>`,async()=>{
    try{
      await cloudRpc('sphere_support_admin_hide',{p_id:currentAccount.id,p_token:currentAccount.token,p_thread:threadId});
    }catch(error){throw new Error(supportErrorText(error));}
    adminSupportThreads=adminSupportThreads.filter(thread=>String(thread.id)!==String(threadId));
    adminSupportCurrent=null;
    adminSupportDialog.close();
    renderAdminSupport();
    toast('Чат удалён только у вас');
  },'Удалить у себя');
};

let adminLogSelectedId='';
const adminLogDialog=$('#adminLogDialog');
function adminLogEventsSource(){return visibleLogEvents(CLOUD_ENABLED?adminEvents:adminDb.events);}
function adminLogFilteredEvents(query=''){
  const needle=String(query||'').trim().toLowerCase();
  const events=adminLogEventsSource();
  if(!needle)return events;
  return events.filter(event=>{
    const actor=event.actor||{};
    return [event.action,event.details,event.targetId,event.id,actor.name,actor.alias,actor.email,actor.id].filter(Boolean).some(value=>String(value).toLowerCase().includes(needle));
  });
}
function adminLogDetailMarkup(event){
  if(!event)return '<div class="admin-empty">Выберите событие слева, чтобы увидеть подробности.</div>';
  const actor=event.actor||{};
  return `<p class="eyebrow">СОБЫТИЕ</p><h3>${escapeHtml(event.action||'событие')}</h3><div class="admin-log-detail-body">${event.details?`<p class="admin-log-detail-text">${escapeHtml(event.details)}</p>`:'<p class="admin-log-detail-text muted">Без дополнительного описания</p>'}<dl><dt>Когда</dt><dd>${formatAdminDateTime(event.at)}</dd><dt>Пользователь</dt><dd>${escapeHtml(actor.name||actor.alias||actor.email||'Гость')}</dd><dt>Псевдоним</dt><dd>${actor.alias?`@${escapeHtml(actor.alias)}`:'—'}</dd><dt>Email</dt><dd>${escapeHtml(actor.email||'—')}</dd><dt>ID пользователя</dt><dd class="mono">${escapeHtml(actor.id||'—')}</dd><dt>Объект действия</dt><dd class="mono">${escapeHtml(event.targetId||'—')}</dd><dt>ID события</dt><dd class="mono">${escapeHtml(event.id||'—')}</dd></dl></div>`;
}
function renderAdminLogFull(){
  const list=$('#adminLogFullList');if(!list)return;
  const events=adminLogFilteredEvents($('#adminLogSearch')?.value||'');
  if(!events.some(event=>event.id===adminLogSelectedId))adminLogSelectedId=events[0]?.id||'';
  list.innerHTML=events.length?events.map(event=>{
    const actor=event.actor||{};
    return `<button type="button" class="admin-log-full-item ${event.id===adminLogSelectedId?'active':''}" data-log-event="${escapeHtml(event.id)}"><span class="admin-log-full-top"><strong>${escapeHtml(actor.name||actor.alias||actor.email||'Гость')}</strong><small>${formatAdminDateTime(event.at)}</small></span><b>${escapeHtml(event.action||'событие')}</b>${event.details?`<span>${escapeHtml(event.details)}</span>`:''}</button>`;
  }).join(''):'<div class="admin-empty">События не найдены.</div>';
  $('#adminLogDetail').innerHTML=adminLogDetailMarkup(events.find(event=>event.id===adminLogSelectedId));
}
function openAdminLogDialog(id=''){
  adminLogSelectedId=id||adminLogSelectedId;
  const search=$('#adminLogSearch');if(search)search.value='';
  renderAdminLogFull();
  if(!adminLogDialog.open)adminLogDialog.showModal();
}
$('#adminLogFull')?.addEventListener('click',()=>openAdminLogDialog());
$('#adminLogClose').onclick=()=>adminLogDialog.close();
adminLogDialog.addEventListener('click',e=>{if(e.target===adminLogDialog)adminLogDialog.close();});
$('#adminLogSearch')?.addEventListener('input',()=>{adminLogSelectedId='';renderAdminLogFull();});
$('#adminLogFullList').addEventListener('click',e=>{const item=e.target.closest('[data-log-event]');if(!item)return;adminLogSelectedId=item.dataset.logEvent;renderAdminLogFull();});
$('#adminLogList').addEventListener('click',e=>{const item=e.target.closest('[data-log-event]');if(item)openAdminLogDialog(item.dataset.logEvent);});
$('#adminLogList').addEventListener('keydown',e=>{const item=e.target.closest('[data-log-event]');if(item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openAdminLogDialog(item.dataset.logEvent);}});

// --- Шутливая защита от просмотра исходного кода --------------------------
function sourceGuardExempt(){
  return isOwner(currentAccount)||sessionStorage.getItem('sphere-dev-bypass')==='1';
}
function showSourceGuard(){
  if(sourceGuardExempt())return;
  let guard=$('#sourceGuard');
  if(!guard){
    guard=document.createElement('div');
    guard.id='sourceGuard';
    guard.className='source-guard';
    guard.innerHTML=`<div class="source-guard-card"><div class="source-guard-emoji">🕵️‍♂️</div><p class="eyebrow">ТУТ ЖИВЁТ МАГИЯ</p><h1>Ой, посмотреть исходный код не получится</h1><button type="button" class="primary-btn" data-source-return>Вернуться в Сферу</button></div>`;
    document.body.append(guard);
    guard.addEventListener('click',event=>{
      if(event.target.closest('[data-source-return]'))location.reload();
    });
  }
  guard.hidden=false;
  document.documentElement.classList.add('source-guard-open');
  requestAnimationFrame(()=>guard.classList.add('visible'));
}
document.addEventListener('keydown',event=>{
  if(sourceGuardExempt()||event.key!=='F12')return;
  event.preventDefault();
  event.stopPropagation();
  showSourceGuard();
},true);

function stopCurrentTrack(){playGeneration++;embedPlaying=false;audio.pause();audio.removeAttribute('src');audio.load();currentTrack='';if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';stopAura();updateVolumeUI();const titleEl=$('#nowPlayingTitle'),artistEl=$('#nowPlayingArtist'),artEl=$('.album-art'),playEl=$('#playBtn'),heroEl=$('#musicHero');if(titleEl)titleEl.textContent='Нет активного трека';if(artistEl)artistEl.textContent='';if(artEl)artEl.innerHTML='<span>♪</span>';if(playEl)playEl.textContent='▶';if(heroEl){heroEl.classList.add('empty-player');heroEl.classList.remove('embed-playing','aura-on');}$('#musicProgressBar')?.classList.remove('disabled','seeking');musicProgressUpdate();updateMiniPlayer();renderMusic();}
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
    if(action==='playlist-delete'){const p=state.playlists.find(p=>p.id===id);if(p)confirmDelete(p.name,()=>{const tracks=state.tracks.filter(t=>t.playlist===id);if(tracks.some(t=>t.id===currentTrack))stopCurrentTrack();tracks.forEach(t=>{audioStore('delete',t.id).catch(()=>toast('Не удалось очистить файл из хранилища.',true));deleteTrackMedia(t);});state.tracks=state.tracks.filter(t=>t.playlist!==id);state.playlists=state.playlists.filter(p=>p.id!==id);if(selectedPlaylist===id)selectedPlaylist='';logAction('удалил плейлист',`«${p.name}» · ${tracks.length} треков`,id);});}
    if(action==='track-add')addTrackDialog(id);
    if(action==='track-edit')editTrack(id);
    if(action==='track-play')await playTrack(id);
    if(action==='track-favorite'){const track=state.tracks.find(t=>t.id===id);if(track){track.favorite=!track.favorite;logAction(track.favorite?'добавил трек в любимые':'убрал трек из любимых',`«${track.title}»`,id);persist();renderMusic();renderProfile();toast(track.favorite?'Добавлено в любимые':'Убрано из любимых');}}
    if(action==='track-delete'){const t=state.tracks.find(t=>t.id===id);if(t)confirmDelete(t.title,()=>{if(currentTrack===id)stopCurrentTrack();state.tracks=state.tracks.filter(t=>t.id!==id);audioStore('delete',id).catch(()=>toast('Не удалось очистить аудиофайл.',true));deleteTrackMedia(t);logAction('удалил трек',`«${t.title}»`,id);});}
    if(action==='sync-media'){syncMediaToCloud();}
    if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sphere-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);logAction('экспортировал данные','JSON-копия профиля');toast('Данные экспортированы. Аудио и видео в JSON не входят.');}
    if(action==='logout')logoutAccount();
    if(action==='change-password')changePasswordDialog();
    if(action==='set-recovery')setRecoveryDialog();
    if(action==='admin-profile')adminProfileDialog(id);
    if(action==='admin-warn')adminWarnDialog(id);
    if(action==='admin-delete')adminDeleteProfile(id);
  }catch(error){toast(error.message,true);}
});
document.addEventListener('click',async e=>{
  const row=e.target.closest('[data-track-row]');
  if(!row||e.target.closest('button,a,select,input,textarea,label'))return;
  await playTrack(row.dataset.trackRow);
});
document.addEventListener('click',async e=>{
  const card=e.target.closest('.playlist-card[data-playlist]');
  if(!card||e.target.closest('button,a,select,input,textarea,label'))return;
  selectedPlaylist=card.dataset.playlist;renderMusic();
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const card=e.target instanceof Element&&e.target.closest?.('.playlist-card[data-playlist]');
  if(!card)return;
  e.preventDefault();
  selectedPlaylist=card.dataset.playlist;renderMusic();
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
function emailValidationError(value){
  const email=normalizeEmail(value);
  if(!email)return 'Введите email.';
  if(email.length>254)return 'Email слишком длинный.';
  const at=email.indexOf('@');
  if(at<1||at!==email.lastIndexOf('@'))return 'Введите email в формате name@domain.ru.';
  const local=email.slice(0,at),domain=email.slice(at+1);
  if(local.length>64)return 'Часть email до @ слишком длинная.';
  if(!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local))return 'В email есть недопустимые символы.';
  if(local.startsWith('.')||local.endsWith('.')||local.includes('..'))return 'Точки в email расставлены неверно.';
  const labels=domain.split('.');
  if(labels.length<2)return 'После @ укажите почтовый домен, например mail.ru.';
  for(const label of labels){
    if(!label||label.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))return 'Почтовый домен после @ выглядит неверно.';
  }
  const tld=labels[labels.length-1];
  if(!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(tld))return 'У почтового домена должен быть нормальный адрес, например .ru или .com.';
  return '';
}
async function mailDomainAcceptsEmail(domain){
  const endpoints=[
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`
  ];
  for(const url of endpoints){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
    try{
      const response=await fetch(url,{headers:{Accept:'application/dns-json'},signal:controller.signal,cache:'no-store'});
      if(!response.ok)continue;
      const data=await response.json();
      if(+data?.Status===3)return false;
      if(+data?.Status!==0)continue;
      const mx=(Array.isArray(data.Answer)?data.Answer:[]).filter(item=>+item.type===15).map(item=>String(item.data||'').trim());
      if(!mx.length)return false;
      return mx.some(record=>record&&!/^0\s+\.?$/.test(record));
    }catch{}
    finally{clearTimeout(timer);}
  }
  return false;
}
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
  applyVolumeFromState();applyTheme();showView('overview');renderAll();updateClock();
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
    setTimeout(()=>showWarnings(warnings),650);
  }
  if(useCloud){startWarningPolling();startPresence();startAdminLive();}
  else{stopAdminLive();clearInterval(presenceTimer);presenceTimer=0;}
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
    const emailProblem=emailValidationError(email);if(emailProblem)throw new Error(emailProblem);
    if(alias.length<3)throw new Error('Псевдоним должен быть не короче 3 символов.');
    if(/\s/.test(alias))throw new Error('Псевдоним не должен содержать пробелы.');
    if(password.length<6)throw new Error('Пароль должен быть не короче 6 символов.');
    if(password!==password2)throw new Error('Пароли не совпадают.');
    if(CLOUD_ENABLED){
      const existingSalt=await cloudRpc('sphere_salt',{p_identifier:email});
      if(existingSalt)throw new Error('Аккаунт с таким email уже существует. Войдите или восстановите пароль.');
    }else if(accounts.some(item=>normalizeEmail(item.email)===email)){
      throw new Error('Аккаунт с таким email уже существует. Войдите или восстановите пароль.');
    }
    if(CLOUD_ENABLED||navigator.onLine){
      submit.textContent='Проверяем почту…';
      const mailOk=await mailDomainAcceptsEmail(email.slice(email.indexOf('@')+1));
      if(!mailOk)throw new Error('Почтовый домен не найден или не принимает письма. Проверьте адрес после @.');
      submit.textContent='Создаём аккаунт…';
    }
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
  finally{submit.disabled=false;submit.textContent='Создать аккаунт';}
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
const initialProgress=$('#musicProgress');if(initialProgress)initialProgress.style.width='0%';

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){saveCloudNow();return;}
  presenceHeartbeat(true);
  if(activeView==='admin'&&isOwner(currentAccount))refreshAdminData();
});
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
