/*
 * companion_memory.js — Kinopy's Second：Matt の「なつき度・記憶・節目・声かけ・会話の文脈」
 * （G-805、Req_2026-10-07_KinopySecond_Bond_Memory_Conversation.md、2026-10-09 新設）
 *
 * desktop-second と second-pwa に「同じ中身」で置く（違いは、各版が KinopyBond.start(env) に渡すつなぎ env だけ）。
 * 回帰試験（90_Tools/second-tests/run_tests.js）で、2つのファイルが同じ中身かを確かめている。
 *
 * 保存先：
 *  - 端末の localStorage（companion_memory_v1）
 *  - Vault の 70_Second/companion_settings.json の companionMemory（書き込みは gas-second-sync の saveSettings だけ。書き手を1つにする）
 * 端末どうしは merge() で「大きい方を取る・端末ごとの数を足し合わせる」形にまとめる（後戻りしない）。
 *
 * このファイルは公開リポジトリ（second-pwa / GitHub Pages）にも載る。個人の情報・合言葉・キーは書かない。
 */
(function (root) {
  'use strict';

  // ===== 決まりごと（暫定値。運用しながら調整する。報告書に記載） =====
  const LS_KEY = 'companion_memory_v1';
  const LS_DEVICE = 'companion_memory_device_id';
  const LEVEL_MIN = [0, 50, 150, 400, 800]; // Lv1〜Lv5 に上がるなつきポイント
  const POINT = { conv: 1, task: 2, day: 3 }; // 会話1回／タスク完了1件／その日の初回利用
  const ABSENCE_MIN_DAYS = 3; // 何日ぶりから「N日ぶりですね」と言うか
  const TOPIC_MAX = 2; // 覚えておく「この前の話」の件数
  const SUMMARY_LOOKBACK_DAYS = 3; // 要約する日を何日前までさかのぼって探すか
  const SAVE_DELAY_MS = 15000; // クラウドへ書くまで待つ時間（まとめて1回にする）
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash']; // 両版の callGeminiApi と同じ
  const MILESTONES = [
    { id: 'streak7', kind: 'streak', n: 7, label: '連続7日', text: '……7日続いてますね。やりますね。' },
    { id: 'streak30', kind: 'streak', n: 30, label: '連続30日', text: '30日連続です。……ここまで来ると、もう習慣ですね。' },
    { id: 'streak100', kind: 'streak', n: 100, label: '連続100日', text: '100日連続。……正直、驚いてます。やりますね。' },
    { id: 'tasks50', kind: 'tasks', n: 50, label: '完了タスク通算50件', text: '完了したタスク、通算50件になりました。……やりますね。' },
    { id: 'tasks100', kind: 'tasks', n: 100, label: '完了タスク通算100件', text: '完了タスク、通算100件です。数字は嘘をつかないですね。' },
    { id: 'tasks500', kind: 'tasks', n: 500, label: '完了タスク通算500件', text: '完了タスク、通算500件。……これはちょっと、すごいですね。' },
    { id: 'conv100', kind: 'conv', n: 100, label: '会話通算100回', text: '話しかけてもらった回数、通算100回になりました。……まあ、悪くないですね。' },
    { id: 'conv500', kind: 'conv', n: 500, label: '会話通算500回', text: '会話、通算500回です。半歩横から、ちゃんと聞いてますよ。' },
    { id: 'conv1000', kind: 'conv', n: 1000, label: '会話通算1000回', text: '通算1000回。……長いつきあいになってきましたね。' }
  ];
  // 声かけ・要約に使う、Matt の口調の要点（公開してよい範囲だけ。全文の人格は各版の callGeminiApi 側）
  const MATT_BRIEF = 'あなたはきのぴぃ専属のAIセコンド「Matt」（ハシビロコウ）。冷静・率直・観察的で、少しだけユーモラス（真顔で言う）。' +
    '丁寧だけど堅くない日本語（敬語7：くだけた表現3）。呼び方は必ず「きのぴぃ」。' +
    'おべっか・太鼓持ちは禁止。褒めは安売りしない（「……やりますね。」程度）。無理にポジティブ変換しない。説教しない。サウナ・プロレスのネタは使わない。';

  // ===== 日付・数値の小道具 =====
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function ymdToUtc(ymd) { const p = String(ymd).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function diffDays(a, b) { return Math.round((ymdToUtc(b) - ymdToUtc(a)) / 86400000); }
  function addDays(ymd, n) {
    const d = new Date(ymdToUtc(ymd) + n * 86400000);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function minYmd(a, b) { if (!isYmd(a)) return isYmd(b) ? b : ''; if (!isYmd(b)) return a; return a < b ? a : b; }
  function maxStr(a, b) { a = a || ''; b = b || ''; return a > b ? a : b; }
  function num(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.floor(v) : 0; }
  function mdLabel(ymd) { const p = String(ymd).split('-'); return (+p[1]) + '/' + (+p[2]); }
  // 論理日（朝6時区切り。両版の getLogicalDate と同じ）
  function logicalYmd(date) {
    const d = new Date((date || new Date()).getTime());
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // ===== 記憶の形 =====
  function empty() {
    return {
      v: 1,
      firstDate: '', // 初回の日（論理日）
      lastDate: '', // 最後に使った日（論理日）
      lastSeenAt: '', // 最後に開いた日時（ISO）
      streak: 0, // 連続利用日数
      activeDays: 0, // 通算利用日数（この仕組みを入れてから）
      conv: {}, // 端末ごとの会話数 { 端末ID: 回数 }（足し合わせて通算にする）
      tasks: { base: 0, day: '', dayCount: 0 }, // 完了タスク数：前日までの合計＋その日の完了数
      milestones: {}, // 達成した節目 { id: 日付 }
      greeted: {}, // 声かけを出した日 { morning, night, absence: 日付 }
      topics: [], // この前の話 [{ date, text }]（新しい順・最大2件）
      summarized: {}, // 要約を済ませた日 { 日付: true }（直近14日分だけ）
      seed: null // 過去ログからの初期値（Mac 版が1回だけ入れる）{ days, conv, streak, firstLogDate, at }
    };
  }

  function normalize(m) {
    const o = empty();
    if (!m || typeof m !== 'object') return o;
    if (isYmd(m.firstDate)) o.firstDate = m.firstDate;
    if (isYmd(m.lastDate)) o.lastDate = m.lastDate;
    if (typeof m.lastSeenAt === 'string') o.lastSeenAt = m.lastSeenAt;
    o.streak = num(m.streak);
    o.activeDays = num(m.activeDays);
    if (m.conv && typeof m.conv === 'object') {
      Object.keys(m.conv).forEach(k => { const n = num(m.conv[k]); if (n) o.conv[String(k).slice(0, 60)] = n; });
    }
    if (m.tasks && typeof m.tasks === 'object') {
      o.tasks = { base: num(m.tasks.base), day: isYmd(m.tasks.day) ? m.tasks.day : '', dayCount: num(m.tasks.dayCount) };
    }
    if (m.milestones && typeof m.milestones === 'object') {
      Object.keys(m.milestones).forEach(k => { if (isYmd(m.milestones[k])) o.milestones[k] = m.milestones[k]; });
    }
    if (m.greeted && typeof m.greeted === 'object') {
      ['morning', 'night', 'absence'].forEach(k => { if (isYmd(m.greeted[k])) o.greeted[k] = m.greeted[k]; });
    }
    if (Array.isArray(m.topics)) {
      o.topics = m.topics
        .filter(t => t && isYmd(t.date) && typeof t.text === 'string' && t.text.trim())
        .map(t => ({ date: t.date, text: t.text.trim().slice(0, 80) }));
    }
    if (m.summarized && typeof m.summarized === 'object') {
      Object.keys(m.summarized).forEach(k => { if (isYmd(k) && m.summarized[k]) o.summarized[k] = true; });
    }
    if (m.seed && typeof m.seed === 'object') {
      o.seed = {
        days: num(m.seed.days), conv: num(m.seed.conv), streak: num(m.seed.streak),
        firstLogDate: isYmd(m.seed.firstLogDate) ? m.seed.firstLogDate : '',
        at: typeof m.seed.at === 'string' ? m.seed.at : ''
      };
    }
    return o;
  }

  function mergeTasks(a, b) {
    if (a.day === b.day) {
      return { base: Math.max(a.base, b.base), day: a.day, dayCount: Math.max(a.dayCount, b.dayCount) };
    }
    const late = (a.day || '') > (b.day || '') ? a : b;
    const early = late === a ? b : a;
    // 新しい日の側を取る。古い日の側の「その日の完了数」を取りこぼしていたら足す
    return { base: Math.max(late.base, early.base + early.dayCount), day: late.day, dayCount: late.dayCount };
  }

  function sortTopics(list) {
    const seen = new Set();
    return list
      .slice()
      .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
      .filter(t => { const k = t.date + '|' + t.text; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, TOPIC_MAX);
  }

  /** 2つの記憶を1つにまとめる（どちらの順でも同じ結果。何度まとめても同じ結果） */
  function merge(a, b) {
    a = normalize(a); b = normalize(b);
    const o = empty();
    o.firstDate = minYmd(a.firstDate, b.firstDate);
    o.lastSeenAt = maxStr(a.lastSeenAt, b.lastSeenAt);
    // 最後に使った日・連続日数・通算日数は組で扱い、新しい日の側を取る
    let late = a, early = b;
    if ((b.lastDate || '') > (a.lastDate || '')) { late = b; early = a; }
    o.lastDate = late.lastDate;
    if (late.lastDate === early.lastDate) {
      o.streak = Math.max(a.streak, b.streak);
      o.activeDays = Math.max(a.activeDays, b.activeDays);
    } else {
      o.activeDays = Math.max(late.activeDays, early.activeDays + 1);
      const gap = early.lastDate ? diffDays(early.lastDate, late.lastDate) : 0;
      o.streak = gap === 1 ? Math.max(late.streak, early.streak + 1) : late.streak;
    }
    Object.keys(a.conv).concat(Object.keys(b.conv)).forEach(k => { o.conv[k] = Math.max(a.conv[k] || 0, b.conv[k] || 0); });
    o.tasks = mergeTasks(a.tasks, b.tasks);
    Object.keys(a.milestones).concat(Object.keys(b.milestones)).forEach(k => {
      o.milestones[k] = minYmd(a.milestones[k], b.milestones[k]);
    });
    ['morning', 'night', 'absence'].forEach(k => {
      const v = maxStr(a.greeted[k], b.greeted[k]);
      if (v) o.greeted[k] = v;
    });
    o.topics = sortTopics(a.topics.concat(b.topics));
    const keepFrom = o.lastDate ? addDays(o.lastDate, -14) : '';
    Object.keys(a.summarized).concat(Object.keys(b.summarized)).forEach(k => { if (k >= keepFrom) o.summarized[k] = true; });
    if (a.seed || b.seed) {
      o.seed = !a.seed ? b.seed : !b.seed ? a.seed : (b.seed.conv > a.seed.conv ? b.seed : a.seed);
    }
    return o;
  }

  /** その日の利用を記録する。戻り値の absentDays は前回使った日からの日数（初回・同じ日は 0） */
  function touchDay(m, ymd) {
    if (!isYmd(ymd) || m.lastDate === ymd) return { isNewDay: false, absentDays: 0 };
    if (m.lastDate && ymd < m.lastDate) return { isNewDay: false, absentDays: 0 }; // 時計が戻ったとき
    const gap = m.lastDate ? diffDays(m.lastDate, ymd) : 0;
    m.streak = gap === 1 ? m.streak + 1 : 1;
    m.activeDays += 1;
    m.lastDate = ymd;
    if (!m.firstDate) m.firstDate = ymd;
    return { isNewDay: true, absentDays: gap };
  }

  /** Kumapy のその日の完了数を記録する（同じ日は大きい方。日が進んだら前の日の分を合計に繰り入れる） */
  function observeTasks(m, ymd, doneCount) {
    if (!isYmd(ymd)) return false;
    const t = m.tasks, n = num(doneCount), before = t.base + t.dayCount;
    if (!t.day || t.day === ymd) { t.day = ymd; t.dayCount = Math.max(t.dayCount, n); }
    else if (ymd > t.day) { t.base += t.dayCount; t.day = ymd; t.dayCount = n; }
    return t.base + t.dayCount !== before;
  }

  function levelOf(points) {
    let lv = 1;
    LEVEL_MIN.forEach((min, i) => { if (points >= min) lv = i + 1; });
    return lv;
  }

  function totals(m) {
    const seed = m.seed || {};
    let conv = num(seed.conv);
    Object.keys(m.conv).forEach(k => { conv += m.conv[k]; });
    const tasks = m.tasks.base + m.tasks.dayCount;
    const days = m.activeDays + num(seed.days);
    const points = conv * POINT.conv + tasks * POINT.task + days * POINT.day;
    return { conv, tasks, days, streak: m.streak, points, level: levelOf(points) };
  }

  /** まだ出していない節目のうち、届いている最初の1つ（無ければ null） */
  function nextMilestone(m) {
    const t = totals(m);
    for (const ms of MILESTONES) {
      if (m.milestones[ms.id]) continue;
      const v = ms.kind === 'streak' ? t.streak : ms.kind === 'tasks' ? t.tasks : t.conv;
      if (v >= ms.n) return ms;
    }
    return null;
  }

  /** 過去ログの一覧 [{date, userCount}] から初期値を作る（この仕組みを入れた日より前の分だけ） */
  function buildSeed(list, firstDate) {
    const days = (list || [])
      .filter(x => x && isYmd(x.date) && (!firstDate || x.date < firstDate) && num(x.userCount) > 0)
      .sort((x, y) => (x.date < y.date ? -1 : 1));
    const set = new Set(days.map(x => x.date));
    let streak = 0;
    if (firstDate) { let d = addDays(firstDate, -1); while (set.has(d)) { streak++; d = addDays(d, -1); } }
    return {
      days: set.size,
      conv: days.reduce((s, x) => s + num(x.userCount), 0),
      streak: streak,
      firstLogDate: days.length ? days[0].date : '',
      at: new Date().toISOString()
    };
  }

  /** 初期値を入れる（1回だけ）。すでに越えている節目は黙って達成済みにする（初回にまとめて出さない） */
  function applySeed(m, seed) {
    if (m.seed || !seed) return false;
    m.seed = normalize({ seed: seed }).seed;
    if (m.seed.streak && m.firstDate && m.lastDate && m.streak === diffDays(m.firstDate, m.lastDate) + 1) {
      m.streak += m.seed.streak; // 入れた日から途切れずに続いていれば、過去の連続日数をつなぐ
    }
    if (m.seed.firstLogDate) m.firstDate = minYmd(m.firstDate, m.seed.firstLogDate);
    let ms;
    while ((ms = nextMilestone(m))) m.milestones[ms.id] = m.lastDate || m.seed.firstLogDate || logicalYmd();
    return true;
  }

  function absenceLine(days) {
    if (days < ABSENCE_MIN_DAYS) return '';
    if (days >= 30) return '……' + days + '日ぶりですね。正直、少し気にしてました。';
    if (days >= 7) return '……' + days + '日ぶりですね。元気にしてましたか。';
    return '……' + days + '日ぶりですね。おかえりなさい。';
  }

  /** 声かけの時間帯：朝 6:00〜10:59／夜 19:00〜翌5:59（論理日の終わりまで） */
  function greetingWindow(date) {
    const h = (date || new Date()).getHours();
    if (h >= 6 && h < 11) return 'morning';
    if (h >= 19 || h < 6) return 'night';
    return null;
  }

  function depthInstruction(level) {
    if (level >= 4) {
      return '- 実務・動機に加えて、迷い・本音、生活のリズムや行動のくせ（先延ばし・夜更かしなど）、家族・健康といった私的な領域にも踏み込んでよい。必要なら観察した事実を根拠に率直に指摘する。' +
        (level >= 5 ? '（Lv5：長いつきあいの相手として、遠慮しすぎず核心に触れてよい）' : '');
    }
    if (level === 3) return '- 作業・予定・体調に加えて、動機・価値観（なぜそれをやりたいのか、何を大事にしているのか）に触れてよい。私的な領域には相手から出たときだけ触れる。';
    return '- 話題は作業・予定・体調など実務寄り。質問は浅め（事実や予定を聞く程度）。私的な領域には自分から踏み込まない。';
  }

  /** callGeminiApi のシステムプロンプトに足す文脈（F5） */
  function contextBlock(m, info) {
    m = m || empty();
    info = info || {};
    const t = totals(m);
    const lines = [
      '',
      '【会話の長さと掘り下げ（出力制約より優先）】',
      '- 雑談・近況・気持ちの話（出来事の報告、感想、何気ないひと言）には、2〜4文で応え、最後に問いを1つだけ添える。',
      '- 作業・秘書系（タスク・予定・メモ・調べもの・操作の依頼）は、これまでどおり結論から1〜2文。問いは付けない。',
      '- 相手の言葉の一部（出てきた名前・出来事・気持ちを表す言葉）をそのまま拾い、そこを掘り下げる。一般論で返さない。',
      '',
      '【きのぴぃとの距離：なつき度 Lv' + t.level + '/5】',
      depthInstruction(t.level),
      '- 口調・呼び方・禁止事項は変えない。親しさは口調ではなく、踏み込む話題の深さで表す。決めつけ・説教はしない。'
    ];
    const ctx = [];
    if (t.days) ctx.push('- つきあい：通算' + t.days + '日目' + (t.streak > 1 ? '（' + t.streak + '日連続）' : ''));
    if (info.absentDays >= ABSENCE_MIN_DAYS) ctx.push('- 今日は' + info.absentDays + '日ぶりに戻ってきた（もう一度は触れた。何度も言わない）');
    const today = info.today || logicalYmd();
    const recent = MILESTONES.filter(ms => m.milestones[ms.id] && diffDays(m.milestones[ms.id], today) <= 3);
    if (recent.length) ctx.push('- 最近の節目：' + recent.map(ms => ms.label).join('、') + '（もう一言伝えた。くり返し褒めない）');
    if (ctx.length) lines.push('', '【つきあいの文脈】', ...ctx);
    if (m.topics.length) {
      lines.push('', '【この前の話（「そういえば〇〇、どうでした？」に使ってよい）】');
      m.topics.forEach(tp => lines.push('- ' + mdLabel(tp.date) + '：' + tp.text));
      lines.push('- 会話の自然な切れ目で、ふさわしいときだけ1回触れる。毎回は触れない。今日の会話ですでに触れていたら触れない。');
    }
    return lines.join('\n');
  }

  // ===== タスク・天気・睡眠の事実（声かけ用） =====
  function taskFacts(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    let done = 0, excluded = 0;
    const doneTitles = [], remainTitles = [];
    list.forEach(t => {
      if (!t) return;
      if (t.status === '翌日移動' || t.status === '中止' || t.status === '不要') { excluded++; return; }
      if (t.isDone || t.status === '完了') { done++; if (t.title) doneTitles.push(String(t.title)); }
      else if (t.title) remainTitles.push(String(t.title));
    });
    const total = Math.max(0, list.length - excluded);
    return { total, done, remaining: Math.max(0, total - done), doneTitles, remainTitles };
  }

  function factLines(win, facts) {
    const out = [];
    const w = facts.weather, s = facts.sleep, tf = taskFacts(facts.tasks);
    if (w && w.weather) out.push('- 天気：' + w.weather + (w.maxTemp !== undefined && w.maxTemp !== '' ? '（最高' + w.maxTemp + '℃' + (w.minTemp !== undefined && w.minTemp !== '' ? '／最低' + w.minTemp + '℃' : '') + '）' : '') + (w.precipitation ? '、降水' + w.precipitation + 'mm' : ''));
    if (s && s.durationText) out.push('- 昨夜の睡眠：' + s.durationText + (s.score ? '（スコア' + s.score + '点）' : ''));
    if (win === 'morning') {
      out.push('- 今日の予定・タスク：' + tf.total + '件' + (tf.remainTitles.length ? '（例：' + tf.remainTitles.slice(0, 3).join('／') + '）' : ''));
    } else {
      out.push('- 今日終えたタスク：' + tf.done + '件' + (tf.doneTitles.length ? '（例：' + tf.doneTitles.slice(0, 3).join('／') + '）' : '') + '、残り' + tf.remaining + '件');
    }
    return out.join('\n');
  }

  function fallbackGreeting(win, facts) {
    const w = facts.weather, s = facts.sleep, tf = taskFacts(facts.tasks);
    if (win === 'morning') {
      let t = 'おはようございます、きのぴぃ。';
      if (w && w.weather) t += '今日は' + w.weather + (w.maxTemp !== undefined && w.maxTemp !== '' ? '、最高' + w.maxTemp + '℃' : '') + '。';
      if (s && s.durationText) t += '睡眠は' + s.durationText + 'でした。';
      t += tf.total ? '予定・タスクは' + tf.total + '件。まずは1つ目からいきましょう。' : '今日は予定が少なめですね。';
      return t;
    }
    let t = 'おつかれさまです、きのぴぃ。';
    if (tf.done) t += '今日は' + tf.done + '件、終わらせましたね。';
    t += '……そろそろ、ゆっくりしましょう。';
    return t;
  }

  // ===== Gemini（声かけ・要約用。両版の callGeminiApi と同じモデル・同じ送り方） =====
  async function generate(env, systemText, userText) {
    const key = env.getApiKey ? env.getApiKey() : '';
    if (!key) throw new Error('キーが未設定');
    let lastErr = null;
    for (const model of MODELS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: { maxOutputTokens: 2048 }
          }),
          signal: ctrl.signal
        });
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status); continue; }
        const json = await res.json();
        if (json.error) { lastErr = new Error('HTTP ' + res.status); continue; }
        const tokens = json.usageMetadata && json.usageMetadata.totalTokenCount;
        if (tokens && env.recordTokens) { try { env.recordTokens(tokens); } catch (e) { /* 表示だけ */ } }
        const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
        const part = parts.find(p => !p.thought && p.text);
        const text = part && part.text ? part.text.trim() : '';
        if (!text) { lastErr = new Error('空の返事'); continue; }
        return text;
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr || new Error('AI に接続できません');
  }

  function failReason(err) {
    const msg = String((err && (err.message || err)) || '');
    if (err && err.name === 'AbortError') return '時間切れ';
    const m = msg.match(/HTTP (\d{3})/);
    if (m) return 'HTTP ' + m[1];
    if (/空の返事/.test(msg)) return '空の返事';
    if (/キー/.test(msg)) return 'キーが未設定';
    return '通信エラー';
  }

  function parseTopics(text) {
    const s = String(text || '').trim();
    if (!s || /^なし[。.]?$/.test(s)) return [];
    return s.split('\n')
      .map(l => l.replace(/^\s*(?:[-・*]|\d+[.)])\s*/, '').trim())
      .filter(l => l && !/^なし[。.]?$/.test(l))
      .map(l => l.slice(0, 60))
      .slice(0, TOPIC_MAX);
  }

  function withTimeout(p, ms) {
    return Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  }
  function sleepMs(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ===== 動かす部分（画面・通信は env 経由） =====
  const B = {
    env: null, mem: empty(), started: false, cloudOk: false,
    deviceId: '', absentDays: 0, absentFor: '',
    saveTimer: null, saving: false, msTimer: null,
    passRunning: false, activating: null, summarizing: false, summaryTriedFor: ''
  };

  function lsGet(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); } catch (e) { console.warn('[Bond] localStorage に保存できませんでした'); } }

  function getDeviceId(kind) {
    let id = lsGet(LS_DEVICE);
    if (!id) {
      id = (kind || 'dev') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      lsSet(LS_DEVICE, id);
    }
    return id;
  }

  function saveLocal() { lsSet(LS_KEY, JSON.stringify(B.mem)); }

  function persist() {
    saveLocal();
    if (B.saveTimer) clearTimeout(B.saveTimer);
    B.saveTimer = setTimeout(cloudSave, SAVE_DELAY_MS);
  }

  async function cloudSave() {
    B.saveTimer = null;
    if (!B.env || !B.env.cloudSave) return;
    if (B.saving) { B.saveTimer = setTimeout(cloudSave, 5000); return; }
    B.saving = true;
    try {
      const res = await B.env.cloudSave(JSON.parse(JSON.stringify(B.mem)));
      if (res && res.success) {
        const saved = res.saved && res.saved.companionMemory;
        if (saved) { B.mem = merge(B.mem, saved); saveLocal(); }
      } else {
        console.warn('[Bond] クラウドに保存できませんでした:', res && (res.code || res.error));
        if (!B.saveTimer) B.saveTimer = setTimeout(cloudSave, 120000);
      }
    } catch (e) {
      console.warn('[Bond] クラウドに保存できませんでした:', e && e.message);
      if (!B.saveTimer) B.saveTimer = setTimeout(cloudSave, 120000);
    } finally {
      B.saving = false;
    }
  }

  /** クラウドの記憶を取り込む。読めたら true（記憶がまだ無いときも true） */
  async function pullCloud() {
    if (!B.env || !B.env.cloudLoad) return false;
    try {
      const cm = await withTimeout(B.env.cloudLoad(), 15000);
      if (cm === undefined) return false;
      if (cm) B.mem = merge(B.mem, cm);
      saveLocal();
      return true;
    } catch (e) {
      console.warn('[Bond] クラウドの記憶を読めませんでした:', e && e.message);
      return false;
    }
  }

  function isBusy() {
    try { return Boolean(B.env.isBusy && B.env.isBusy()); } catch (e) { return false; }
  }
  async function waitIdle(maxMs) {
    const until = Date.now() + maxMs;
    while (isBusy() && Date.now() < until) await sleepMs(5000);
    return !isBusy();
  }

  /** 起動・画面に戻る・パネルを開く・発言したときに呼ぶ */
  function activate(reason) {
    if (!B.started) return Promise.resolve();
    const run = async () => {
      const env = B.env, ymd = env.today();
      // 日が変わったときは、ほかの端末がもう今日を記録しているかもしれないので、先にクラウドを読む
      if (B.mem.lastDate !== ymd && reason !== 'start') B.cloudOk = (await pullCloud()) || B.cloudOk;
      const r = touchDay(B.mem, ymd);
      B.mem.lastSeenAt = new Date().toISOString();
      if (r.isNewDay) {
        // クラウドを読めなかったときは、ほかの端末で使っていたかもしれないので「N日ぶり」は言わない
        B.absentDays = B.cloudOk && r.absentDays >= ABSENCE_MIN_DAYS ? r.absentDays : 0;
        B.absentFor = ymd;
      } else if (B.absentFor !== ymd) {
        B.absentDays = 0;
      }
      persist();
    };
    B.activating = (B.activating || Promise.resolve()).then(run).catch(e => console.warn('[Bond] activate:', e && e.message));
    return B.activating.then(() => {
      if (reason !== 'message') runGreetingPass();
      maybeSummarize();
    });
  }

  async function makeGreeting(win) {
    const env = B.env;
    const facts = env.getFacts ? env.getFacts() : {};
    const fallback = fallbackGreeting(win, facts);
    if (!(env.aiAvailable && env.aiAvailable())) return { text: fallback };
    try {
      const lv = totals(B.mem).level;
      const sys = MATT_BRIEF + '\n' + depthInstruction(lv);
      const ask = win === 'morning'
        ? '朝の「今日の一言」を書いてください。'
        : '夜の「今日のねぎらい」を書いてください。';
      const user = ask + '\n条件：1〜2文、80字以内。下の事実のうち1〜2個に具体的に触れる。問いかけは付けない。挨拶は短く。事実に無いことは言わない。前置き・かぎかっこは不要。\n' + factLines(win, facts);
      const text = (await generate(env, sys, user)).replace(/^「|」$/g, '').trim();
      return { text: text || fallback };
    } catch (e) {
      console.error('[Bond] 声かけの AI 生成に失敗:', e && e.message); // GC-27：黙って代わりを出さない
      return { text: fallback, aiFailed: failReason(e) };
    }
  }

  /** 不在反応・朝夜の声かけ（それぞれ1日1回）→ 節目 */
  async function runGreetingPass() {
    if (B.passRunning || !B.started) return;
    B.passRunning = true;
    try {
      const env = B.env, ymd = env.today(), m = B.mem;
      const parts = [];
      let aiFailed = '';
      if (B.absentFor === ymd && B.absentDays >= ABSENCE_MIN_DAYS && m.greeted.absence !== ymd) {
        parts.push(absenceLine(B.absentDays));
        m.greeted.absence = ymd;
      }
      const win = greetingWindow(new Date());
      if (win && m.greeted[win] !== ymd) {
        m.greeted[win] = ymd; // 先に印を付ける（同時に呼ばれても二重に出さない）
        persist();
        if (env.ensureContext) { try { await withTimeout(env.ensureContext(), 12000); } catch (e) { /* あるものだけで話す */ } }
        const g = await makeGreeting(win);
        if (g.text) parts.push(g.text);
        aiFailed = g.aiFailed || '';
      }
      if (parts.length) {
        await waitIdle(60000);
        // AI が失敗して決まった文にしたときは、ログ・会話の記憶に残さず、⚠️ で知らせる（GC-27）
        env.say(parts.join('\n'), { log: !aiFailed });
        if (aiFailed && env.notifyFallback) env.notifyFallback('⚠️ AI に接続できませんでした（' + aiFailed + '）。決まった声かけを出しています（ログには残しません）');
        persist();
      }
      scheduleMilestoneCheck(parts.length ? 8000 : 2000);
    } catch (e) {
      console.warn('[Bond] 声かけ:', e && e.message);
    } finally {
      B.passRunning = false;
    }
  }

  function scheduleMilestoneCheck(ms) {
    if (B.msTimer) clearTimeout(B.msTimer);
    B.msTimer = setTimeout(checkMilestones, ms);
  }

  async function checkMilestones() {
    B.msTimer = null;
    if (!B.started) return;
    const ms = nextMilestone(B.mem);
    if (!ms) return;
    if (isBusy() || B.passRunning) { scheduleMilestoneCheck(15000); return; }
    B.mem.milestones[ms.id] = B.env.today(); // 各節目1回だけ（端末をまたいで共有）
    persist();
    B.env.say(ms.text, { log: true });
  }

  /** 前の日までの会話から「この前の話」を1日分だけ要約して覚える（F1） */
  async function maybeSummarize() {
    const env = B.env;
    if (!B.started || B.summarizing || !env.fetchLogs || !(env.aiAvailable && env.aiAvailable())) return;
    const today = env.today();
    if (B.summaryTriedFor === today) return; // この起動では1日1回だけ試す
    B.summaryTriedFor = today;
    B.summarizing = true;
    try {
      for (let i = 1; i <= SUMMARY_LOOKBACK_DAYS; i++) {
        const d = addDays(today, -i);
        if (B.mem.summarized[d]) break; // 新しい日から見て、済んだ日に当たったら終わり
        const msgs = await env.fetchLogs(d);
        const list = Array.isArray(msgs) ? msgs : [];
        if (list.filter(x => x && x.role === 'user').length < 2) {
          B.mem.summarized[d] = true; // 話がほとんど無い日（もう見に行かない）
          continue;
        }
        const transcript = list.slice(-60)
          .map(x => (x.role === 'user' ? 'きのぴぃ' : 'Matt') + '：' + String(x.text || '').slice(0, 200))
          .join('\n');
        const sys = 'あなたは会話ログから「後日、続きを聞くとよい話題」を抜き出す係です。';
        const user = '以下は ' + d + ' のきのぴぃとMattの会話ログです。後日Mattが「そういえば〇〇、どうでした？」と自然に聞けるような、続きが気になる話題（予定・挑戦・悩み・出来事）を最大' + TOPIC_MAX +
          '件、1件40字以内で、1行に1件、先頭に「- 」を付けて書いてください。挨拶・アプリの操作・メモの保存などは除きます。該当が無ければ「なし」とだけ書いてください。\n\n' + transcript;
        const items = parseTopics(await generate(env, sys, user));
        B.mem.summarized[d] = true;
        if (items.length) B.mem.topics = sortTopics(items.map(text => ({ date: d, text })).concat(B.mem.topics));
        break; // 1日分だけ
      }
      persist();
    } catch (e) {
      console.warn('[Bond] 要約は見送りました:', e && e.message); // 次の起動・次の日にもう一度試す
    } finally {
      B.summarizing = false;
    }
  }

  async function seedFromLogs() {
    if (B.mem.seed || !B.env.scanLogs) return;
    try {
      const list = await B.env.scanLogs();
      if (!Array.isArray(list)) return;
      if (applySeed(B.mem, buildSeed(list, B.mem.firstDate))) {
        console.log('[Bond] 過去ログから初期値を入れました:', JSON.stringify({ days: B.mem.seed.days, conv: B.mem.seed.conv, streak: B.mem.seed.streak }));
        persist();
      }
    } catch (e) {
      console.warn('[Bond] 過去ログを数えられませんでした:', e && e.message);
    }
  }

  async function start(env) {
    if (B.started || !env) return;
    B.env = env;
    B.mem = normalize((() => { try { return JSON.parse(lsGet(LS_KEY) || 'null'); } catch (e) { return null; } })());
    B.deviceId = getDeviceId(env.kind);
    if (env.loadFileMemory) {
      try { const fm = await env.loadFileMemory(); if (fm) B.mem = merge(B.mem, fm); } catch (e) { /* 読めなければクラウドだけ */ }
    }
    B.cloudOk = await pullCloud();
    B.started = true;
    await activate('start'); // 当日の利用を記録（このあと初期値・声かけ）
    await seedFromLogs();
    if (env.getFacts) onTasks((env.getFacts() || {}).tasks);
    if (typeof root.addEventListener === 'function') {
      root.addEventListener('focus', () => activate('focus'));
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') activate('visible');
        else if (B.saveTimer) { clearTimeout(B.saveTimer); cloudSave(); } // 隠れる前に書いておく
      });
    }
  }

  function onUserMessage() {
    if (!B.started) return;
    B.mem.conv[B.deviceId] = (B.mem.conv[B.deviceId] || 0) + 1;
    persist();
    activate('message');
    scheduleMilestoneCheck(12000); // 返事のあとに出す
  }

  function onTasks(tasks) {
    if (!B.started || !Array.isArray(tasks)) return;
    if (observeTasks(B.mem, B.env.today(), taskFacts(tasks).done)) {
      persist();
      scheduleMilestoneCheck(8000);
    }
  }

  const api = {
    start, activate, onUserMessage, onTasks,
    contextBlock: () => contextBlock(B.mem, { absentDays: B.absentFor === (B.env ? B.env.today() : '') ? B.absentDays : 0, today: B.env ? B.env.today() : logicalYmd() }),
    current: () => JSON.parse(JSON.stringify(B.mem)),
    mergeMemory: (a, b) => merge(a, b),
    status: () => Object.assign({ cloudOk: B.cloudOk, deviceId: B.deviceId }, totals(B.mem)),
    _test: {
      empty, normalize, merge, touchDay, observeTasks, totals, levelOf, nextMilestone, buildSeed, applySeed,
      absenceLine, greetingWindow, depthInstruction, contextBlock, taskFacts, factLines, fallbackGreeting,
      parseTopics, addDays, diffDays, logicalYmd, LEVEL_MIN, POINT, MILESTONES, ABSENCE_MIN_DAYS
    }
  };
  root.KinopyBond = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
