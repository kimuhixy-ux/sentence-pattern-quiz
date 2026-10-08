// 登録する英文の文型・和訳・解説を Claude API で自動判定する。
// 静的サイトでサーバーを持たないため、ブラウザから直接 API を呼ぶ。
// API キーはコードに書かず、利用者が自分の端末の localStorage にだけ保存する。

const API_KEY_STORAGE_KEY = 'sentence-pattern-quiz:anthropic-api-key';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5-5';

// 収録問題と同じ「日本の学校文法」の基準で判定させ、問題ごとに判定がぶれないようにする
const SYSTEM_PROMPT = `あなたは日本の高校で英文法を教える教師です。与えられた英文の主節の文型を、日本の学校文法の5文型で判定してください。
判定の基準:
- 従属節・関係詞節・分詞構文・不定詞句の中の文型ではなく、主節の文型で答える。主節が複数あれば最初の主節で答える。
- There + be は第1文型（SV）。
- 受動態は第1文型（SV）。ただし SVOC の受動態（She was made awkward など）は第2文型（SVC）。
- tell / allow / want / cause O to do、make / let / see O do は第5文型（SVOC）。
- give A to B のように前置詞で人を示す形は第3文型（SVO）。
- 仮目的語 it を使う think it ~ to do / that ~ は第5文型（SVOC）。仮主語 It is ~ to do は第2文型（SVC）。
- think of、listen to など自動詞＋前置詞は第1文型（SV）。
- 強調構文は元の文に戻して判定する。
出力は次の JSON だけにしてください。前後に説明文やコードブロックをつけないこと。
{"answer": 1から5の整数, "translation": "自然な日本語訳", "explanation": "主節のS・V・O・Cがどの語句かと、そう判定した理由。引っかけになりやすい従属節があれば触れる。200字程度"}`;

export function loadApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// 失敗の理由を利用者が対処できる言葉に置きかえる
function errorMessageFor(status) {
  if (status === 401) return 'API キーが正しくないようです。設定を確認してください。';
  if (status === 402 || status === 403) return 'API キーにこの操作の権限がないか、残高が足りないようです。';
  if (status === 429 || status === 529) return 'API が混み合っています。少し待ってからもう一度押してください。';
  return `判定に失敗しました（エラー ${status}）。`;
}

// モデルが前後に余計な文字をつけても読めるよう、最初の { から最後の } までを取り出す
function parseJudgement(rawText) {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('判定結果を読み取れませんでした。もう一度押してください。');
  let data;
  try {
    data = JSON.parse(rawText.slice(start, end + 1));
  } catch {
    throw new Error('判定結果を読み取れませんでした。もう一度押してください。');
  }
  const answer = Number(data.answer);
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) {
    throw new Error('判定結果の文型が読み取れませんでした。もう一度押してください。');
  }
  return {
    answer,
    translation: String(data.translation || ''),
    explanation: String(data.explanation || '')
  };
}

export async function judgeSentence(text, apiKey) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // ブラウザからの直接呼び出しは明示的に許可しないと拒否される
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }]
      })
    });
  } catch {
    throw new Error('通信できませんでした。電波の状態を確認してください。');
  }
  if (!res.ok) throw new Error(errorMessageFor(res.status));
  const body = await res.json();
  const rawText = (body.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return parseJudgement(rawText);
}
