import { loadUserQuestions, addUserQuestion, removeUserQuestion } from './user-store.js';

const PATTERNS = [
  { n: 1, label: '第1文型', form: 'SV' },
  { n: 2, label: '第2文型', form: 'SVC' },
  { n: 3, label: '第3文型', form: 'SVO' },
  { n: 4, label: '第4文型', form: 'SVOO' },
  { n: 5, label: '第5文型', form: 'SVOC' }
];

// 画面表示用に O1/O2 を添字にする。データ側は入力しやすい ASCII のままにしておく
const ROLE_LABELS = { O1: 'O₁', O2: 'O₂' };

const state = {
  builtinQuestions: [],
  questions: [],
  index: 0,
  correctCount: 0,
  missed: [],
  lastSettings: null
};

const $ = (id) => document.getElementById(id);

async function init() {
  bindEvents();
  renderAnswerButtons();
  renderAnswerRadios();
  showScreen('home');
  try {
    const res = await fetch('data/questions.json');
    if (!res.ok) throw new Error(String(res.status));
    state.builtinQuestions = await res.json();
  } catch {
    $('home-message').textContent = '収録問題を読み込めませんでした。通信状態を確認してください。';
  }
  registerServiceWorker();
}

function bindEvents() {
  $('start-button').addEventListener('click', () => startQuiz(readSettings()));
  $('open-register-button').addEventListener('click', openRegister);
  $('quit-button').addEventListener('click', () => showScreen('home'));
  $('next-button').addEventListener('click', goNext);
  $('retry-button').addEventListener('click', () => startQuiz(state.lastSettings));
  $('home-button').addEventListener('click', () => showScreen('home'));
  $('register-back-button').addEventListener('click', () => showScreen('home'));
  $('register-form').addEventListener('submit', handleRegisterSubmit);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.id !== `screen-${name}`;
  });
  window.scrollTo(0, 0);
}

function getCheckedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function readSettings() {
  return { source: getCheckedValue('source'), count: Number(getCheckedValue('count')) };
}

function buildPool(source) {
  const userQuestions = loadUserQuestions();
  if (source === 'builtin') return [...state.builtinQuestions];
  if (source === 'user') return userQuestions;
  return [...state.builtinQuestions, ...userQuestions];
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startQuiz(settings) {
  const pool = shuffle(buildPool(settings.source));
  if (pool.length === 0) {
    $('home-message').textContent = settings.source === 'user'
      ? 'まだ英文が登録されていません。「自分の英文を登録する」から追加してください。'
      : '出題できる問題がありません。';
    return;
  }
  $('home-message').textContent = '';
  state.lastSettings = settings;
  state.questions = settings.count > 0 ? pool.slice(0, settings.count) : pool;
  state.index = 0;
  state.correctCount = 0;
  state.missed = [];
  showScreen('quiz');
  renderQuestion();
}

// 判定対象の部分だけ <mark> で囲む。外部データなので innerHTML は使わずテキストノードで組み立てる
function renderSentence(container, text, target) {
  container.replaceChildren();
  const start = target ? text.indexOf(target) : -1;
  if (start < 0) {
    container.textContent = text;
    return;
  }
  const mark = document.createElement('mark');
  mark.textContent = target;
  container.append(text.slice(0, start), mark, text.slice(start + target.length));
}

function formatSource(q) {
  if (q.isUser) return q.source ? `出典: ${q.source}` : '自分の英文';
  return `${q.authorJa}『${q.workJa}』（${q.year}）`;
}

function renderQuestion() {
  const q = state.questions[state.index];
  const hasTarget = Boolean(q.target) && q.text.includes(q.target);
  $('progress').textContent = `${state.index + 1} / ${state.questions.length}`;
  $('question-instruction').textContent = hasTarget
    ? '色をつけた部分の文型は？'
    : '文全体（主節）の文型は？';
  renderSentence($('question-text'), q.text, hasTarget ? q.target : '');
  $('question-source').textContent = formatSource(q);
  $('feedback').hidden = true;
  setAnswerButtonsEnabled(true);
  $('answer-buttons').querySelectorAll('button').forEach((b) => b.classList.remove('is-correct', 'is-wrong'));
}

function renderAnswerButtons() {
  const wrap = $('answer-buttons');
  PATTERNS.forEach((p) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.dataset.answer = String(p.n);
    const label = document.createElement('span');
    label.textContent = p.label;
    const form = document.createElement('span');
    form.className = 'form';
    form.textContent = p.form;
    button.append(label, form);
    button.addEventListener('click', () => handleAnswer(p.n));
    wrap.append(button);
  });
}

function setAnswerButtonsEnabled(enabled) {
  $('answer-buttons').querySelectorAll('button').forEach((b) => {
    b.disabled = !enabled;
  });
}

function handleAnswer(chosen) {
  const q = state.questions[state.index];
  const isCorrect = chosen === q.answer;
  if (isCorrect) state.correctCount += 1;
  else state.missed.push({ question: q, chosen });

  setAnswerButtonsEnabled(false);
  $('answer-buttons').querySelectorAll('button').forEach((b) => {
    const n = Number(b.dataset.answer);
    if (n === q.answer) b.classList.add('is-correct');
    else if (n === chosen) b.classList.add('is-wrong');
  });
  renderFeedback(q, isCorrect);
}

function patternText(n) {
  const p = PATTERNS.find((x) => x.n === n);
  return p ? `${p.label}（${p.form}）` : '';
}

function renderFeedback(q, isCorrect) {
  const result = $('feedback-result');
  result.textContent = `${isCorrect ? '正解' : '不正解'}　答え: ${patternText(q.answer)}`;
  result.classList.toggle('is-correct', isCorrect);
  result.classList.toggle('is-wrong', !isCorrect);
  renderParts(q.parts || []);
  setOptionalText('feedback-point', q.point ? `引っかけポイント: ${q.point}` : '');
  setOptionalText('feedback-explanation', q.explanation || '');
  setOptionalText('feedback-note', q.note ? `補足: ${q.note}` : '');
  $('next-button').textContent = state.index + 1 < state.questions.length ? '次へ' : '結果を見る';
  $('feedback').hidden = false;
  $('feedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setOptionalText(id, text) {
  const el = $(id);
  el.textContent = text;
  el.hidden = text === '';
}

// 文の要素ごとに「役割ラベル＋語句」のチップを並べ、骨格を目で追えるようにする
function renderParts(parts) {
  const wrap = $('feedback-parts');
  wrap.replaceChildren();
  wrap.hidden = parts.length === 0;
  parts.forEach(([text, role]) => {
    const chip = document.createElement('span');
    chip.className = `part role-${role.charAt(0).toLowerCase()}`;
    const label = document.createElement('span');
    label.className = 'part-role';
    label.textContent = ROLE_LABELS[role] || role;
    const body = document.createElement('span');
    body.className = 'part-text';
    body.textContent = text;
    chip.append(label, body);
    wrap.append(chip);
  });
}

function goNext() {
  state.index += 1;
  if (state.index < state.questions.length) {
    renderQuestion();
    window.scrollTo(0, 0);
  } else {
    showResult();
  }
}

function showResult() {
  const total = state.questions.length;
  $('result-score').textContent = `${total}問中 ${state.correctCount}問正解`;
  const list = $('missed-list');
  list.replaceChildren();
  state.missed.forEach(({ question, chosen }) => {
    const li = document.createElement('li');
    const sentence = document.createElement('p');
    sentence.lang = 'en';
    renderSentence(sentence, question.text, question.target);
    const detail = document.createElement('p');
    detail.className = 'missed-detail';
    detail.textContent = `あなた: ${patternText(chosen)} → 答え: ${patternText(question.answer)}`;
    li.append(sentence, detail);
    list.append(li);
  });
  $('missed-heading').hidden = state.missed.length === 0;
  showScreen('result');
}

function renderAnswerRadios() {
  const wrap = $('input-answer');
  PATTERNS.forEach((p) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(p.n);
    label.append(input, ` ${p.label}（${p.form}）`);
    wrap.append(label);
  });
}

function openRegister() {
  $('register-message').textContent = '';
  renderUserList();
  showScreen('register');
}

function handleRegisterSubmit(event) {
  event.preventDefault();
  const text = $('input-text').value.trim();
  const target = $('input-target').value.trim();
  const checked = document.querySelector('input[name="answer"]:checked');
  const message = $('register-message');

  if (!text) { message.textContent = '英文を入力してください。'; return; }
  if (!checked) { message.textContent = '正解の文型を選んでください。'; return; }
  // 一致しないと出題時に色がつかず、どこを判定するのか分からなくなるため登録前に止める
  if (target && !text.includes(target)) {
    message.textContent = '「判定する部分」が英文の中に見つかりません。英文からそのままコピーしてください。';
    return;
  }

  const saved = addUserQuestion({
    text,
    target,
    answer: Number(checked.value),
    explanation: $('input-explanation').value.trim(),
    source: $('input-source').value.trim()
  });
  message.textContent = saved ? '登録しました。' : '保存できませんでした（プライベートブラウズでは保存できません）。';
  if (saved) {
    $('register-form').reset();
    renderUserList();
  }
}

function renderUserList() {
  const list = $('user-list');
  list.replaceChildren();
  const questions = loadUserQuestions();
  if (questions.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'まだありません。';
    list.append(li);
    return;
  }
  questions.forEach((q) => list.append(createUserListItem(q)));
}

function createUserListItem(q) {
  const li = document.createElement('li');
  const sentence = document.createElement('p');
  sentence.lang = 'en';
  renderSentence(sentence, q.text, q.target);
  const meta = document.createElement('p');
  meta.className = 'missed-detail';
  meta.textContent = `答え: ${patternText(q.answer)}${q.source ? `　出典: ${q.source}` : ''}`;
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'button small danger';
  del.textContent = '削除';
  del.addEventListener('click', () => {
    if (!window.confirm('この英文を削除しますか？')) return;
    removeUserQuestion(q.id);
    renderUserList();
  });
  li.append(sentence, meta, del);
  return li;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
