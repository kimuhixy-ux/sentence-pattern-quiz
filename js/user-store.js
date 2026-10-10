// 自分で登録した英文を端末の localStorage に保存する。
// 収録問題（data/questions.json）と同じ形にそろえ、クイズ側で区別なく扱えるようにしている。

const STORAGE_KEY = 'sentence-pattern-quiz:user-questions';

export function loadUserQuestions() {
  // プライベートブラウズ等で localStorage が使えない場合も、アプリ自体は動かしたい
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveUserQuestions(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addUserQuestion({ text, target, answer, translation, explanation, source }) {
  const list = loadUserQuestions();
  list.push({
    id: `user-${Date.now()}`,
    text,
    target,
    answer,
    parts: [],
    point: '',
    translation,
    explanation,
    source,
    isUser: true
  });
  return saveUserQuestions(list);
}

export function removeUserQuestion(id) {
  const list = loadUserQuestions().filter((q) => q.id !== id);
  return saveUserQuestions(list);
}

// 単語帳アプリへ送る単語の候補。単語帳は別アプリなので、ここにためてからまとめてコピーで渡す
const WORDS_KEY = 'sentence-pattern-quiz:picked-words';

export function loadPickedWords() {
  try {
    const raw = localStorage.getItem(WORDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePickedWords(list) {
  try {
    localStorage.setItem(WORDS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// 同じ単語を二度タップしたら取り消しにする。大文字小文字の違いは同じ単語とみなす
export function togglePickedWord({ word, sentence, translation, source }) {
  const list = loadPickedWords();
  const key = word.toLowerCase();
  const index = list.findIndex((w) => w.word.toLowerCase() === key);
  if (index >= 0) {
    list.splice(index, 1);
  } else {
    list.push({ word, sentence, translation, source });
  }
  savePickedWords(list);
  return index < 0;
}

export function clearPickedWords() {
  return savePickedWords([]);
}
