'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateKey = (date = new Date(), timeZone = state?.weather?.timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).reduce((out,item)=>(out[item.type]=item.value,out),{});
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const today = () => dateKey(new Date());
const fromDate = value => new Date(`${value}T12:00:00`);
const formatDate = value => fromDate(value).toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'});
const LEGACY_STORAGE = 'sphere-v2';
const ACCOUNTS_KEY = 'sphere-accounts';
const SESSION_KEY = 'sphere-session';
const ACCOUNT_PREFIX = 'sphere-state:';
const priorityLabels = {urgent:'Срочный',medium:'Средний',low:'Не срочный'};
const priorityRank = {urgent:0,medium:1,low:2};
const normalizePriority = value => ({blue:'low',orange:'medium',purple:'urgent'}[value] || (priorityLabels[value] ? value : 'medium'));
const emptyState = () => ({version:3,tasks:[],goals:[],playlists:[],tracks:[],profile:{name:'',alias:'',photo:'',photoX:50,photoY:50,photoScale:1,layout:'card',video:'',videoDuration:0,ownerPrefix:'Владелец',status:'✦ В своём ритме'},habits:[{id:uid(),name:'Утренняя зарядка',days:[]},{id:uid(),name:'Читать 20 минут',days:[]}],note:'',theme:'dark',settings:{sound:false,focus:false,morning:false},weather:{city:'Москва',lat:55.7558,lon:37.6173,timezone:'Europe/Moscow',temp:null,code:null,desc:'',updated:0},newsSources:[],sessions:0});
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
// Each account gets its own state key. Legacy data is adopted by the first registered account.
function persist() {
  if (!currentAccount) return false;
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); return true; }
  catch { toast('Не удалось сохранить: хранилище браузера заполнено.', true); return false; }
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
let newsFilter = 'Все';
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
  if (!editor.open) editor.showModal();
  $('input:not([type=file]),textarea,select', editor)?.focus();
}
function closeEditor() { editor.close(); dialogReturnFocus?.focus(); }
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
  activeView = view;
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.view === view); el.setAttribute('aria-current', el.dataset.view === view ? 'page' : 'false'); });
  $('#sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});
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
  const now = new Date(), zone = state.weather?.timezone || undefined;
  const hour = +new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hour12:false}).format(now);
  $('#currentDate').textContent = now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:zone});
  const greeting = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  $('#greetingTitle').textContent = greeting + (state.profile.name.trim() ? `, ${state.profile.name.trim().split(/\s+/)[0]}` : '') + ' ✦';
  $('#motivationalText').textContent = compliments[now.getDay()];
  const zoned = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).reduce((o,p)=>(o[p.type]=p.value,o),{});
  $('#dateBadgeDay').textContent = zoned.day;
  $('#dateBadgeMonth').innerHTML = `${new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:zone}).format(now).toUpperCase()}<br>${zoned.year}`;
  $('#todayPlanDate').textContent = formatDate(today());
  if (refreshWeather) updateWeather();
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
  if (weather.temp != null) return `${weatherIcon(weather.code, weather.desc)} ${weather.city} · ${time} · ${Math.round(weather.temp)}°C`;
  if (weatherFailedAt) return `☁ ${weather.city} · ${time} · нет данных`;
  return `⌁ ${weather.city} · ${time}`;
}
function updateWeatherWidget() {
  const widget = $('#weatherWidget'); if (!widget) return;
  widget.textContent = weatherMarkup();
  widget.title = state.weather?.temp != null ? `${state.weather.desc || 'Погода сейчас'}. Нажми, чтобы выбрать город.` : weatherFailedAt ? 'Погода недоступна (нет сети). Нажми, чтобы выбрать город или обнови в настройках.' : 'Погода загружается…';
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
function applyTheme() { document.documentElement.dataset.theme = state.theme; $('#themeBtn').textContent = state.theme === 'light' ? '☾' : '☼'; }
$('#themeBtn').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; applyTheme(); persist(); };
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
    const key = dateKey(new Date(calendarYear,calendarMonth,day)), count = state.tasks.filter(task=>task.date===key).length;
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
  const layoutToggle=$('#profileLayoutToggle');
  if(layoutToggle){layoutToggle.textContent=state.profile.layout==='row'?'▤':'☰';layoutToggle.title=state.profile.layout==='row'?'Показать стандартный вид':'Показать компактный вид';}
  $('.user-mini strong').textContent=state.profile.name||'Мой профиль';
  $('.profile-body h2').textContent=state.profile.name||'Твоё имя';
  $('.profile-body>p').textContent=`${state.profile.ownerPrefix||'Владелец'} · @${state.profile.alias||'без_псевдонима'}`;
  $('.profile-status').textContent=state.profile.status||'✦ В своём ритме';
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
function renderNews() {
  const select=$('#newsCategorySelect');
  if(select){
    select.innerHTML=newsCategories.map(category=>`<option value="${escapeHtml(category)}" ${category===newsFilter?'selected':''}>${escapeHtml(category)}</option>`).join('');
    select.value=newsFilter;
  }
  const items=newsItems.filter(item=>newsFilter==='Все'||item.category===newsFilter);
  $('#newsList').innerHTML=items.map((item,index)=>`<article class="news-card card ${index===0?'featured-news':''}"><div class="article-icon ${index%2?'blue':'orange'}">${index%2?'⌁':'✦'}</div><div class="news-content"><div class="news-meta"><span>${escapeHtml(item.category.toUpperCase())}</span><small>${escapeHtml(item.source)}</small></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Читать источник →</a></div></article>`).join('');
  const count=(state.newsSources||[]).length;
  $('#manageSources').textContent=count?`Мои источники · ${count}`:'Мои источники';
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
$('#weatherWidget').onclick=chooseWeatherCity;
$('#newsCategorySelect')?.addEventListener('change', e=>{newsFilter=e.target.value;renderNews();});
$('#addNewsSource').onclick=()=>openEditor('Добавить источник',field('Название',input('name','','text','required maxlength="80"'))+field('Ссылка',input('url','','url','required placeholder="https://"')),data=>{const name=String(data.get('name')).trim(),url=String(data.get('url')).trim();try{new URL(url);}catch{throw new Error('Введите корректную ссылку.');}state.newsSources=[...(state.newsSources||[]),{name,url}];persist();renderNews();toast('Источник добавлен');});
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
  openEditor('Изменить профиль',field('Префикс владельца',input('ownerPrefix',state.profile.ownerPrefix||'Владелец','text','maxlength="30"'))+field('Имя',input('name',state.profile.name,'text','required maxlength="80" autocomplete="name"'))+field('Псевдоним',input('alias',state.profile.alias,'text','maxlength="40"'))+field('Эмодзи-статус',input('status',state.profile.status||'✦ В своём ритме','text','maxlength="60"'))+field('Фотография',input('photo','','file','accept="image/*"'))+photoBlock+field('Видео-фон',input('video','','file','accept="video/*"'))+`<p class="help-text" id="videoDurationHint">${durationHint} Видео будет проигрываться целиком, без обрезки.</p>`+'<div class="video-preview" id="videoPreviewWrap" hidden><video id="profileVideoPreview" muted playsinline controls></video></div>'+'<label class="checkbox-label"><input type="checkbox" name="removePhoto"> Удалить фото</label><label class="checkbox-label"><input type="checkbox" name="removeVideo"> Удалить видео</label>',async data=>{
    const name=String(data.get('name')).trim();if(!name)throw new Error('Введите имя.');
    const newPhoto=await imageData(data.get('photo'));
    const removePhoto=data.has('removePhoto');
    const photo=removePhoto&&!newPhoto?'':(newPhoto||state.profile.photo);
    const videoFile=data.get('video');
    let video=state.profile.video,videoDuration=+state.profile.videoDuration||0;
    if(data.has('removeVideo')){video='';videoDuration=0;}
    else if(videoFile?.size){const info=await videoData(videoFile);video=info.key;videoDuration=info.duration;}
    const previousVideo=state.profile.video;
    state.profile={...state.profile,ownerPrefix:String(data.get('ownerPrefix')).trim()||'Владелец',name,alias:String(data.get('alias')).trim().replace(/^@/,''),status:String(data.get('status')).trim()||'✦ В своём ритме',photo,photoX:photo?cropState.x:50,photoY:photo?cropState.y:50,photoScale:photo?cropState.scale:1,video,videoStart:0,videoEnd:0,videoDuration:video?videoDuration:0};
    if(previousVideo&&previousVideo!==video)audioStore('delete',previousVideo).catch(()=>{});
    saveAndRender();toast('Профиль сохранён');
  });
  initPhotoCrop();
  loadProfileVideoPreview();
}
$('#editProfileBtn').onclick=editProfile;
$('#profileLayoutToggle').onclick=()=>{state.profile.layout=state.profile.layout==='row'?'card':'row';persist();renderProfile();toast(state.profile.layout==='row'?'Компактный вид профиля':'Стандартный вид профиля');};

function renderHabits() {
  $$('.habit-card>.habit-row').forEach(el=>el.remove());
  $('.habit-card').insertAdjacentHTML('beforeend',state.habits.length?state.habits.map(h=>`<div class="habit-row"><span class="habit-icon blue">◒</span><div><strong>${escapeHtml(h.name)}</strong><span>${h.days.length} дней отмечено</span></div><button class="habit-check ${h.days.includes(today())?'done':''}" data-action="habit-toggle" data-id="${h.id}" aria-label="${escapeHtml(h.name)}" aria-pressed="${h.days.includes(today())}">${h.days.includes(today())?'✓':'○'}</button></div>`).join(''):empty('Добавь полезную привычку.'));
}
$('#habitMore').onclick=()=>openEditor('Мои привычки',state.habits.map(h=>`<div class="manage-row">${escapeHtml(h.name)}${button('habit-delete',h.id,'Удалить','text-btn')}</div>`).join('')+field('Новая привычка',input('name','','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');state.habits.push({id:uid(),name,days:[]});saveAndRender();},'Добавить');
$('#openFavorites').onclick=()=>{showView('music');selectedPlaylist='favorites';renderMusic();};
$('#noteBtn').onclick=()=>openEditor('Быстрая заметка',field('Твои идеи',`<textarea name="note" rows="10" maxlength="20000">${escapeHtml(state.note)}</textarea>`),data=>{state.note=String(data.get('note'));persist();toast('Заметка сохранена');});
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
const audio=new Audio();audio.preload='metadata';let objectURL='',playGeneration=0;
function coverMarkup(track,cls='track-cover') {return track?.cover?`<img class="${cls}" src="${escapeHtml(track.cover)}" alt="Обложка ${escapeHtml(track.title)}">`:`<span class="${cls} no-cover" title="Обложка не добавлена">♪</span>`;}
function renderMusic() {
  $('#musicHero').classList.toggle('empty-player', !currentTrack);
  $('#playlistGrid').innerHTML=state.playlists.length?state.playlists.map(p=>`<article class="playlist-card ${p.id===selectedPlaylist?'selected':''}"><strong>${escapeHtml(p.name)}</strong><small>${state.tracks.filter(t=>t.playlist===p.id).length} треков</small><div class="tool-controls">${button('playlist-open',p.id,'Открыть','text-btn')}${button('track-add',p.id,'＋ Трек','text-btn')}${button('playlist-edit',p.id,'✎','row-btn')}${button('playlist-delete',p.id,'×','row-btn')}</div></article>`).join(''):empty('Создай плейлист или импортируй его из файла.');
  let list=selectedPlaylist==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist);
  if(musicSort!=='new')list=list.filter(t=>t.hit===musicSort);
  list=[...list].sort((a,b)=>b.created-a.created);
  const playlist=state.playlists.find(p=>p.id===selectedPlaylist);
  $('#trackCount').textContent=`${list.length} треков`;
  $('#trackList').innerHTML=(selectedPlaylist?`<div class="manage-row"><strong>${escapeHtml(selectedPlaylist==='favorites'?'Любимые треки':playlist?.name||'')}</strong>${button('playlist-all','','Все плейлисты','text-btn')}</div>`:'')+(list.length?list.map(t=>`<div class="track-row">${coverMarkup(t)}<div class="task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.artist||'Исполнитель не указан')}</small></div><button class="heart-btn ${t.favorite?'liked':''}" data-action="track-favorite" data-id="${t.id}" aria-label="${t.favorite?'Убрать из любимых':'Добавить в любимые'}">${t.favorite?'♥':'♡'}</button><select class="hit-select" data-track="${t.id}" aria-label="Категория ${escapeHtml(t.title)}">${Object.entries(hits).map(([key,label])=>`<option value="${key}" ${key===t.hit?'selected':''}>${label}</option>`).join('')}</select>${button('track-play',t.id,currentTrack===t.id&&!audio.paused?'Ⅱ':'▶','row-btn')}${button('track-edit',t.id,'✎','row-btn')}${button('track-delete',t.id,'×','row-btn')}</div>`).join(''):empty(selectedPlaylist==='favorites'?'Ты пока не отметил ни одного трека сердечком.':'Треков в этой подборке пока нет. Добавь аудиофайл в свой плейлист.'));
}
function playlistEditor(id) {
  const playlist=state.playlists.find(p=>p.id===id);
  openEditor(playlist?'Название плейлиста':'Новый плейлист',field('Название',input('name',playlist?.name||'','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');if(playlist)playlist.name=name;else{const id=uid();state.playlists.push({id,name});selectedPlaylist=id;}saveAndRender();});
}
$('#createPlaylist').onclick=()=>playlistEditor(null);
$('#importVk').onclick=()=>openEditor('Импорт плейлиста','<p class="help-text">Выбери JSON-файл, экспортированный из VK или другого музыкального сервиса. Ссылки VK в интерфейсе не нужны.</p>'+field('Файл плейлиста',input('playlistFile','','file','accept=".json,application/json" required')),async data=>{
  const file=data.get('playlistFile');if(!file?.size)throw new Error('Выбери JSON-файл.');let imported;try{imported=JSON.parse(await file.text());}catch{throw new Error('Файл должен быть корректным JSON.');}
  const items=Array.isArray(imported)?imported:(Array.isArray(imported.tracks)?imported.tracks:Array.isArray(imported.audio)?imported.audio:[]);if(!items.length)throw new Error('В файле не найдено треков.');
  const playlistId=uid();state.playlists.push({id:playlistId,name:imported.name||imported.title||'Импортированный плейлист'});
  items.forEach(item=>state.tracks.push({id:uid(),title:item.title||item.name||'Без названия',artist:item.artist||item.author||'',playlist:playlistId,hit:'',cover:item.cover||item.image||'',created:Date.now()}));selectedPlaylist=playlistId;saveAndRender();toast(`Импортировано треков: ${items.length}`);
},'Импортировать');
async function editTrack(id,playlistId) {
  const track=state.tracks.find(t=>t.id===id),playlists=state.playlists;
  if(!playlists.length){playlistEditor(null);return;}
  openEditor(track?'Изменить трек':'Добавить трек',
    field('Название',input('title',track?.title||'','text','required maxlength="160"'))+field('Исполнитель',input('artist',track?.artist||'','text','maxlength="120"'))+
    field('Плейлист',`<select name="playlist">${playlists.map(p=>`<option value="${p.id}" ${p.id===(track?.playlist||playlistId)?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select>`)+
    field('Аудиофайл (MP3, M4A, OGG, WAV)',input('audio','','file',`accept="audio/*" ${track?'':'required'}`))+
    field('Родная обложка',input('cover','','file','accept="image/*"'))+'<p class="help-text">Для MP3 прочитаем обложку из ID3, если она встроена. Для других файлов можно загрузить оригинальную обложку вручную. Без неё покажем нейтральный значок.</p>'+field('Категория',`<select name="hit">${Object.entries(hits).map(([key,label])=>`<option value="${key}" ${key===(track?.hit||'')?'selected':''}>${label}</option>`).join('')}</select>`),async data=>{
      const title=String(data.get('title')).trim(),file=data.get('audio'),id=track?.id||uid();if(!title)throw new Error('Введите название.');if(!track&&!file.size)throw new Error('Выберите аудиофайл.');
      if(file.size>150*1024*1024)throw new Error('Максимальный размер аудиофайла — 150 МБ.');
      let cover=await imageData(data.get('cover'));
      if(file.size){if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav|flac)$/i.test(file.name))throw new Error('Выберите аудиофайл.');cover=cover||await embeddedCover(file);await audioStore('put',id,file);}
      const record={id,title,artist:String(data.get('artist')).trim(),playlist:String(data.get('playlist')),hit:String(data.get('hit')),cover:cover||track?.cover||'',created:track?.created||Date.now(),favorite:!!track?.favorite};
      if(track)state.tracks[state.tracks.indexOf(track)]=record;else state.tracks.push(record);
      saveAndRender();toast('Трек сохранён');
    });
}
async function playTrack(id) {
  if(currentTrack===id&&audio.src){if(audio.paused){try{await audio.play();}catch{toast('Не удалось воспроизвести файл.',true);}}else audio.pause();return;}
  const track=state.tracks.find(t=>t.id===id);if(!track)return;
  const generation=++playGeneration;
  try{const blob=await audioStore('get',id);if(generation!==playGeneration)return;if(!blob)throw new Error('Аудиофайл не найден. Добавьте его повторно через редактирование.');audio.pause();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(blob);audio.src=objectURL;currentTrack=id;
    $('#nowPlayingTitle').textContent=track.title;$('#nowPlayingArtist').textContent=track.artist||'Исполнитель не указан';$('.album-art').innerHTML=coverMarkup(track,'playing-cover');$('#musicHero').classList.remove('empty-player');await audio.play();
  }catch(error){toast(error.message||'Не удалось воспроизвести трек.',true);}
}
function nextTrack(direction) {const list=(selectedPlaylist==='favorites'?state.tracks.filter(t=>t.favorite):state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist)).filter(t=>musicSort==='new'||t.hit===musicSort);if(!list.length){toast(selectedPlaylist==='favorites'?'В любимых пока нет треков.':'Добавь треки в плейлист.');return;}const index=list.findIndex(t=>t.id===currentTrack);playTrack(list[(index+direction+list.length)%list.length].id);}
$('#playBtn').onclick=()=>currentTrack?playTrack(currentTrack):nextTrack(1);$('#prevTrack').onclick=()=>nextTrack(-1);$('#nextTrack').onclick=()=>nextTrack(1);
audio.onplay=()=>{$('#playBtn').textContent='Ⅱ';renderMusic();};audio.onpause=()=>{$('#playBtn').textContent='▶';renderMusic();};audio.onended=()=>nextTrack(1);audio.onerror=()=>toast('Формат аудио не поддерживается или файл повреждён.',true);
audio.ontimeupdate=()=>{$('#musicCurrent').textContent=timerText(Math.floor(audio.currentTime));$('#musicDuration').textContent=Number.isFinite(audio.duration)?timerText(Math.floor(audio.duration)):'0:00';$('#musicProgress').style.width=(audio.duration?audio.currentTime/audio.duration*100:0)+'%';};
$('.music-progress').onclick=e=>{if(Number.isFinite(audio.duration)){const box=e.currentTarget.getBoundingClientRect();audio.currentTime=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width))*audio.duration;}};
$('.music-progress').title='Нажми, чтобы перейти к нужному моменту';
$('#musicSort').onclick=()=>{const modes=['new','day','week','month','year'];musicSort=modes[(modes.indexOf(musicSort)+1)%modes.length];$('#musicSort').textContent=musicSort==='new'?'Все · сначала новые':hits[musicSort];renderMusic();};
document.addEventListener('change',e=>{if(e.target.matches('.hit-select')){const track=state.tracks.find(t=>t.id===e.target.dataset.track);if(track){track.hit=e.target.value;persist();renderMusic();}}});

// Settings only expose actions that have a real local implementation.
$('.preferences').innerHTML=`<div class="preference-row" id="accountPreference"></div><div class="preference-row"><div><strong>Утренний план</strong><span>Показывать напоминание при открытии после 08:00</span></div><button class="toggle" data-setting="morning" aria-label="Утренний план"><i></i></button></div><div class="preference-row"><div><strong>Звук выполнения</strong><span>Короткий сигнал при завершении задачи</span></div><button class="toggle" data-setting="sound" aria-label="Звук выполнения"><i></i></button></div><div class="preference-row"><div><strong>Фокус-режим</strong><span>Скрывать колокольчик напоминаний</span></div><button class="toggle" data-setting="focus" aria-label="Фокус-режим"><i></i></button></div><div class="preference-row"><div><strong>Хранение данных</strong><span>Автоматически в этом браузере. Аудио и видео — в IndexedDB.</span></div>${button('export','','Экспорт данных')}</div>`;
function renderSettings(){
  $$('[data-setting]').forEach(el=>{el.classList.toggle('on',state.settings[el.dataset.setting]);el.setAttribute('aria-pressed',String(state.settings[el.dataset.setting]));});
  $('#notificationsBtn').hidden=state.settings.focus;
  const account=$('#accountPreference');
  if(account)account.innerHTML=currentAccount?`<div><strong>Аккаунт</strong><span>${escapeHtml(currentAccount.email)} · @${escapeHtml(currentAccount.alias)}</span></div><button class="secondary-btn" data-action="logout">Выйти</button>`:'';
}
$('.preferences').insertAdjacentHTML('afterbegin',`<div class="preference-row weather-setting"><div><strong>Город для времени и погоды</strong><span id="settingsWeatherCity">${escapeHtml(state.weather.city)}</span></div><div class="preference-actions"><button class="secondary-btn" id="refreshWeather">Обновить погоду</button><button class="secondary-btn" id="chooseCitySettings">Изменить город</button></div></div>`);
$('#chooseCitySettings').onclick=chooseWeatherCity;
$('#refreshWeather').onclick=()=>{weatherUpdated=0;weatherFailedAt=0;weatherAttempts=0;updateWeather(true);toast('Обновляю погоду…');};
function updateSettingsCity(){ $('#settingsWeatherCity').textContent=state.weather.city; }
$$('[data-setting]').forEach(el=>el.onclick=()=>{state.settings[el.dataset.setting]=!state.settings[el.dataset.setting];persist();renderSettings();});
function completionSound(){if(!state.settings.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.07,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);osc.start();osc.stop(ctx.currentTime+.22);osc.onended=()=>ctx.close();}catch{}}
function stopCurrentTrack(){playGeneration++;audio.pause();audio.removeAttribute('src');audio.load();currentTrack='';if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';$('#nowPlayingTitle').textContent='Нет активного трека';$('#nowPlayingArtist').textContent='Выбери композицию из фонотеки';$('.album-art').innerHTML='<span>♪</span>';$('#musicCurrent').textContent='0:00';$('#musicDuration').textContent='0:00';$('#musicProgress').style.width='0%';$('#musicHero').classList.add('empty-player');}
document.addEventListener('click',async e=>{
  const target=e.target.closest('[data-action]');if(!target)return;const {action,id}=target.dataset;
  try {
    if(action==='task-cycle'){const task=state.tasks.find(t=>t.id===id);if(!task||task.date>today())return;task.progress=task.progress===100?0:task.progress+50;task.activityDate=task.progress?today():null;if(task.progress===100)completionSound();saveAndRender();}
    if(action==='task-edit')editTask(id);
    if(action==='task-delete'){const task=state.tasks.find(t=>t.id===id);confirmDelete(task.title,()=>{state.tasks=state.tasks.filter(t=>t.id!==id);});}
    if(action==='calendar-select'){selectedDate=id;renderCalendar();}
    if(action==='goal-edit')editGoal(id);
    if(action==='goal-delete'){const goal=state.goals.find(g=>g.id===id);confirmDelete(goal.title,()=>{state.goals=state.goals.filter(g=>g.id!==id);});}
    if(action==='habit-toggle'){const habit=state.habits.find(h=>h.id===id);habit.days=habit.days.includes(today())?habit.days.filter(d=>d!==today()):[...habit.days,today()];saveAndRender();}
    if(action==='habit-delete'){state.habits=state.habits.filter(h=>h.id!==id);saveAndRender();$('#habitMore').click();}
    if(action==='timer-toggle'){if(focusRunning){focusRemaining=Math.max(0,Math.ceil((focusEnd-Date.now())/1000));focusRunning=false;}else{if(focusRemaining<=0)focusRemaining=1500;focusEnd=Date.now()+focusRemaining*1000;focusRunning=true;}focusDialog();}
    if(action==='timer-reset'){focusRunning=false;focusRemaining=1500;focusDialog();}
    if(action==='playlist-open'){selectedPlaylist=id;renderMusic();}
    if(action==='playlist-all'){selectedPlaylist='';renderMusic();}
    if(action==='playlist-edit')playlistEditor(id);
    if(action==='playlist-delete'){const p=state.playlists.find(p=>p.id===id);confirmDelete(p.name,()=>{const tracks=state.tracks.filter(t=>t.playlist===id);if(tracks.some(t=>t.id===currentTrack))stopCurrentTrack();tracks.forEach(t=>audioStore('delete',t.id).catch(()=>toast('Не удалось очистить файл из хранилища.',true)));state.tracks=state.tracks.filter(t=>t.playlist!==id);state.playlists=state.playlists.filter(p=>p.id!==id);if(selectedPlaylist===id)selectedPlaylist='';});}
    if(action==='track-add')editTrack(null,id);
    if(action==='track-edit')editTrack(id);
    if(action==='track-play')await playTrack(id);
    if(action==='track-favorite'){const track=state.tracks.find(t=>t.id===id);if(track){track.favorite=!track.favorite;persist();renderMusic();renderProfile();toast(track.favorite?'Добавлено в любимые':'Убрано из любимых');}}
    if(action==='track-delete'){const t=state.tracks.find(t=>t.id===id);confirmDelete(t.title,()=>{if(currentTrack===id)stopCurrentTrack();state.tracks=state.tracks.filter(t=>t.id!==id);audioStore('delete',id).catch(()=>toast('Не удалось очистить аудиофайл.',true));});}
    if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sphere-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Данные экспортированы. Аудио и видео в JSON не входят.');}
    if(action==='logout')logoutAccount();
  }catch(error){toast(error.message,true);}
});
function renderAll(){renderTasks();renderCalendar();renderGoals();renderProfile();renderHabits();renderMusic();renderNews();renderSettings();updateSettingsCity();}
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
  $('#authSub').textContent=isRecovery?'Восстановление работает локально: по email и коду, который был выдан при регистрации.':'Данные сохраняются в этом браузере и привязаны к твоему аккаунту.';
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
function startSession(account) {
  currentAccount=account;STORAGE=accountKey(account);
  localStorage.setItem(SESSION_KEY,account.id);
  state=normalizeState(readStore(STORAGE,null)||emptyState());
  $('#authScreen').hidden=true;document.body.classList.remove('auth-locked');
  applyStateAfterLogin();
}
function logoutAccount() {
  persist();
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}
function showRecoveryCode(code, title='Аккаунт создан') {
  openEditor(title,`<p class="help-text">Этот код нужен, если ты забудешь пароль. Он показывается один раз — сохрани его в надёжном месте.</p><div class="recovery-code">${escapeHtml(code)}</div><p class="help-text">Войти можно по email или псевдониму. Восстановление — по email и этому коду.</p>`);
}
$$('[data-auth-tab]').forEach(button=>button.onclick=()=>showAuth(button.dataset.authTab));
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();authMessage('');const form=e.currentTarget,submit=$('button[type="submit"]',form);
  submit.disabled=true;
  try{
    const data=new FormData(form),login=String(data.get('login')||'').trim(),password=String(data.get('password')||'');
    const account=accounts.find(item=>normalizeEmail(item.email)===normalizeEmail(login)||normalizeAlias(item.alias)===normalizeAlias(login));
    if(!account)throw new Error('Аккаунт не найден. Проверь email или псевдоним.');
    const hash=await hashSecret(password,account.salt);
    if(hash!==account.passHash)throw new Error('Неверный пароль.');
    startSession(account);
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
    if(accounts.some(item=>normalizeEmail(item.email)===email))throw new Error('Аккаунт с таким email уже существует.');
    if(accounts.some(item=>normalizeAlias(item.alias)===normalizeAlias(alias)))throw new Error('Такой псевдоним уже занят.');
    const salt=randomHex(),recoveryCode=randomRecoveryCode();
    const account={id:uid(),email,alias,name:name||alias,salt,passHash:await hashSecret(password,salt),recoveryHash:await hashSecret(normalizeRecovery(recoveryCode),salt),created:Date.now()};
    const seed=firstAccountSeed?JSON.parse(JSON.stringify(firstAccountSeed)):emptyState();
    seed.profile.name=name||seed.profile.name||alias;seed.profile.alias=alias;
    localStorage.setItem(accountKey(account),JSON.stringify(normalizeState(seed)));
    accounts.push(account);localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
    startSession(account);showRecoveryCode(recoveryCode);
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
    const account=accounts.find(item=>normalizeEmail(item.email)===email);
    if(!account)throw new Error('Аккаунт с таким email не найден.');
    const recoveryHash=await hashSecret(code,account.salt);
    if(recoveryHash!==account.recoveryHash)throw new Error('Неверный код восстановления.');
    const recoveryCode=randomRecoveryCode();
    account.passHash=await hashSecret(password,account.salt);
    account.recoveryHash=await hashSecret(normalizeRecovery(recoveryCode),account.salt);
    localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
    startSession(account);showRecoveryCode(recoveryCode,'Пароль изменён');
  }catch(error){authMessage(error.message||'Не удалось восстановить доступ.');}
  finally{submit.disabled=false;}
};

// Clear the old visual demo counts immediately; no fabricated activity is migrated.
$('.focus-mini span').textContent='Прогресс задач';
$('#musicProgress').style.width='0%';
if(currentAccount)startSession(currentAccount);else showAuth(accounts.length?'login':'register');
