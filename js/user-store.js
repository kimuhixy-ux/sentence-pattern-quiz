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

export function addUserQuestion({ text, target, answer, explanation, source }) {
  const list = loadUserQuestions();
  list.push({
    id: `user-${Date.now()}`,
    text,
    target,
    answer,
    parts: [],
    point: '',
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
