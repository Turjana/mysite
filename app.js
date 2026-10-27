'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = () => dateKey();
const fromDate = value => new Date(`${value}T12:00:00`);
const formatDate = value => fromDate(value).toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'});
const STORAGE = 'sphere-v2';
const emptyState = () => ({version:2,tasks:[],goals:[],playlists:[],tracks:[],profile:{name:'',alias:'',photo:''},habits:[{id:uid(),name:'Утренняя зарядка',days:[]},{id:uid(),name:'Читать 20 минут',days:[]}],note:'',theme:'dark',settings:{sound:false,focus:false,morning:false},sessions:0});
let state;
try { state = JSON.parse(localStorage.getItem(STORAGE)) || emptyState(); }
catch { state = emptyState(); }
// A separate versioned store starts the new real-data counters at zero. Legacy data stays intact.
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); return true; }
  catch { toast('Не удалось сохранить: хранилище браузера заполнено.', true); return false; }
}
function toast(text, error = false) {
  const el = $('#toast'); $('strong', el).textContent = error ? 'Внимание' : 'Сфера';
  $('small', el).textContent = text; el.classList.add('show');
  clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('show'), 4000);
}
let selectedDate = today(), calendarMonth = new Date().getMonth(), calendarYear = new Date().getFullYear();
let taskFilter = 'all', taskSort = 'date', musicSort = 'new', selectedPlaylist = '', currentTrack = '';
let activeView = 'overview', clockDate = today();
const statuses = {0:'Не начато',50:'Наполовину',100:'Выполнено'};
const hits = {'':'Без метки',day:'Хит дня',week:'Хит недели',month:'Хит месяца',year:'Хит года'};
const statusOptions = value => Object.entries(statuses).map(([key,label]) => `<option value="${key}" ${+key === +value ? 'selected' : ''}>${label}</option>`).join('');
const empty = text => `<p class="empty-state">${escapeHtml(text)}</p>`;
const field = (label, content) => `<label>${label}${content}</label>`;
const input = (name, value='', type='text', extra='') => `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}>`;
const button = (action, id, label, cls='secondary-btn') => `<button type="button" class="${cls}" data-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;

// One accessible dialog handles creation, editing, tools, and detail views.
$('#modal').remove(); $('#focusModal').remove();
document.body.insertAdjacentHTML('beforeend', '<dialog id="editor" class="editor card" aria-labelledby="editorTitle"><button type="button" class="modal-close" id="closeEditor" aria-label="Закрыть">×</button><h2 id="editorTitle"></h2><form id="editorForm"><div id="editorBody"></div><p id="formError" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelEditor">Закрыть</button><button type="submit" class="primary-btn" id="submitEditor">Сохранить</button></div></form></dialog>');
const editor = $('#editor'); let submitHandler = null, dialogReturnFocus;
function openEditor(title, body, onSubmit = null, label = 'Сохранить') {
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
$('.user-mini').onclick = () => showView('profile');
$('.user-mini').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showView('profile'); } };

const compliments = ['Ты умеешь двигаться вперёд — даже маленький шаг сегодня имеет значение.','Твоя настойчивость сильнее временных трудностей. Дай себе шанс начать.','У тебя есть всё, чтобы сделать этот день чуточку лучше.','Ты молодец: находить время для своих целей — уже важный шаг.','Твои идеи заслуживают воплощения. Начни с одного простого действия.','Ты растёшь с каждым шагом. Замечай и цени свой прогресс.','Тебе не нужно успеть всё. Выбери важное и позаботься о себе.'];
function updateClock() {
  const now = new Date(), hour = now.getHours();
  $('#currentDate').textContent = now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const greeting = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  $('#greetingTitle').textContent = greeting + (state.profile.name.trim() ? `, ${state.profile.name.trim().split(/\s+/)[0]}` : '') + ' ✦';
  $('#motivationalText').textContent = compliments[now.getDay()];
  $('#dateBadgeDay').textContent = now.getDate();
  $('#dateBadgeMonth').innerHTML = `${now.toLocaleDateString('ru-RU',{month:'short'}).toUpperCase()}<br>${now.getFullYear()}`;
  $('#todayPlanDate').textContent = formatDate(today());
  if (clockDate !== today()) { clockDate = today(); renderAll(); }
}
function applyTheme() { document.documentElement.dataset.theme = state.theme; $('#themeBtn').textContent = state.theme === 'light' ? '☾' : '☼'; }
$('#themeBtn').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; applyTheme(); persist(); };
applyTheme();

function editTask(id, date = today()) {
  const task = state.tasks.find(item => item.id === id);
  if (!task && date < today()) { toast('Добавлять задачи на прошедшие даты нельзя.', true); return; }
  const value = task || {title:'',date,time:'10:00',priority:'blue',progress:0};
  const minimum = task && task.date < today() ? '' : `min="${today()}"`;
  openEditor(task ? 'Изменить задачу' : 'Новая задача',
    field('Название', input('title',value.title,'text','required maxlength="160"')) +
    `<div class="form-row">${field('Дата', input('date',value.date,'date',`required ${minimum}`))}${field('Время',input('time',value.time,'time','required'))}</div>` +
    field('Приоритет', `<select name="priority">${[['blue','Обычный'],['orange','Важный'],['purple','Высокий']].map(([key,label])=>`<option value="${key}" ${key===value.priority?'selected':''}>${label}</option>`).join('')}</select>`) +
    field('Выполнение', `<select name="progress">${statusOptions(value.progress)}</select>`), data => {
      const chosen = String(data.get('date')), title = String(data.get('title')).trim();
      if (!title) throw new Error('Введите название.');
      if (chosen < today() && (!task || chosen !== task.date)) throw new Error('Нельзя создать или перенести задачу в прошлое.');
      const progress = +data.get('progress');
      if (chosen > today() && progress > 0) throw new Error('Отметить выполнение можно в день задачи или позднее.');
      const record = {...value,id:task?.id || uid(),title,date:chosen,time:String(data.get('time')),priority:String(data.get('priority')),progress};
      record.activityDate = progress ? (task?.progress === progress ? task.activityDate : today()) : null;
      if (task) state.tasks[state.tasks.indexOf(task)] = record; else state.tasks.push(record);
      saveAndRender(); toast(task ? 'Задача обновлена' : 'Задача добавлена');
    }, task ? 'Сохранить' : 'Добавить');
}
function taskMarkup(task) {
  return `<div class="task-item ${task.progress===100?'completed':''}">
    <button class="task-checkbox ${task.progress===50?'half':''}" data-action="task-cycle" data-id="${task.id}" ${task.date>today()?'disabled':''} title="Переключить: не начато → наполовину → выполнено" aria-label="${escapeHtml(task.title)}: ${statuses[task.progress]}">${task.progress===100?'✓':task.progress===50?'½':''}</button>
    <div class="task-copy"><strong>${escapeHtml(task.title)}</strong><small>${formatDate(task.date)} · ${task.time} · ${statuses[task.progress]}</small></div><i class="task-dot dot-${task.priority}"></i>
    ${button('task-edit',task.id,'✎','row-btn')}${button('task-delete',task.id,'×','row-btn')}</div>`;
}
function sortedTasks(list) {
  return [...list].sort(taskSort === 'priority' ? (a,b)=>({purple:0,orange:1,blue:2}[a.priority]-{purple:0,orange:1,blue:2}[b.priority]) : taskSort === 'progress' ? (a,b)=>a.progress-b.progress : (a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function renderTasks() {
  const daily = state.tasks.filter(task => task.date === today()), completed = state.tasks.filter(task => task.progress === 100).length;
  const doneToday = daily.filter(task=>task.progress===100).length, percent = state.tasks.length ? Math.round(completed / state.tasks.length * 100) : 0;
  $('#todayTasks').innerHTML = daily.length ? sortedTasks(daily).map(taskMarkup).join('') : empty('На сегодня задач нет. Добавь свой первый шаг.');
  const filtered = state.tasks.filter(task => taskFilter === 'all' || (taskFilter === 'today' ? task.date === today() : task.priority !== 'blue'));
  $('#allTasks').innerHTML = filtered.length ? sortedTasks(filtered).map(taskMarkup).join('') : empty('Здесь пока нет задач.');
  $('#allTaskCount').textContent = state.tasks.length; $('#todayTaskCount').textContent = daily.length;
  $('#importantTaskCount').textContent = state.tasks.filter(task=>task.priority!=='blue').length;
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
  $$('#energyBars i').forEach((el,index)=>el.classList.toggle('on',(index+1)/7*100 <= percent));
  $('.notification-dot').hidden = !daily.some(task=>task.progress<100);
}
['#openTask','#openTask2','#addInline'].forEach(selector => $(selector).onclick = () => editTask(null));
$('#openEvent').onclick = () => editTask(null,selectedDate);
$$('.tab').forEach(el => el.onclick = () => { taskFilter = el.dataset.filter; $$('.tab').forEach(tab=>tab.classList.toggle('active',tab===el)); renderTasks(); });
$('#sortTasks').onclick = () => { const modes = ['date','priority','progress']; taskSort = modes[(modes.indexOf(taskSort)+1)%3]; $('#sortTasks').textContent = {date:'По дате ↑',priority:'По приоритету ↑',progress:'По выполнению ↑'}[taskSort]; renderTasks(); };
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
  return state.profile.photo ? `<img src="${escapeHtml(state.profile.photo)}" alt="Фото профиля">` : escapeHtml(state.profile.name.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase() || 'Я');
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
  photoAccent(state.profile.photo);
  $('.user-mini strong').textContent=state.profile.name||'Мой профиль';
  $('.profile-body h2').textContent=state.profile.name||'Твоё имя';
  $('.profile-body>p').textContent=state.profile.alias?`@${state.profile.alias}`:'Добавь псевдоним';
  const stats=$$('.profile-stats b');stats[0].textContent=activityStreak();stats[1].textContent=state.tasks.filter(item=>item.progress===100).length;stats[2].textContent=state.goals.filter(item=>item.progress===100).length;
  $$('.profile-stats span')[2].textContent='целей достигнуто';
  const monday=new Date();monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  const all=[...state.tasks,...state.goals],scores=[];
  for(let i=0;i<7;i++){const day=new Date(monday);day.setDate(day.getDate()+i);scores.push(all.filter(item=>item.activityDate===dateKey(day)).reduce((sum,item)=>sum+item.progress/100,0));}
  const max=Math.max(1,...scores);
  $('.chart-bars').innerHTML=scores.map((score,i)=>`<div class="chart-column"><span>${score.toLocaleString('ru-RU')}</span><i style="height:${score/max*125}px" title="${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}: ${score} балла"></i></div>`).join('');
  $('.stat-callout strong').textContent=`За неделю: ${scores.reduce((a,b)=>a+b,0).toLocaleString('ru-RU')} балла`;
  $('.stat-callout small').textContent='Выполненная задача или цель = 1 балл; наполовину = 0,5. Учитывается последняя дата изменения прогресса.';
  updateClock();
}
async function imageData(file) {
  if(!file || !file.size) return null;
  if(!file.type.startsWith('image/')) throw new Error('Выберите изображение.');
  const bitmap=await createImageBitmap(file), scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.86);
}
function editProfile() {
  openEditor('Изменить профиль',field('Имя',input('name',state.profile.name,'text','required maxlength="80" autocomplete="name"'))+field('Псевдоним',input('alias',state.profile.alias,'text','maxlength="40"'))+field('Фотография',input('photo','','file','accept="image/*"'))+'<label class="checkbox-label"><input type="checkbox" name="removePhoto"> Удалить текущее фото</label>',async data=>{
    const name=String(data.get('name')).trim();if(!name)throw new Error('Введите имя.');
    const photo=await imageData(data.get('photo'));
    state.profile={name,alias:String(data.get('alias')).trim().replace(/^@/,''),photo:photo||(data.has('removePhoto')?'':state.profile.photo)};
    saveAndRender();toast('Профиль сохранён');
  });
}
$('.profile-body>.secondary-btn').onclick=editProfile;
const profileButton=$('#view-profile .page-header .primary-btn');profileButton.textContent='Изменить профиль';profileButton.onclick=editProfile;

function renderHabits() {
  $$('.habit-card>.habit-row').forEach(el=>el.remove());
  $('.habit-card').insertAdjacentHTML('beforeend',state.habits.length?state.habits.map(h=>`<div class="habit-row"><span class="habit-icon blue">◒</span><div><strong>${escapeHtml(h.name)}</strong><span>${h.days.length} дней отмечено</span></div><button class="habit-check ${h.days.includes(today())?'done':''}" data-action="habit-toggle" data-id="${h.id}" aria-label="${escapeHtml(h.name)}" aria-pressed="${h.days.includes(today())}">${h.days.includes(today())?'✓':'○'}</button></div>`).join(''):empty('Добавь полезную привычку.'));
}
$('#habitMore').onclick=()=>openEditor('Мои привычки',state.habits.map(h=>`<div class="manage-row">${escapeHtml(h.name)}${button('habit-delete',h.id,'Удалить','text-btn')}</div>`).join('')+field('Новая привычка',input('name','','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');state.habits.push({id:uid(),name,days:[]});saveAndRender();},'Добавить');
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
  $('#playlistGrid').innerHTML=state.playlists.length?state.playlists.map(p=>`<article class="playlist-card ${p.id===selectedPlaylist?'selected':''}"><strong>${escapeHtml(p.name)}</strong><small>${p.vk?'VK · официальный плеер':`${state.tracks.filter(t=>t.playlist===p.id).length} треков`}</small><div class="tool-controls">${button('playlist-open',p.id,'Открыть','text-btn')}${p.vk?'':button('track-add',p.id,'＋ Трек','text-btn')}${button('playlist-edit',p.id,'✎','row-btn')}${button('playlist-delete',p.id,'×','row-btn')}</div></article>`).join(''):empty('Создай плейлист или добавь ссылку VK.');
  let list=state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist);
  if(musicSort!=='new')list=list.filter(t=>t.hit===musicSort);
  list=[...list].sort((a,b)=>b.created-a.created);
  const playlist=state.playlists.find(p=>p.id===selectedPlaylist);
  $('#trackCount').textContent=`${list.length} треков`;
  $('#trackList').innerHTML=(selectedPlaylist?`<div class="manage-row"><strong>${escapeHtml(playlist?.name||'')}</strong>${button('playlist-all','','Все плейлисты','text-btn')}</div>`:'')+(playlist?.vk?`<div class="vk-widget"><iframe title="Плейлист VK: ${escapeHtml(playlist.name)}" src="https://vk.com/widget_playlist.php?${new URLSearchParams({oid:playlist.vk.owner,pid:playlist.vk.id,hash:playlist.vk.key||''})}" allow="autoplay; encrypted-media" loading="lazy"></iframe><p class="help-text">Треки и родные обложки отображает VK. Доступность зависит от входа в VK и прав на плейлист. Перенос списка треков и индивидуальные метки через одну ссылку недоступны.</p><a href="${escapeHtml(playlist.url)}" target="_blank" rel="noopener noreferrer">Открыть в VK ↗</a></div>`:list.length?list.map(t=>`<div class="track-row">${coverMarkup(t)}<div class="task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.artist||'Исполнитель не указан')}</small></div><select class="hit-select" data-track="${t.id}" aria-label="Категория ${escapeHtml(t.title)}">${Object.entries(hits).map(([key,label])=>`<option value="${key}" ${key===t.hit?'selected':''}>${label}</option>`).join('')}</select>${button('track-play',t.id,currentTrack===t.id&&!audio.paused?'Ⅱ':'▶','row-btn')}${button('track-edit',t.id,'✎','row-btn')}${button('track-delete',t.id,'×','row-btn')}</div>`).join(''):empty('Треков в этой подборке пока нет. Добавь аудиофайл в свой плейлист.'));
}
function playlistEditor(id) {
  const playlist=state.playlists.find(p=>p.id===id);
  openEditor(playlist?'Название плейлиста':'Новый плейлист',field('Название',input('name',playlist?.name||'','text','required maxlength="100"')),data=>{const name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');if(playlist)playlist.name=name;else{const id=uid();state.playlists.push({id,name});selectedPlaylist=id;}saveAndRender();});
}
$('#createPlaylist').onclick=()=>playlistEditor(null);
function parseVkLink(value) {
  let url;try{url=new URL(value);}catch{throw new Error('Введите полную ссылку VK.');}
  if(!['vk.com','www.vk.com','m.vk.com','vk.ru','www.vk.ru','m.vk.ru'].includes(url.hostname)||url.protocol!=='https:')throw new Error('Нужна HTTPS-ссылка на vk.com или vk.ru.');
  const path=decodeURIComponent(url.pathname+' '+url.searchParams.get('z'));
  const match=path.match(/(?:music\/playlist\/|audio_playlist)(-?\d+)_(\d+)(?:_([a-zA-Z0-9]+))?/);
  if(!match)throw new Error('Не удалось найти плейлист. Пример: https://vk.com/music/playlist/-123_456');
  return {owner:match[1],id:match[2],key:match[3]||url.searchParams.get('access_key')||''};
}
$('#importVk').onclick=()=>openEditor('Плейлист VK по ссылке','<p class="help-text">Добавим официальный проигрыватель VK с оригинальными треками и обложками. Для полного импорта отдельных аудиозаписей нужен доступ к API VK; ссылка не предоставляет такой доступ.</p>'+field('Название',input('name','','text','required maxlength="100"'))+field('Ссылка на плейлист',input('url','','url','required placeholder="https://vk.com/music/playlist/-123_456"')),data=>{
  const url=String(data.get('url')).trim(),vk=parseVkLink(url),name=String(data.get('name')).trim();if(!name)throw new Error('Введите название.');
  const duplicate=state.playlists.find(p=>p.vk?.owner===vk.owner&&p.vk?.id===vk.id);if(duplicate)throw new Error('Этот плейлист уже добавлен.');
  const id=uid();state.playlists.push({id,name,url,vk});selectedPlaylist=id;saveAndRender();toast('Ссылка VK добавлена');
},'Добавить плеер VK');
async function editTrack(id,playlistId) {
  const track=state.tracks.find(t=>t.id===id),playlists=state.playlists.filter(p=>!p.vk);
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
      const record={id,title,artist:String(data.get('artist')).trim(),playlist:String(data.get('playlist')),hit:String(data.get('hit')),cover:cover||track?.cover||'',created:track?.created||Date.now()};
      if(track)state.tracks[state.tracks.indexOf(track)]=record;else state.tracks.push(record);
      saveAndRender();toast('Трек сохранён');
    });
}
async function playTrack(id) {
  if(currentTrack===id&&audio.src){if(audio.paused){try{await audio.play();}catch{toast('Не удалось воспроизвести файл.',true);}}else audio.pause();return;}
  const track=state.tracks.find(t=>t.id===id);if(!track)return;
  const generation=++playGeneration;
  try{const blob=await audioStore('get',id);if(generation!==playGeneration)return;if(!blob)throw new Error('Аудиофайл не найден. Добавьте его повторно через редактирование.');audio.pause();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(blob);audio.src=objectURL;currentTrack=id;
    $('#nowPlayingTitle').textContent=track.title;$('#nowPlayingArtist').textContent=track.artist||'Исполнитель не указан';$('.album-art').innerHTML=coverMarkup(track,'playing-cover');await audio.play();
  }catch(error){toast(error.message||'Не удалось воспроизвести трек.',true);}
}
function nextTrack(direction) {const list=state.tracks.filter(t=>!selectedPlaylist||t.playlist===selectedPlaylist).filter(t=>musicSort==='new'||t.hit===musicSort);if(!list.length){toast('Добавь треки в плейлист.');return;}const index=list.findIndex(t=>t.id===currentTrack);playTrack(list[(index+direction+list.length)%list.length].id);}
$('#playBtn').onclick=()=>currentTrack?playTrack(currentTrack):nextTrack(1);$('#prevTrack').onclick=()=>nextTrack(-1);$('#nextTrack').onclick=()=>nextTrack(1);
audio.onplay=()=>{$('#playBtn').textContent='Ⅱ';renderMusic();};audio.onpause=()=>{$('#playBtn').textContent='▶';renderMusic();};audio.onended=()=>nextTrack(1);audio.onerror=()=>toast('Формат аудио не поддерживается или файл повреждён.',true);
audio.ontimeupdate=()=>{$('#musicCurrent').textContent=timerText(Math.floor(audio.currentTime));$('#musicDuration').textContent=Number.isFinite(audio.duration)?timerText(Math.floor(audio.duration)):'0:00';$('#musicProgress').style.width=(audio.duration?audio.currentTime/audio.duration*100:0)+'%';};
$('.music-progress').onclick=e=>{if(Number.isFinite(audio.duration)){const box=e.currentTarget.getBoundingClientRect();audio.currentTime=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width))*audio.duration;}};
$('.music-progress').title='Нажми, чтобы перейти к нужному моменту';
$('#musicSort').onclick=()=>{const modes=['new','day','week','month','year'];musicSort=modes[(modes.indexOf(musicSort)+1)%modes.length];$('#musicSort').textContent=musicSort==='new'?'Все · сначала новые':hits[musicSort];renderMusic();};
document.addEventListener('change',e=>{if(e.target.matches('.hit-select')){const track=state.tracks.find(t=>t.id===e.target.dataset.track);if(track){track.hit=e.target.value;persist();renderMusic();}}});

// Settings only expose actions that have a real local implementation.
$('.preferences').innerHTML=`<div class="preference-row"><div><strong>Утренний план</strong><span>Показывать напоминание при открытии после 08:00</span></div><button class="toggle" data-setting="morning" aria-label="Утренний план"><i></i></button></div><div class="preference-row"><div><strong>Звук выполнения</strong><span>Короткий сигнал при завершении задачи</span></div><button class="toggle" data-setting="sound" aria-label="Звук выполнения"><i></i></button></div><div class="preference-row"><div><strong>Фокус-режим</strong><span>Скрывать колокольчик напоминаний</span></div><button class="toggle" data-setting="focus" aria-label="Фокус-режим"><i></i></button></div><div class="preference-row"><div><strong>Хранение данных</strong><span>Автоматически в этом браузере. Аудиофайлы — в IndexedDB.</span></div>${button('export','','Экспорт данных')}</div>`;
function renderSettings(){ $$('[data-setting]').forEach(el=>{el.classList.toggle('on',state.settings[el.dataset.setting]);el.setAttribute('aria-pressed',String(state.settings[el.dataset.setting]));});$('#notificationsBtn').hidden=state.settings.focus; }
$$('[data-setting]').forEach(el=>el.onclick=()=>{state.settings[el.dataset.setting]=!state.settings[el.dataset.setting];persist();renderSettings();});
function completionSound(){if(!state.settings.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.07,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);osc.start();osc.stop(ctx.currentTime+.22);osc.onended=()=>ctx.close();}catch{}}
function stopCurrentTrack(){playGeneration++;audio.pause();audio.removeAttribute('src');audio.load();currentTrack='';if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';$('#nowPlayingTitle').textContent='Выбери трек';$('#nowPlayingArtist').textContent='Твои добавленные композиции появятся здесь';$('.album-art').innerHTML='<span>♪</span>';$('#musicCurrent').textContent='0:00';$('#musicDuration').textContent='0:00';$('#musicProgress').style.width='0%';}
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
    if(action==='track-delete'){const t=state.tracks.find(t=>t.id===id);confirmDelete(t.title,()=>{if(currentTrack===id)stopCurrentTrack();state.tracks=state.tracks.filter(t=>t.id!==id);audioStore('delete',id).catch(()=>toast('Не удалось очистить аудиофайл.',true));});}
    if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sphere-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Данные экспортированы. Аудиофайлы в JSON не входят.');}
  }catch(error){toast(error.message,true);}
});
function renderAll(){renderTasks();renderCalendar();renderGoals();renderProfile();renderHabits();renderMusic();renderSettings();}
function saveAndRender(){persist();renderAll();}
renderAll();
if(state.settings.morning&&new Date().getHours()>=8&&state.lastMorning!==today()){state.lastMorning=today();persist();toast(`Твой план на сегодня: ${state.tasks.filter(t=>t.date===today()&&t.progress<100).length} незавершённых задач.`);}
// Clear the old visual demo counts immediately; no fabricated activity is migrated.
$('.focus-mini span').textContent='Прогресс задач';
$('#musicProgress').style.width='0%';
$$('.row-btn').forEach(el=>el.title=el.textContent==='✎'?'Изменить':el.textContent==='×'?'Удалить':'Воспроизвести');
