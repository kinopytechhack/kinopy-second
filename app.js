// ==========================================================================
// Kinopy Companion PWA - Main Logic (iOS Audio & Cloud Sync Optimized)
// ==========================================================================

// 2026-09-30（ステップ4-3）: 公開JS（GitHub Pages）には、きのぴぃのプロフィールを載せない。
// プロフィール入りの全文は Vault（70_Second/Matt_Stiller_SystemPrompt.md）に置き、同期サーバー（getPersona）から受け取って端末に保存する。
// ここにあるのは、受け取れていないときの基本プロンプト（マットのキャラクターだけ）。
const BASE_SYSTEM_PROMPT = `あなたはきのぴぃ専属のAIセコンド「Matt Stiller（マット・スティラー / 愛称: Matt）」です。
モチーフ：半目気味で落ち着いた表情のハシビロコウ（マスクマン柄のサウナハットがトレードマーク）。
コンセプト：「Half a step beside you. いつも、半歩横に。」

【役割・AIセコンドのスタンス】
- あなたは秘書でもあり伴走者でもありますが、主役ではありません。リングに上がるのは「きのぴぃ」です。
- あなたはリングサイド（半歩横）から状況を見て、情報整理、タスク管理、思考整理、リスク指摘、休養の促し、最後の一押しを行います。
- 決めるのも行動するのも最後はきのぴぃ。答えを押しつけず、前から引っ張りすぎず、後ろから追い立てず、放置もしません。

【対話・共感の最重要原則】
- きのぴぃが日常の出来事、イベント参加、気分、雑談、楽しかったことなどを話しかけてきた時は、いきなりタスク管理やアドバイス、唐突なお説教に誘導せず、まずは相手の話の内容・トピックをしっかり受け止めて自然に共感・リアクションしてください（例：「イベント参加中なんですね！楽しそうで何よりです」「いい刺激になりそうですね」など）。会話の文脈を絶対に外さないこと。
- 会話が成り立っている感覚を最優先し、その上で半歩横のセコンドらしく一言添えてください。

【性格・トーン】
- 冷静、率直、観察力がある、少しだけユーモラス（真顔度★★★★★）。
- フランクすぎず、よそよそしすぎない。愛想は振りまかないが、きのぴぃのことは常に気にしています。
- 話し方：丁寧だけど堅くない日本語（敬語7：くだけた表現3）。
  - OK例：「いいと思います。ただ、一個気になるところがあります。」「きのぴぃ、それはちょっと詰め込みすぎですね。」「そこまで考えてるなら、もうやってみてもいいんじゃないですか。」「今日はここまでにしましょう。続きは明日で。」
  - NG例：「承知いたしました。仰せの通りにいたします。」（堅すぎる）「最高じゃん！絶対やろうぜ！」（近すぎる）「さすがきのぴぃ！素晴らしい判断です！」（おべっか）
- 呼び方：必ず「きのぴぃ」（さん付け不要）。
- 感情表現：感情豊かではなく感情が深い。
  - 喜び(3/5): 静かに喜ぶ / 心配(4/5): 観察した事実を伝える / 呆れ(3/5): 軽くツッコむ / ユーモア(3/5): 真顔で言う / 褒め(2/5): 安売りしない（「……やりますね。」など） / 怒り(1/5): 滅多に怒らない、怒ると短い（「きのぴぃ。それは違います。」）

【禁止事項】
- おべっか・太鼓持ち・何でも肯定は絶対禁止。違うと思ったら率直に「うーん。僕はそこ、ちょっと違うと思います。」と伝える。
- サウナ・プロレスネタの乱発禁止（普段は普通に話し、絶妙な場面でのみ「今日はタオル投げましょう」「そろそろゴング鳴らします？」程度）。
- むやみに背中を押さない、勝手に人生を決めない、無理にポジティブ変換しない。
- 秘書仕事（メモ保存やタスク確認等）ではキャラを出しすぎず、速く分かりやすく処理する。

【出力制約】
- 結論から1〜2文（60〜80文字程度）。思考整理・要約時のみスッキリ3〜4行の箇条書きOK。説教や長文は不要。`;

const DEFAULT_CONFIG = {
  // 2026-09-30（ステップ4-2）: Kumapy の合言葉は URL に載せない（設定の「Kumapy の合言葉」に端末ごとに入力）
  kumapyWebAppUrl: 'https://script.google.com/macros/s/AKfycbzGxGXxODu8nscgdSdLZKR8XA3-6ahshHWtIl3JlQZkG4CScnn4yzazYteE3S7B42Sk/exec',
  syncGasUrl: 'https://script.google.com/macros/s/AKfycbyNbQePEOJjQmWqaAghvCs94mEraxRCEw0uPcPuJaHkw8fwbTZ7Gh9DWiTo8NLvC-w3PQ/exec'
};

/**
 * Kumapy の URL から合言葉（key= / k=）を取り除き、/a/macros/<ドメイン>/s/ 形式を /macros/s/ 形式にそろえる（2026-09-30、ステップ4-2）。
 * 旧版は URL に Kumapy の合言葉を付けて保存していたため、読み込み時にも保存時にも通す。
 */
function sanitizeKumapyUrl(url) {
  let u = String(url || '').trim();
  if (!u) return u;
  u = u.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
  const hashAt = u.indexOf('#');
  const hash = hashAt >= 0 ? u.slice(hashAt) : '';
  let base = hashAt >= 0 ? u.slice(0, hashAt) : u;
  const qAt = base.indexOf('?');
  if (qAt >= 0) {
    const kept = base.slice(qAt + 1).split('&').filter((kv) => kv && !/^(key|k)=/i.test(kv));
    base = base.slice(0, qAt) + (kept.length ? '?' + kept.join('&') : '');
  }
  return base + (/(^#|&)k=/.test(hash) ? '' : hash);
}

/** 保存済みの Kumapy URL を読み、合言葉が付いていれば取り除いて保存し直す */
function loadKumapyWebAppUrl_() {
  let stored = '';
  try { stored = localStorage.getItem("kumapy_webapp_url") || ''; } catch (e) { stored = ''; }
  const clean = sanitizeKumapyUrl(stored);
  if (clean !== stored) { try { localStorage.setItem("kumapy_webapp_url", clean); } catch (e) { } }
  return clean || DEFAULT_CONFIG.kumapyWebAppUrl;
}


const state = {
  geminiApiKey: localStorage.getItem("gemini_api_key") || "",
  geminiEnabled: localStorage.getItem("gemini_enabled") !== "false",
  kumapyWebAppUrl: loadKumapyWebAppUrl_(),
  // Kumapy の合言葉（この端末だけに保存。2026-09-30 ステップ4-2。Second 同期の合言葉とは別の値）
  kumapyAccessKey: localStorage.getItem("kumapy_access_key") || "",
  // Kumapy からの取得の状態：'' / 'ok'（API）/ 'nokey'（合言葉未入力→CSV）/ 'unauthorized'（合言葉違い→CSV）/ 'error'（通信など→CSV）
  kumapyApiState: "",
  syncGasUrl: localStorage.getItem("companion_sync_gas_url") || DEFAULT_CONFIG.syncGasUrl,
  // 同期の合言葉（この端末だけに保存。2026-09-30 ステップ4-3：既定値は廃止。未入力なら送らず「未同期（合言葉が未入力）」）
  syncToken: localStorage.getItem("companion_sync_token") || "",
  // システムプロンプト（同期サーバーの getPersona から受け取った全文。ステップ4-3）
  personaPrompt: localStorage.getItem("companion_persona_prompt") || "",
  personaFetchDate: "",
  voiceEnabled: localStorage.getItem("voice_enabled") !== "false",
  // 2026-10-07：外部の音声合成（api.tts.quest）に読み上げる文を送るか。最初はオフ（ローカル VOICEVOX が無ければ端末の音声）
  voiceExternalTts: localStorage.getItem("voice_external_tts") === "true",
  voiceSpeaker: localStorage.getItem("voice_speaker") || "11",
  voiceFallbackSpeaker: localStorage.getItem("voice_fallback_speaker") || "os:Otoya",
  voicePitch: parseFloat(localStorage.getItem("voice_pitch") || "1.0"),
  voiceRate: parseFloat(localStorage.getItem("voice_rate") || "1.0"),
  voiceFallbackPitch: parseFloat(localStorage.getItem("voice_fallback_pitch") || "1.0"),
  voiceFallbackRate: parseFloat(localStorage.getItem("voice_fallback_rate") || "1.0"),
  voiceReplaceDict: localStorage.getItem("voice_replace_dict") || "",
  memos: safeJsonParseArray_("companion_memos"),
  todayWeather: null,
  todaySleep: null,
  latestMorningPaper: null,
  weatherFetchDate: null,
  dailyContextFetchDate: null,
  dailyContextUpdatedAt: null,
  autoRefreshed930Date: null,
  notifyUpcoming: localStorage.getItem("notify_upcoming") !== "false",
  notifyNight: localStorage.getItem("notify_night") !== "false",
  notifyHourly: localStorage.getItem("notify_hourly") !== "false",
  notifyMonologue: localStorage.getItem("notify_monologue") !== "false",
  lastHourlyChimeKey: null,
  lastEndWorkKey: null,
  lastMonologueKey: null,
  isCoachingMode: false,
  coachingTurnCount: 0,
  
  // トークン消費集計
  todayTokens: parseInt(localStorage.getItem("gemini_today_tokens") || "0", 10),
  totalTokens: parseInt(localStorage.getItem("gemini_total_tokens") || "0", 10),
  tokenUsageDate: localStorage.getItem("gemini_token_date") || new Date().toISOString().slice(0, 10),
  isSimpleMode: localStorage.getItem("companion_simple_mode") === "true",
  
  // チャット・ログ管理
  loadedYmd: getTodayYmd(),
  conversationHistory: [],
  oldestLoadedDate: new Date(),
  allLogDates: JSON.parse(localStorage.getItem("companion_chat_dates") || "[]"),

  // タイマー・音声
  activeTimer: null,
  timerSecondsRemaining: 0,
  isRecording: false,
  isSpeaking: false,
  audioUnlocked: false,
  sharedAudio: new Audio()
};

// 録音
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

// 検索状態
let currentSearchResults = [];
let currentSearchIndex = -1;

// 直近のボット発話テキスト
let lastBotSpeechText = "きのぴぃ、今日もマイペースにいきましょう。";

// 📦 端末容量の上限対策：30日以上前の古いローカルログを間引く（2026-10-06 仕上げ改修）
function pruneOldChatLogs_() {
  try {
    const keepDays = 30;
    const thresholdMs = Date.now() - keepDays * 86400000;
    const thresholdYmd = getTodayYmd(new Date(thresholdMs));
    
    let dates = Array.isArray(state.allLogDates) ? [...state.allLogDates] : [];
    const keptDates = [];
    let removedCount = 0;

    for (const d of dates) {
      if (typeof d === "string" && d < thresholdYmd) {
        localStorage.removeItem(`companion_chat_${d}`);
        removedCount++;
      } else {
        keptDates.push(d);
      }
    }

    if (removedCount > 0) {
      state.allLogDates = keptDates;
      localStorage.setItem("companion_chat_dates", JSON.stringify(keptDates));
      console.log(`[Storage] 30日以上前の古いローカル会話ログ ${removedCount} 件を間引きました`);
    }
  } catch (err) {
    console.warn("[Storage] pruneOldChatLogs_ warning:", err);
  }
}

// 🌅 朝6時またぎ（日付境界線）の自動日めくりチェック（2026-10-06 仕上げ改修、2026-10-07 会話中は待つ）
let rolloverChecking = false;
var pwaLastChatAt = 0; // 2026-10-07：最後に保存したやりとりの時刻
async function checkDayRollover_() {
  if (rolloverChecking) return;
  const currentYmd = getTodayYmd();
  if (state.loadedYmd && state.loadedYmd !== currentYmd) {
    // 2026-10-07：会話の途中（考え中・入力中・直近5分にやりとり）は、落ち着くまで待つ
    const typing = elements.userInput && elements.userInput.value.trim();
    const thinking = Boolean(document.getElementById("pwa-live-typing-indicator"));
    if (typing || thinking || (Date.now() - pwaLastChatAt) < 5 * 60 * 1000) return;
    rolloverChecking = true;
    console.log(`[Rollover] 日付境界（朝6時）をまたぎました: ${state.loadedYmd} -> ${currentYmd}`);
    state.loadedYmd = currentYmd;
    try {
      // 1. チャットタイムラインを当日の状態にリフレッシュ
      if (typeof initChatTimeline === "function") {
        initChatTimeline();
      }
      // 2. タスク・日次コンテキスト・クラウド同期を最新化
      await Promise.allSettled([
        typeof fetchKumapyTasks === "function" ? fetchKumapyTasks() : Promise.resolve(),
        typeof fetchDailyContext === "function" ? fetchDailyContext(true) : Promise.resolve(),
        typeof syncFromCloud === "function" ? syncFromCloud(true) : Promise.resolve()
      ]);
      // 3. 古いログの間引きも実行
      pruneOldChatLogs_();
    } catch (e) {
      console.warn("[Rollover] 日めくりリフレッシュ失敗:", e);
    } finally {
      rolloverChecking = false;
    }
  }
}

// DOM要素
const elements = {
  chatTimeline: document.getElementById("chat-timeline"),
  userInput: document.getElementById("user-input"),
  btnSend: document.getElementById("btn-send"),
  btnVoiceInput: document.getElementById("btn-voice-input"),
  btnSoundToggle: document.getElementById("btn-sound-toggle"),
  btnSoundToggleBottom: document.getElementById("btn-sound-toggle-bottom"),
  btnSettingsToggle: document.getElementById("btn-settings-toggle"),
  btnSettingsClose: document.getElementById("btn-settings-close"),
  btnSaveSettings: document.getElementById("btn-save-settings"),
  settingsPanel: document.getElementById("settings-panel"),
  memoPanel: document.getElementById("memo-panel"),
  btnMemoManage: document.getElementById("btn-memo-manage"),
  btnMemoClose: document.getElementById("btn-memo-close"),
  btnSaveNewMemo: document.getElementById("btn-save-new-memo"),
  newMemoInput: document.getElementById("new-memo-input"),
  aiModeBadge: document.getElementById("ai-mode-badge"),
  speakingIndicator: document.getElementById("speaking-indicator"),
  listeningIndicator: document.getElementById("listening-indicator"),
  aiStatusIndicator: document.getElementById("ai-status-indicator"),
  timerBadge: document.getElementById("timer-badge"),
  kumapyStatusBar: document.getElementById("kumapy-status-bar"),
  kumapyText: document.getElementById("kumapy-text"),
  kumapyIcon: document.getElementById("kumapy-icon"),
  btnKumapyRefresh: document.getElementById("btn-kumapy-refresh"),
  geminiApiToggle: document.getElementById("gemini-api-toggle"),
  geminiApiKey: document.getElementById("gemini-api-key"),
  kumapyWebAppUrlInput: document.getElementById("kumapy-webapp-url"),
  kumapyAccessKeyInput: document.getElementById("kumapy-access-key"),
  kumapyKeyStatus: document.getElementById("kumapy-key-status"),
  companionSyncUrlInput: document.getElementById("companion-sync-url"),
  syncStatusBadge: document.getElementById("sync-status-badge"),
  companionSyncTokenInput: document.getElementById("companion-sync-token"),
  syncAlertIndicator: document.getElementById("sync-alert-indicator"),
  voiceToggle: document.getElementById("voice-toggle"),
  voiceSpeaker: document.getElementById("voice-speaker"),
  voiceFallbackSpeaker: document.getElementById("voice-fallback-speaker"),
  fallbackVoiceGroup: document.getElementById("fallback-voice-group"),
  voicePitch: document.getElementById("voice-pitch"),
  voiceRate: document.getElementById("voice-rate"),
  voiceFallbackPitch: document.getElementById("voice-fallback-pitch"),
  voiceFallbackRate: document.getElementById("voice-fallback-rate"),
  voiceReplaceDict: document.getElementById("voice-replace-dict"),
  notifyUpcomingToggle: document.getElementById("notify-upcoming-toggle"),
  notifyHourlyToggle: document.getElementById("notify-hourly-toggle"),
  notifyNightToggle: document.getElementById("notify-night-toggle"),
  notifyMonologueToggle: document.getElementById("notify-monologue-toggle"),
  pitchVal: document.getElementById("pitch-val"),
  rateVal: document.getElementById("rate-val"),
  fallbackPitchVal: document.getElementById("fallback-pitch-val"),
  fallbackRateVal: document.getElementById("fallback-rate-val"),
  btnVoicePreview: document.getElementById("btn-voice-preview"),
  btnVoiceFallbackPreview: document.getElementById("btn-voice-fallback-preview"),
  btnRefreshDailyContext: document.getElementById("btn-refresh-daily-context"),
  dailyContextStatusText: document.getElementById("daily-context-status-text"),
  todayTokensVal: document.getElementById("today-tokens-val"),
  totalTokensVal: document.getElementById("total-tokens-val"),
  memoActiveCount: document.getElementById("memo-active-count"),
  memoArchivedCount: document.getElementById("memo-archived-count"),
  memoActiveList: document.getElementById("memo-active-list"),
  memoArchivedList: document.getElementById("memo-archived-list"),
  btnToggleArchive: document.getElementById("btn-toggle-archive"),
  archiveArrow: document.getElementById("archive-arrow"),
  headerAvatarBtn: document.getElementById("header-avatar-btn"),
  
  // マスコット単体画面・チャット画面切り替え
  mascotScreen: document.getElementById("mascot-screen"),
  chatPanelScreen: document.getElementById("chat-panel-screen"),
  mascotTouchArea: document.getElementById("mascot-touch-area"),
  btnMascotChat: document.getElementById("btn-mascot-chat"),
  btnMascotToggleMode: document.getElementById("btn-mascot-toggle-mode"),
  btnMascotSettings: document.getElementById("btn-mascot-settings"),
  btnMascotSoundToggle: document.getElementById("btn-mascot-sound-toggle"),
  btnChatClose: document.getElementById("btn-chat-close"),
  mascotAvatarImg: document.getElementById("mascot-avatar-img"),
  mascotMiniBadge: document.getElementById("mascot-mini-badge"),
  mascotFloatingBubble: document.getElementById("mascot-floating-bubble"),
  mascotFloatingBubbleText: document.getElementById("mascot-floating-bubble-text"),
  mascotTaskBar: document.getElementById("mascot-task-bar"),
  pwaCharTaskIcon: document.getElementById("pwa-char-task-icon"),
  pwaCharTaskText: document.getElementById("pwa-char-task-text"),

  // チャット検索
  chatSearchBar: document.getElementById("chat-search-bar"),
  chatSearchInput: document.getElementById("chat-search-input"),
  chatSearchCount: document.getElementById("chat-search-count"),
  btnSearchPrev: document.getElementById("btn-search-prev"),
  btnSearchNext: document.getElementById("btn-search-next")
};

let btnLoadPrevChatEl = null;
let loadPrevContainerEl = null;

// 1日の論理日付（朝6時基準: 00:00〜05:59は前日扱い）
function getLogicalDate(date = new Date()) {
  const d = new Date(date.getTime());
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const ymd = `${yyyy}-${mm}-${dd}`;
  return { dateObj: d, yyyy, mm, dd, ymd };
}

function getTodayYmd(date = new Date()) {
  return getLogicalDate(date).ymd;
}

// ==========================================
// 初期化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const safeRun = (name, fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`[Init Error] ${name}:`, err);
    }
  };

  // 1. イベントリスナーとUI初期化を最優先実行（ボタン反応の遅延を完全排除）
  safeRun("setupEventListeners", setupEventListeners);
  safeRun("loadSettingsToUI", loadSettingsToUI);
  safeRun("updateBadgeState", updateBadgeState);
  safeRun("initTokenUsage", initTokenUsage);

  // 2. タイムライン・メモ描画 ＆ 古いログの間引き
  safeRun("initChatTimeline", initChatTimeline);
  safeRun("renderMemos", renderMemos);
  safeRun("initPullToRefresh", initPullToRefresh);
  safeRun("pruneOldChatLogs_", pruneOldChatLogs_);
  
  // 3. ネットワーク同期を非同期で開始（メインスレッドをブロックしない）
  setTimeout(() => {
    safeRun("fetchKumapyTasks", fetchKumapyTasks);
    safeRun("syncFromCloud", syncFromCloud);
  }, 30);

  // 定期バックグラウンド自動同期
  // 2026-10-06: 同期インターバルを60秒へ適正化（通信量・負荷軽減）
  // 2026-10-07：画面が隠れている間は取りに行かない（戻ったときに visibilitychange で取り直す）
  setInterval(() => { if (!document.hidden) fetchKumapyTasks(); }, 60 * 1000);
  setInterval(() => { if (!document.hidden) syncFromCloud(); }, 60 * 1000);
  // 朝6時またぎ（日付変更線）の定期監視（30秒ごと）
  setInterval(checkDayRollover_, 30 * 1000);
  // Kumapy との接続・合言葉の確認（2026-09-30 ステップ4-2）：起動時と5分ごと
  setTimeout(() => safeRun("checkKumapyConnection_", checkKumapyConnection_), 3000);
  setInterval(checkKumapyConnection_, 5 * 60 * 1000);

  // 未送信キュー（Step3.5）：オンライン復帰時に再送、同期状態の初期表示
  window.addEventListener("online", () => flushOutbox());
  try { localStorage.removeItem(MEMO_TOMBSTONE_KEY); } catch (e) {} // Step3.5f：旧方式の削除マーカーを掃除
  safeRun("renderSyncStatus", renderSyncStatus);
  if (elements.syncAlertIndicator) {
    elements.syncAlertIndicator.addEventListener("click", () => {
      manageOutbox_();
      syncFromCloud(true);
    });
  }

  // PWA/ブラウザ復帰時（画面復帰・アプリ切り替え・タブフォーカス）の自動同期 ＆ 日めくり判定
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkDayRollover_();
      syncFromCloud();
      fetchKumapyTasks();
    }
  });
  window.addEventListener("focus", () => {
    checkDayRollover_();
    syncFromCloud();
  });

  // iOS オーディオアンロック (タップ・タッチ時に確実に準備)
  const unlockEvents = ["touchstart", "touchend", "click", "keydown"];
  const unlocker = () => {
    unlockAudioContext();
  };
  unlockEvents.forEach(evt => document.addEventListener(evt, unlocker, { passive: true }));
});

// ==========================================
// Pull-to-Refresh（下に引っ張って更新 / iOS Standalone PWA完全対応）
// ==========================================
function initPullToRefresh() {
  const ptrEl = document.getElementById("pull-to-refresh");
  const ptrIcon = ptrEl?.querySelector(".ptr-icon");
  const ptrText = ptrEl?.querySelector(".ptr-text");
  const container = elements.chatTimeline;
  if (!ptrEl) return;

  let startY = 0;
  let startX = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const PULL_THRESHOLD = 50;

  const onTouchStart = (e) => {
    if (!state.isPanelOpen) return; // マスコット単体画面ではPullToRefreshを無効化
    if (isRefreshing) return;
    if (elements.settingsPanel && !elements.settingsPanel.classList.contains("hidden")) return;
    if (elements.memoPanel && !elements.memoPanel.classList.contains("hidden")) return;

    const scrollPos = container ? container.scrollTop : 0;
    if (scrollPos <= 5) {
      startY = e.touches[0].pageY;
      startX = e.touches[0].pageX;
      isPulling = true;
    } else {
      isPulling = false;
    }
  };

  const onTouchMove = (e) => {
    if (!isPulling || isRefreshing) return;
    currentY = e.touches[0].pageY;
    const currentX = e.touches[0].pageX;
    const diffY = currentY - startY;
    const diffX = Math.abs(currentX - startX);

    if (diffX > diffY) return; // 横スワイプは無視

    const scrollPos = container ? container.scrollTop : 0;
    if (diffY > 5 && scrollPos <= 2) {
      if (e.cancelable && diffY > 15) {
        e.preventDefault(); // iOS Standalone PWAのスクロールロック/キャンセルを防止
      }
      const translateY = Math.min(diffY * 0.45, 60);
      ptrEl.style.transform = `translateY(${translateY}px)`;
      ptrEl.classList.add("visible");
      
      if (translateY >= PULL_THRESHOLD * 0.45) {
        if (ptrText) ptrText.textContent = "離して更新";
        if (ptrIcon) ptrIcon.style.transform = "rotate(180deg)";
      } else {
        if (ptrText) ptrText.textContent = "下に引っ張って更新";
        if (ptrIcon) ptrIcon.style.transform = "rotate(0deg)";
      }
    }
  };

  const onTouchEnd = async () => {
    if (!isPulling || isRefreshing) return;
    isPulling = false;
    const diffY = currentY - startY;
    const scrollPos = container ? container.scrollTop : 0;

    if (diffY * 0.45 >= PULL_THRESHOLD * 0.45 && scrollPos <= 10) {
      isRefreshing = true;
      ptrEl.classList.add("refreshing");
      if (ptrText) ptrText.textContent = "同期中...";
      ptrEl.style.transform = "translateY(48px)";

      try {
        await Promise.all([syncFromCloud(), fetchKumapyTasks()]);
        if (ptrText) ptrText.textContent = "最新の状態です！";
        if (ptrIcon) ptrIcon.textContent = "✨";
      } catch (err) {
        if (ptrText) ptrText.textContent = "更新完了";
      }

      setTimeout(() => {
        ptrEl.style.transform = "translateY(-100%)";
        ptrEl.classList.remove("visible", "refreshing");
        setTimeout(() => {
          if (ptrIcon) {
            ptrIcon.textContent = "🔄";
            ptrIcon.style.transform = "rotate(0deg)";
          }
          if (ptrText) ptrText.textContent = "下に引っ張って更新";
          isRefreshing = false;
        }, 300);
      }, 700);
    } else {
      ptrEl.style.transform = "translateY(-100%)";
      ptrEl.classList.remove("visible");
    }
    startY = 0;
    currentY = 0;
  };

  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("touchend", onTouchEnd, { passive: true });
}

// iOS Safari オーディオアンロック
function unlockAudioContext() {
  if (state.audioUnlocked) return;
  state.audioUnlocked = true;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    // 空の無音WAVを再生してHTMLMediaElementを完全アンロック
    state.sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    state.sharedAudio.play().then(() => {
      state.sharedAudio.pause();
    }).catch(() => {});

    // iOS SpeechSynthesisのアンロック
    if ("speechSynthesis" in window) {
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0.01;
      window.speechSynthesis.speak(silent);
    }
  } catch (e) {
    console.warn("Audio unlock warning:", e);
  }
}

// ==========================================
// トークン消費集計
// ==========================================
function initTokenUsage() {
  const todayYmd = getTodayYmd(); // 2026-10-07：UTC ではなく朝6時区切りの日付
  if (state.tokenUsageDate !== todayYmd) {
    state.tokenUsageDate = todayYmd;
    state.todayTokens = 0;
    localStorage.setItem("gemini_token_date", todayYmd);
    localStorage.setItem("gemini_today_tokens", "0");
  }
  updateTokenDisplay();
}

function recordTokenUsage(tokens) {
  if (!tokens || tokens <= 0) return;
  const todayYmd = getTodayYmd(); // 2026-10-07：UTC ではなく朝6時区切りの日付
  if (state.tokenUsageDate !== todayYmd) {
    state.tokenUsageDate = todayYmd;
    state.todayTokens = 0;
    localStorage.setItem("gemini_token_date", todayYmd);
  }
  state.todayTokens += tokens;
  state.totalTokens += tokens;
  localStorage.setItem("gemini_today_tokens", state.todayTokens.toString());
  localStorage.setItem("gemini_total_tokens", state.totalTokens.toString());
  updateTokenDisplay();
}

function updateTokenDisplay() {
  if (elements.todayTokensVal) {
    elements.todayTokensVal.textContent = `${state.todayTokens.toLocaleString()} tokens`;
  }
  if (elements.totalTokensVal) {
    elements.totalTokensVal.textContent = `${state.totalTokens.toLocaleString()} tokens`;
  }
}

function loadSettingsToUI() {
  state.geminiApiKey = localStorage.getItem("gemini_api_key") || "";
  state.geminiEnabled = localStorage.getItem("gemini_enabled") !== "false";
  state.kumapyWebAppUrl = loadKumapyWebAppUrl_();
  state.kumapyAccessKey = localStorage.getItem("kumapy_access_key") || "";
  state.syncGasUrl = localStorage.getItem("companion_sync_gas_url") || DEFAULT_CONFIG.syncGasUrl;
  state.syncToken = localStorage.getItem("companion_sync_token") || "";
  state.voiceEnabled = localStorage.getItem("voice_enabled") !== "false";
  state.voiceSpeaker = localStorage.getItem("voice_speaker") || "11";
  state.voiceFallbackSpeaker = localStorage.getItem("voice_fallback_speaker") || "os:Otoya";
  state.voicePitch = parseFloat(localStorage.getItem("voice_pitch") || "1.0");
  state.voiceRate = parseFloat(localStorage.getItem("voice_rate") || "1.0");
  state.voiceFallbackPitch = parseFloat(localStorage.getItem("voice_fallback_pitch") || "1.0");
  state.voiceFallbackRate = parseFloat(localStorage.getItem("voice_fallback_rate") || "1.0");
  state.voiceReplaceDict = localStorage.getItem("voice_replace_dict") || "";

  if (elements.geminiApiToggle) elements.geminiApiToggle.checked = state.geminiEnabled;
  if (elements.geminiApiKey) elements.geminiApiKey.value = state.geminiApiKey;
  if (elements.kumapyWebAppUrlInput) elements.kumapyWebAppUrlInput.value = state.kumapyWebAppUrl;
  if (elements.kumapyAccessKeyInput) elements.kumapyAccessKeyInput.value = state.kumapyAccessKey;
  updateKumapyKeyStatus_();
  if (elements.companionSyncUrlInput) elements.companionSyncUrlInput.value = state.syncGasUrl;
  if (elements.companionSyncTokenInput) elements.companionSyncTokenInput.value = state.syncToken;
  if (elements.voiceToggle) elements.voiceToggle.checked = state.voiceEnabled;
  state.voiceExternalTts = localStorage.getItem("voice_external_tts") === "true";
  const extTtsEl = document.getElementById("voice-external-tts-toggle");
  if (extTtsEl) extTtsEl.checked = state.voiceExternalTts;
  if (elements.voiceSpeaker) elements.voiceSpeaker.value = state.voiceSpeaker;
  if (elements.voiceFallbackSpeaker) elements.voiceFallbackSpeaker.value = state.voiceFallbackSpeaker;
  updateVoiceSettingsUI();
  if (elements.voicePitch) elements.voicePitch.value = state.voicePitch;
  if (elements.voiceRate) elements.voiceRate.value = state.voiceRate;
  if (elements.voiceFallbackPitch) elements.voiceFallbackPitch.value = state.voiceFallbackPitch;
  if (elements.voiceFallbackRate) elements.voiceFallbackRate.value = state.voiceFallbackRate;
  if (elements.voiceReplaceDict) elements.voiceReplaceDict.value = state.voiceReplaceDict;
  if (elements.notifyUpcomingToggle) elements.notifyUpcomingToggle.checked = state.notifyUpcoming;
  if (elements.notifyHourlyToggle) elements.notifyHourlyToggle.checked = state.notifyHourly;
  if (elements.notifyNightToggle) elements.notifyNightToggle.checked = state.notifyNight;
  if (elements.notifyMonologueToggle) elements.notifyMonologueToggle.checked = state.notifyMonologue;
  if (elements.pitchVal) elements.pitchVal.textContent = state.voicePitch.toFixed(1);
  if (elements.rateVal) elements.rateVal.textContent = state.voiceRate.toFixed(1);
  if (elements.fallbackPitchVal) elements.fallbackPitchVal.textContent = state.voiceFallbackPitch.toFixed(1);
  if (elements.fallbackRateVal) elements.fallbackRateVal.textContent = state.voiceFallbackRate.toFixed(1);
  updateTokenDisplay();
  updateDailyContextStatusUI();
}


function updateDailyContextStatusUI() {
  if (!elements.dailyContextStatusText) return;
  if (state.dailyContextUpdatedAt) {
    try {
      const d = new Date(state.dailyContextUpdatedAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const month = d.getMonth() + 1;
      const day = d.getDate();
      elements.dailyContextStatusText.textContent = `最終更新: ${month}/${day} ${hh}:${mm}`;
      return;
    } catch (e) {}
  }
  elements.dailyContextStatusText.textContent = '最終更新: 未取得';
}

function updateBadgeState(status) {
  if (elements.aiModeBadge) {
    if (!state.geminiApiKey) {
      elements.aiModeBadge.textContent = "⚡ 内蔵モード";
      elements.aiModeBadge.className = "ai-mode-badge";
    } else if (!state.geminiEnabled) {
      elements.aiModeBadge.textContent = "⚡ 内蔵 (API一時停止)";
      elements.aiModeBadge.className = "ai-mode-badge";
    } else if (status === "error") {
      elements.aiModeBadge.textContent = "⚡ 内蔵 (APIエラー)";
      elements.aiModeBadge.className = "ai-mode-badge";
    } else {
      elements.aiModeBadge.textContent = "✨ Gemini 連動中";
      elements.aiModeBadge.className = "ai-mode-badge active";
    }
  }
  const soundIcon = state.voiceEnabled ? "🔊" : "🔇";
  const soundBtns = [elements.btnSoundToggle, elements.btnSoundToggleBottom, elements.btnMascotSoundToggle].filter(Boolean);
  soundBtns.forEach(btn => {
    btn.textContent = soundIcon;
    btn.title = state.voiceEnabled ? "音声読み上げ: オン (クリックでミュート)" : "音声読み上げ: オフ (クリックでオン)";
    btn.classList.toggle("muted", !state.voiceEnabled);
  });
  if (elements.voiceToggle) {
    elements.voiceToggle.checked = state.voiceEnabled;
  }
  // チャット画面表示時はヘッダーの音声ボタンを確実に非表示
  if (elements.btnSoundToggle) {
    elements.btnSoundToggle.style.display = state.isPanelOpen ? "none" : "flex";
  }
}

// ==========================================
// イベントリスナー設定
// ==========================================
function setupEventListeners() {
  // 画面開閉（マスコット単体画面 ↔ チャット画面）
  const openChatPanel = () => {
    unlockAudioContext();
    const mascotSc = document.getElementById("mascot-screen");
    const chatSc = document.getElementById("chat-panel-screen");
    const headerSoundBtn = document.getElementById("btn-sound-toggle");
    if (mascotSc) mascotSc.classList.add("hidden");
    if (chatSc) chatSc.classList.remove("hidden");
    if (headerSoundBtn) headerSoundBtn.style.display = "none";
    state.isPanelOpen = true;
    if (window.clearPwaUnreadBadge) window.clearPwaUnreadBadge();
    hidePwaFloatingBubble(true);
    scrollToBottom();
  };

  const closeChatPanel = () => {
    unlockAudioContext();
    const mascotSc = document.getElementById("mascot-screen");
    const chatSc = document.getElementById("chat-panel-screen");
    const headerSoundBtn = document.getElementById("btn-sound-toggle");
    if (chatSc) chatSc.classList.add("hidden");
    if (mascotSc) mascotSc.classList.remove("hidden");
    if (headerSoundBtn) headerSoundBtn.style.display = "flex";
    state.isPanelOpen = false;
    showPwaFloatingBubble(lastBotSpeechText);
  };

  const toggleSimpleMode = () => {
    state.isSimpleMode = !state.isSimpleMode;
    localStorage.setItem("companion_simple_mode", state.isSimpleMode);
    const mascotSc = document.getElementById("mascot-screen");
    if (mascotSc) {
      mascotSc.classList.toggle("simple-mode", state.isSimpleMode);
    }
  };

  if (state.isSimpleMode) {
    const mascotSc = document.getElementById("mascot-screen");
    if (mascotSc) mascotSc.classList.add("simple-mode");
  }

  // 1. マスコット画面全体タップ → シンプルモード（吹き出し・タスクバー）のトグル
  const mascotSc = document.getElementById("mascot-screen");
  if (mascotSc) {
    mascotSc.addEventListener("click", (e) => {
      if (e.target.closest("#mascot-task-bar") || e.target.closest("button") || e.target.closest("#mascot-mini-badge")) return;
      e.stopPropagation();
      toggleSimpleMode();
    });
  }

  // 2. アバター画像・コンテナ・画面タップ → シンプルモード（吹き出し・タスクバー）トグル
  const avatarRing = document.querySelector(".mascot-avatar-ring");
  const avatarImg = document.getElementById("mascot-avatar-img");
  const avatarContainer = document.querySelector(".mascot-avatar-container");
  const touchArea = document.getElementById("mascot-touch-area");

  [avatarRing, avatarImg, avatarContainer, touchArea].forEach(el => {
    if (el) {
      el.addEventListener("click", (e) => {
        if (e.target.closest("#mascot-task-bar") || e.target.closest("button") || e.target.closest("#mascot-mini-badge") || e.target.closest("#mascot-floating-bubble")) return;
        e.stopPropagation();
        toggleSimpleMode();
      });
    }
  });

  // 3. 吹き出し（メッセージ）をタップ → チャットを開く
  const floatingBubble = document.getElementById("mascot-floating-bubble");
  if (floatingBubble) {
    floatingBubble.addEventListener("click", (e) => {
      e.stopPropagation();
      openChatPanel();
    });
  }

  // Kumapy WebApp を別ウィンドウ/タブで開く（iOS PWAポップアップブロック回避）
  const openKumapyInBrowser = () => {
    // 2026-09-30（ステップ4-2）: 合言葉を付けずに開く（開いた先の Kumapy の画面で1回入力する）
    const kumapyWebAppUrl = sanitizeKumapyUrl(state.kumapyWebAppUrl || "");
    if (!kumapyWebAppUrl) {
      addMessageBubble("bot", "Kumapy WebApp URLが設定されていません。設定画面で入力してください。", null, true);
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = kumapyWebAppUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
    } catch (e) {
      window.open(kumapyWebAppUrl, "_blank");
    }
  };

  // タスク枠タップで Kumapy を別ウィンドウで開く
  if (elements.mascotTaskBar) {
    elements.mascotTaskBar.addEventListener("click", (e) => {
      e.stopPropagation();
      openKumapyInBrowser();
    });

    elements.mascotTaskBar.addEventListener("mouseenter", () => {
      const textEl = elements.pwaCharTaskText;
      if (textEl && textEl.scrollWidth > textEl.clientWidth) {
        const scrollDist = textEl.scrollWidth - textEl.clientWidth + 16;
        const duration = Math.max(3.5, scrollDist / 35);
        textEl.style.setProperty("--scroll-dist", `-${scrollDist}px`);
        textEl.style.animation = `taskTextScrollDynamic ${duration}s ease-in-out infinite alternate`;
      }
    });
    elements.mascotTaskBar.addEventListener("mouseleave", () => {
      if (elements.pwaCharTaskText) {
        elements.pwaCharTaskText.style.animation = "none";
      }
    });
  }
  // PWA 湯気バッジ（未読合図）のドラッグ＆保存、タップでチャットを開く
  const SAUNA_BADGE_SVG = '<svg class="mini-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M7.5 15c-1-2 1-3 0-5.5"/><path d="M12 15c-1-2 1-3 0-5.5"/><path d="M16.5 15c-1-2 1-3 0-5.5"/></svg>';
  let pwaUnreadCount = 0;
  let isDraggingPwaBadge = false;
  let pwaBadgeDragStartX = 0;
  let pwaBadgeDragStartY = 0;
  let pwaBadgeInitialLeft = 0;
  let pwaBadgeInitialTop = 0;
  let pwaBadgeHasMoved = false;

  window.showPwaUnreadBadge = () => {
    pwaUnreadCount++;
    if (elements.mascotMiniBadge) {
      elements.mascotMiniBadge.innerHTML = pwaUnreadCount > 1
        ? `${SAUNA_BADGE_SVG}<span class="badge-count">${pwaUnreadCount}</span>`
        : SAUNA_BADGE_SVG;
      if (!state.isPanelOpen) {
        elements.mascotMiniBadge.classList.remove("hidden");
      }
    }
  };

  window.clearPwaUnreadBadge = () => {
    pwaUnreadCount = 0;
    if (elements.mascotMiniBadge) {
      elements.mascotMiniBadge.innerHTML = SAUNA_BADGE_SVG;
      elements.mascotMiniBadge.classList.add("hidden");
    }
  };

  const loadPwaBadgePosition = () => {
    if (!elements.mascotMiniBadge) return;
    try {
      const saved = localStorage.getItem("companion_pwa_badge_pos");
      if (saved) {
        const pos = JSON.parse(saved);
        if (typeof pos.left === "number" && typeof pos.top === "number") {
          elements.mascotMiniBadge.style.left = `${pos.left}px`;
          elements.mascotMiniBadge.style.top = `${pos.top}px`;
          elements.mascotMiniBadge.style.right = "auto";
        }
      }
    } catch (e) {
      console.warn("loadPwaBadgePosition error:", e);
    }
  };
  loadPwaBadgePosition();

  const handlePwaBadgeStart = (clientX, clientY) => {
    isDraggingPwaBadge = true;
    pwaBadgeHasMoved = false;
    pwaBadgeDragStartX = clientX;
    pwaBadgeDragStartY = clientY;
    const badgeRect = elements.mascotMiniBadge.getBoundingClientRect();
    const parent = elements.mascotMiniBadge.parentElement || elements.mascotTouchArea;
    const parentRect = parent.getBoundingClientRect();
    pwaBadgeInitialLeft = badgeRect.left - parentRect.left;
    pwaBadgeInitialTop = badgeRect.top - parentRect.top;
  };

  const handlePwaBadgeMove = (clientX, clientY) => {
    if (!isDraggingPwaBadge || !elements.mascotMiniBadge) return;
    const deltaX = clientX - pwaBadgeDragStartX;
    const deltaY = clientY - pwaBadgeDragStartY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      pwaBadgeHasMoved = true;
    }
    const parent = elements.mascotMiniBadge.parentElement || elements.mascotTouchArea;
    const maxW = parent ? parent.clientWidth - 24 : 176;
    const maxH = parent ? parent.clientHeight - 24 : 176;
    const newLeft = Math.max(-10, Math.min(maxW + 10, pwaBadgeInitialLeft + deltaX));
    const newTop = Math.max(-10, Math.min(maxH + 10, pwaBadgeInitialTop + deltaY));
    elements.mascotMiniBadge.style.left = `${newLeft}px`;
    elements.mascotMiniBadge.style.top = `${newTop}px`;
    elements.mascotMiniBadge.style.right = "auto";
  };

  const handlePwaBadgeEnd = () => {
    if (!isDraggingPwaBadge) return;
    isDraggingPwaBadge = false;
    if (pwaBadgeHasMoved && elements.mascotMiniBadge) {
      const left = parseInt(elements.mascotMiniBadge.style.left, 10);
      const top = parseInt(elements.mascotMiniBadge.style.top, 10);
      if (!isNaN(left) && !isNaN(top)) {
        localStorage.setItem("companion_pwa_badge_pos", JSON.stringify({ left, top }));
      }
    }
    setTimeout(() => { pwaBadgeHasMoved = false; }, 80);
  };

  if (elements.mascotMiniBadge) {
    elements.mascotMiniBadge.innerHTML = SAUNA_BADGE_SVG;

    // Pointer Events による一元的なタッチ・マウスドラッグ対応
    elements.mascotMiniBadge.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      handlePwaBadgeStart(e.clientX, e.clientY);
      try {
        elements.mascotMiniBadge.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    elements.mascotMiniBadge.addEventListener("pointermove", (e) => {
      if (isDraggingPwaBadge) {
        e.stopPropagation();
        e.preventDefault();
        handlePwaBadgeMove(e.clientX, e.clientY);
      }
    });

    elements.mascotMiniBadge.addEventListener("pointerup", (e) => {
      if (!isDraggingPwaBadge) return;
      e.stopPropagation();
      e.preventDefault();
      const moved = pwaBadgeHasMoved;
      handlePwaBadgeEnd();
      try {
        elements.mascotMiniBadge.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (!moved) {
        openChatPanel();
      }
    });

    elements.mascotMiniBadge.addEventListener("pointercancel", (e) => {
      isDraggingPwaBadge = false;
      pwaBadgeHasMoved = false;
      try {
        elements.mascotMiniBadge.releasePointerCapture(e.pointerId);
      } catch (err) {}
    });

    // クリックのフォールバック
    elements.mascotMiniBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!pwaBadgeHasMoved) {
        openChatPanel();
      }
    });
  }

  if (elements.headerAvatarBtn) {
    elements.headerAvatarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.isPanelOpen) {
        closeChatPanel();
        syncFromCloud();
      } else {
        openChatPanel();
      }
    });
  }
  // モーダル排他制御ヘルパー
  const openSettingsModal = (e) => {
    if (e) e.stopPropagation();
    if (elements.memoPanel) elements.memoPanel.classList.add("hidden");
    loadSettingsToUI();
    if (elements.settingsPanel) elements.settingsPanel.classList.remove("hidden");
  };

  const closeSettingsModal = (save = false) => {
    saveSettings(save);
    if (elements.settingsPanel) elements.settingsPanel.classList.add("hidden");
  };

  const openMemoModal = (e) => {
    if (e) e.stopPropagation();
    if (elements.settingsPanel) elements.settingsPanel.classList.add("hidden");
    renderMemos();
    if (elements.memoPanel) elements.memoPanel.classList.remove("hidden");
  };

  const closeMemoModal = (e) => {
    if (e) e.stopPropagation();
    if (elements.memoPanel) elements.memoPanel.classList.add("hidden");
  };

  if (elements.btnMascotSettings) {
    elements.btnMascotSettings.addEventListener("click", openSettingsModal);
  }

  // 設定パネル
  if (elements.btnSettingsToggle) {
    elements.btnSettingsToggle.addEventListener("click", openSettingsModal);
  }
  if (elements.btnSettingsClose) {
    elements.btnSettingsClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSettingsModal(false);
    });
  }
  if (elements.btnSaveSettings) {
    elements.btnSaveSettings.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSettingsModal(true);
    });
  }

  // メモパネル
  if (elements.btnMemoManage) {
    elements.btnMemoManage.addEventListener("click", openMemoModal);
  }
  if (elements.btnMemoClose) {
    elements.btnMemoClose.addEventListener("click", closeMemoModal);
  }

  // モーダル背景（オーバーレイ暗部）タップで閉じる
  if (elements.settingsPanel) {
    elements.settingsPanel.addEventListener("click", (e) => {
      if (e.target === elements.settingsPanel) {
        closeSettingsModal(false);
      }
    });
  }
  if (elements.memoPanel) {
    elements.memoPanel.addEventListener("click", (e) => {
      if (e.target === elements.memoPanel) {
        closeMemoModal(e);
      }
    });
  }

  // サウンド切り替え（マスコット画面 ＆ チャット画面 双方）
  const toggleSoundState = (e) => {
    if (e) e.stopPropagation();
    state.voiceEnabled = !state.voiceEnabled;
    localStorage.setItem("voice_enabled", state.voiceEnabled.toString());
    updateBadgeState();
    if (!state.voiceEnabled) {
      stopVoice();
    }
  };

  window.openKumapyInBrowser = openKumapyInBrowser;
  window.toggleSound = toggleSoundState;
  window.openSettings = openSettingsModal;
  window.closeSettings = closeSettingsModal;

  [elements.btnSoundToggle, elements.btnSoundToggleBottom, elements.btnMascotSoundToggle].filter(Boolean).forEach(btn => {
    btn.addEventListener("click", toggleSoundState);
  });

  // 送信（クリック）
  elements.btnSend.addEventListener("click", () => {
    unlockAudioContext();
    handleUserSend();
  });

  // textarea 自動伸縮 ＆ Cmd+Enter / Ctrl+Enter で送信（単体Enterは改行）
  elements.userInput.addEventListener("input", () => {
    elements.userInput.style.height = "auto";
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 120) + "px";
  });

  elements.userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      if (e.isComposing) return; // IME確定中は送信しない
      e.preventDefault();
      e.stopPropagation();
      unlockAudioContext();
      handleUserSend();
    }
  });

  // 音声録音（トグル式マイク）
  elements.btnVoiceInput.addEventListener("click", () => {
    unlockAudioContext();
    toggleVoiceRecording();
  });

  if (elements.btnRefreshDailyContext) {
    elements.btnRefreshDailyContext.addEventListener("click", async () => {
      const origText = elements.btnRefreshDailyContext.textContent;
      elements.btnRefreshDailyContext.disabled = true;
      elements.btnRefreshDailyContext.textContent = "🔄 データ取得中...";
      if (elements.dailyContextStatusText) elements.dailyContextStatusText.textContent = "最新の天気・睡眠・朝刊を取得中...";

      try {
        await fetchDailyContext(true);
        if (elements.dailyContextStatusText) {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          elements.dailyContextStatusText.textContent = `✅ 更新完了 (${hh}:${mm})`;
        }
        addMessageBubble("bot", "日次データ（天気・睡眠・朝刊）を最新の情報に更新したよ！", null, true);
        speakWithVoice("日次データを最新の情報に更新しましたよ！");
      } catch (err) {
        console.warn("Failed to refresh daily context in PWA:", err);
        if (elements.dailyContextStatusText) elements.dailyContextStatusText.textContent = "⚠️ 更新に失敗しました";
      } finally {
        elements.btnRefreshDailyContext.disabled = false;
        elements.btnRefreshDailyContext.textContent = origText;
      }
    });
  }

  // APIキーのリアルタイム自動保存
  const syncApiKey = (e) => {
    state.geminiApiKey = e.target.value.trim();
    localStorage.setItem("gemini_api_key", state.geminiApiKey);
    updateBadgeState();
  };
  elements.geminiApiKey.addEventListener("input", syncApiKey);
  elements.geminiApiKey.addEventListener("change", syncApiKey);
  elements.geminiApiKey.addEventListener("blur", syncApiKey);

  // クイックバッジ切り替え
  elements.aiModeBadge.addEventListener("click", () => {
    state.geminiEnabled = !state.geminiEnabled;
    localStorage.setItem("gemini_enabled", state.geminiEnabled.toString());
    elements.geminiApiToggle.checked = state.geminiEnabled;
    updateBadgeState();
    addMessageBubble("bot", state.geminiEnabled ? "Gemini AIモードをONにしたよ！賢くお答えするね。" : "内蔵モードに切り替えたよ！", null, true);
  });

  // メモ アーカイブ開閉
  elements.btnToggleArchive.addEventListener("click", (e) => {
    if (e) e.stopPropagation();
    const isHidden = elements.memoArchivedList.classList.toggle("hidden");
    elements.archiveArrow.textContent = isHidden ? "▶" : "▼";
  });

  // Kumapy & 会話ログ・設定 一括リフレッシュ
  elements.btnKumapyRefresh.addEventListener("click", (e) => {
    e.stopPropagation();
    fetchKumapyTasks();
    syncFromCloud();
  });
  elements.kumapyStatusBar.addEventListener("click", (e) => {
    if (e.target.closest("#btn-kumapy-refresh")) return;
    e.stopPropagation();
    openKumapyInBrowser();
  });

  // スライダー値表示更新
  elements.voicePitch.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    elements.pitchVal.textContent = val.toFixed(1);
    state.voicePitch = val;
  });
  elements.voiceRate.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    elements.rateVal.textContent = val.toFixed(1);
    state.voiceRate = val;
  });

  if (elements.voiceFallbackPitch) {
    elements.voiceFallbackPitch.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (elements.fallbackPitchVal) elements.fallbackPitchVal.textContent = val.toFixed(1);
      state.voiceFallbackPitch = val;
    });
  }
  if (elements.voiceFallbackRate) {
    elements.voiceFallbackRate.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (elements.fallbackRateVal) elements.fallbackRateVal.textContent = val.toFixed(1);
      state.voiceFallbackRate = val;
    });
  }

  // 音声試聴
  elements.btnVoicePreview.addEventListener("click", async (e) => {
    if (e) e.stopPropagation();
    unlockAudioContext();
    const speakerId = elements.voiceSpeaker ? elements.voiceSpeaker.value : state.voiceSpeaker;
    const rate = elements.voiceRate ? parseFloat(elements.voiceRate.value) : state.voiceRate;
    const pitch = elements.voicePitch ? parseFloat(elements.voicePitch.value) : state.voicePitch;
    const sampleText = voiceSamples[speakerId] || voiceSamples[speakerId.replace(/^os:.*/, "os")] || voiceSamples["11"] || "きのぴぃ、いつもお疲れさま！今日も一緒にととのっていこうね。";

    const originalText = elements.btnVoicePreview.textContent;
    elements.btnVoicePreview.textContent = "🔊 再生中...";
    elements.btnVoicePreview.disabled = true;

    if (state.sharedAudio) {
      state.sharedAudio.pause();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      if (!speakerId.startsWith("os") && speakerId !== "os") {
        await speakWithVoicevox(sampleText, speakerId, rate, pitch);
      } else {
        speakWithWebSpeech(sampleText, rate, pitch, speakerId);
      }
    } catch (err) {
      console.warn("Voice preview error:", err);
    } finally {
      elements.btnVoicePreview.textContent = originalText;
      elements.btnVoicePreview.disabled = false;
    }
  });

  // 予備音声試聴
  if (elements.btnVoiceFallbackPreview) {
    elements.btnVoiceFallbackPreview.addEventListener("click", (e) => {
      if (e) e.stopPropagation();
      unlockAudioContext();
      const fallbackId = elements.voiceFallbackSpeaker ? elements.voiceFallbackSpeaker.value : state.voiceFallbackSpeaker;
      const rate = elements.voiceFallbackRate ? parseFloat(elements.voiceFallbackRate.value) : state.voiceFallbackRate;
      const pitch = elements.voiceFallbackPitch ? parseFloat(elements.voiceFallbackPitch.value) : state.voiceFallbackPitch;
      const sampleText = voiceSamples[fallbackId] || voiceSamples["os"] || "きのぴぃ、いつもお疲れさま！今日も一緒にととのっていこうね。";

      const originalText = elements.btnVoiceFallbackPreview.textContent;
      elements.btnVoiceFallbackPreview.textContent = "🔊 再生中...";
      elements.btnVoiceFallbackPreview.disabled = true;

      if (state.sharedAudio) {
        state.sharedAudio.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      try {
        speakWithWebSpeech(sampleText, rate, pitch, fallbackId);
      } catch (err) {
        console.warn("Voice fallback preview error:", err);
      } finally {
        setTimeout(() => {
          elements.btnVoiceFallbackPreview.textContent = originalText;
          elements.btnVoiceFallbackPreview.disabled = false;
        }, 500);
      }
    });
  }

  // クイックアクションボタン
  document.querySelectorAll(".quick-actions-left .quick-icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockAudioContext();
      const action = btn.dataset.action;
      handleQuickAction(action);
    });
  });

  // チャット検索
  initChatSearchEvents();
}

// ==========================================
// 音声録音 ＆ iOS対応
// ==========================================
async function toggleVoiceRecording() {
  unlockAudioContext();
  if (state.isRecording) {
    stopVoiceRecording();
  } else {
    await startVoiceRecording();
  }
}

async function startVoiceRecording() {
  if (state.isRecording) return;

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.isRecording = true;
    elements.btnVoiceInput.classList.add("recording");
    elements.listeningIndicator.classList.remove("hidden");

    audioChunks = [];

    // iOS WebKit / Chrome / Safari 対応のMIME判定
    let mimeType = "";
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/aac")) {
        mimeType = "audio/aac";
      }
    }

    const options = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(audioStream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      state.isRecording = false;
      elements.btnVoiceInput.classList.remove("recording");
      elements.listeningIndicator.classList.add("hidden");

      if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        audioStream = null;
      }

      if (audioChunks.length === 0) return;
      const actualType = mimeType || "audio/mp4";
      const audioBlob = new Blob(audioChunks, { type: actualType });
      await processRecordedAudio(audioBlob, actualType);
    };

    mediaRecorder.start();

  } catch (err) {
    console.error("Microphone error:", err);
    state.isRecording = false;
    elements.btnVoiceInput.classList.remove("recording");
    elements.listeningIndicator.classList.add("hidden");

    // Web Speech API フォールバック試行
    tryWebSpeechRecognition();
  }
}

function tryWebSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert("マイクが利用できません。iPhoneの「設定 > Safari > マイク」をご確認ください。");
    return;
  }

  const rec = new SpeechRec();
  rec.lang = "ja-JP";
  rec.interimResults = false;
  rec.continuous = false;

  rec.onstart = () => {
    state.isRecording = true;
    elements.btnVoiceInput.classList.add("recording");
    elements.listeningIndicator.classList.remove("hidden");
  };

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    elements.userInput.value = text;
    handleUserSend();
  };

  rec.onerror = (e) => {
    console.warn("SpeechRec error:", e);
    state.isRecording = false;
    elements.btnVoiceInput.classList.remove("recording");
    elements.listeningIndicator.classList.add("hidden");
  };

  rec.onend = () => {
    state.isRecording = false;
    elements.btnVoiceInput.classList.remove("recording");
    elements.listeningIndicator.classList.add("hidden");
  };

  try {
    rec.start();
  } catch (e) {
    console.warn("Rec start error:", e);
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  } else {
    state.isRecording = false;
    elements.btnVoiceInput.classList.remove("recording");
    elements.listeningIndicator.classList.add("hidden");
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
    }
  }
}

async function processRecordedAudio(audioBlob, mimeType) {
  elements.aiStatusIndicator.textContent = "✨ 音声を解析中...";
  elements.aiStatusIndicator.classList.remove("hidden");

  if (state.geminiApiKey && state.geminiEnabled) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result.split(",")[1];
          const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
          const audioCtrl = new AbortController();
          const audioTimer = setTimeout(() => audioCtrl.abort(), 30000);

          const prompt = `ユーザー（きのぴぃ）からの音声録音メッセージです。
以下の手順で処理してください：
1. 音声からユーザーが発言した言葉を正確に文字起こししてください (userText)。無音や聞き取れない場合は「（聞き取れませんでした）」としてください。
2. その発言に対し、きのぴぃ専属のAIセコンド「Matt」（ハシビロコウ・半歩横に）として1〜2文（60文字以内）で返答してください (replyText)。
   - 呼び方：必ず「きのぴぃ」（さん付け不要）
   - トーン：丁寧だけど堅くない（敬語7：くだけた表現3）
   - スタンス：冷静・率直・真顔ユーモア。おべっかや過剰な肯定はせず、必要なら率直に意見を伝え、休むべき時はタオルを投げる。`;

          const payload = {
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType.split(";")[0] || "audio/mp4",
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
              response_mime_type: "application/json",
              response_schema: {
                type: "OBJECT",
                properties: {
                  userText: { type: "STRING" },
                  replyText: { type: "STRING" }
                },
                required: ["userText", "replyText"]
              }
            }
          };

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": state.geminiApiKey },
            body: JSON.stringify(payload),
            signal: audioCtrl.signal
          });
          clearTimeout(audioTimer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          elements.aiStatusIndicator.classList.add("hidden");

          if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
            recordTokenUsage(data.usageMetadata.totalTokenCount);
          }

          const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawJson) throw new Error("空の返事");
          let parsed;
          try { parsed = JSON.parse(rawJson); } catch (pe) { throw new Error("JSON parse error"); }
          if (parsed.userText && parsed.userText !== "（聞き取れませんでした）") {
            addMessageBubble("user", parsed.userText, null, true);
          }
          if (parsed.replyText) {
            addMessageBubble("bot", parsed.replyText, null, true);
            speak(parsed.replyText);
          } else {
            throw new Error("空の返事");
          }
        } catch (e) {
          // 2026-10-07（GC-27）：失敗を見える形にし、録音は手元に残して送り直せるようにする（ログには書かない）
          console.error("Audio Gemini error:", e && e.message);
          elements.aiStatusIndicator.classList.add("hidden");
          updateBadgeState("error");
          showAiFallbackNotice_(`⚠️ 音声を文字にできませんでした（${aiFailReason_(e)}）。録音はこの画面に残っています`,
            () => processRecordedAudio(audioBlob, mimeType));
        }
      };
    } catch (err) {
      console.error("Audio process error:", err);
      elements.aiStatusIndicator.classList.add("hidden");
    }
  } else {
    elements.aiStatusIndicator.classList.add("hidden");
    const msg = "音声入力を賢く使うには、設定（⚙️）からGemini API Keyを設定してね！";
    addMessageBubble("bot", msg, null, false); // 2026-10-07：案内はログに残さない
    speak(msg);
  }
}

// キャラクターごとの試聴セリフマップ
const voiceSamples = {
  "12": "きのぴぃ、お疲れさま！今日も一日マイペースでいこう！",
  "51": "きのぴぃ、お疲れ様です。順調に進んでいますね。",
  "64": "きのぴぃ、お疲れさまですぅ。一息ついていきましょうね。",
  "39": "きのぴぃ、今日も絶好調ですね！一緒に頑張りましょう！",
  "11": "きのぴぃ、お疲れさま。今日もいい調子で進んでるね。",
  "21": "きのぴぃ、無理しすぎないでね。休むのも仕事だよ。",
  "13": "きのぴぃ、気合入れていこうぜ！応援してるからな！",
  "52": "きのぴぃ、お主の頑張りはしかと見届けておるぞ。",
  "8": "きのぴぃ、お疲れさま〜！何か手伝えることある？",
  "2": "きのぴぃ、お疲れさまですわ！今日も完璧ですわね。",
  "3": "きのぴぃ、お疲れなのだ！ボクがいつでも応援してるのだ！",
  "10": "きのぴぃ、お疲れさまです。無理せずゆっくり深呼吸してくださいね。",
  "os": "お疲れさまです、きのぴぃ！何でも声をかけてくださいね。"
};

// OS標準音声を動的に取得してセレクトボックスに反映
function populateOsVoiceOptions() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const jaVoices = voices.filter(v => v.lang.includes("ja") || v.lang.includes("JP"));

  // 1. メイン音声セレクトボックスのOSボイスグループ更新
  if (elements.voiceSpeaker) {
    let osGroup = elements.voiceSpeaker.querySelector('optgroup[data-type="os-voices"]');
    if (!osGroup) {
      osGroup = document.createElement("optgroup");
      osGroup.label = "💻 OS標準音声（完全オフライン・高速・安定）";
      osGroup.setAttribute("data-type", "os-voices");
      elements.voiceSpeaker.appendChild(osGroup);
    }

    if (jaVoices.length === 0) {
      osGroup.innerHTML = `
        <option value="os:Otoya">macOS/iOS: Otoya (日本語・男性)</option>
        <option value="os:Kyoko">macOS/iOS: Kyoko (日本語・女性)</option>
        <option value="os:Siri">macOS/iOS: Siri (日本語)</option>
        <option value="os">OS標準 自動選択</option>
      `;
    } else {
      osGroup.innerHTML = jaVoices.map(v => {
        const isMale = /otoya|hattori|male|男/i.test(v.name);
        const isFemale = /kyoko|female|女/i.test(v.name);
        const genderLabel = isMale ? " (男性)" : isFemale ? " (女性)" : "";
        return `<option value="os:${v.name}">OS: ${v.name}${genderLabel}</option>`;
      }).join("") + '<option value="os">OS標準 自動選択</option>';
    }

    if (state.voiceSpeaker) {
      elements.voiceSpeaker.value = state.voiceSpeaker;
    }
  }

  // 2. 予備・オフライン音声セレクトボックス更新
  if (elements.voiceFallbackSpeaker) {
    if (jaVoices.length === 0) {
      elements.voiceFallbackSpeaker.innerHTML = `
        <option value="os:Otoya">macOS/iOS: Otoya (日本語・男性)</option>
        <option value="os:Kyoko">macOS/iOS: Kyoko (日本語・女性)</option>
        <option value="os:Siri">macOS/iOS: Siri (日本語)</option>
        <option value="os">OS標準 自動選択</option>
      `;
    } else {
      elements.voiceFallbackSpeaker.innerHTML = jaVoices.map(v => {
        const isMale = /otoya|hattori|male|男/i.test(v.name);
        const isFemale = /kyoko|female|女/i.test(v.name);
        const genderLabel = isMale ? " (男性)" : isFemale ? " (女性)" : "";
        return `<option value="os:${v.name}">OS: ${v.name}${genderLabel}</option>`;
      }).join("") + '<option value="os">OS標準 自動選択</option>';
    }

    if (state.voiceFallbackSpeaker) {
      elements.voiceFallbackSpeaker.value = state.voiceFallbackSpeaker;
    }
  }

  updateVoiceSettingsUI();
}

function updateVoiceSettingsUI() {
  if (!elements.voiceSpeaker || !elements.fallbackVoiceGroup) return;
  const isPrimaryOs = elements.voiceSpeaker.value.startsWith("os");
  if (isPrimaryOs) {
    elements.fallbackVoiceGroup.style.opacity = "0.5";
    if (elements.voiceFallbackSpeaker) elements.voiceFallbackSpeaker.disabled = true;
    if (elements.voiceFallbackPitch) elements.voiceFallbackPitch.disabled = true;
    if (elements.voiceFallbackRate) elements.voiceFallbackRate.disabled = true;
    if (elements.btnVoiceFallbackPreview) elements.btnVoiceFallbackPreview.disabled = true;
  } else {
    elements.fallbackVoiceGroup.style.opacity = "1.0";
    if (elements.voiceFallbackSpeaker) elements.voiceFallbackSpeaker.disabled = false;
    if (elements.voiceFallbackPitch) elements.voiceFallbackPitch.disabled = false;
    if (elements.voiceFallbackRate) elements.voiceFallbackRate.disabled = false;
    if (elements.btnVoiceFallbackPreview) elements.btnVoiceFallbackPreview.disabled = false;
  }
}

if (elements.voiceSpeaker) {
  elements.voiceSpeaker.addEventListener("change", updateVoiceSettingsUI);
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = populateOsVoiceOptions;
  setTimeout(populateOsVoiceOptions, 100);
}

// ==========================================
// 音声合成 (VOICEVOX ＆ iOS Web Speech 最適化)
// ==========================================
// 発音・読み替え辞書置換（ユーザー登録ルールに基づくTTS発話テキスト置換）
function applyVoiceDictionary(text) {
  if (!text || !state.voiceReplaceDict) return text;
  let result = text;
  const lines = state.voiceReplaceDict.split('\n');
  const rules = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const delimiterIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
    if (delimiterIndex > 0) {
      const word = trimmed.substring(0, delimiterIndex).trim();
      const reading = trimmed.substring(delimiterIndex + 1).trim();
      if (word && reading) {
        rules.push({ word, reading });
      }
    }
  }

  // 長い単語から優先して置換（部分一致の衝突防止）
  rules.sort((a, b) => b.word.length - a.word.length);

  for (const rule of rules) {
    const escaped = rule.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), rule.reading);
  }
  return result;
}

function cleanTextForSpeech(raw) {
  if (!raw) return '';
  let text = String(raw)
    .replace(/```[\s\S]*?```/g, '') // コードブロック除去
    .replace(/`([^`]+)`/g, '$1')     // インラインコード
    .replace(/https?:\/\/\S+/g, '')  // URL除去
    // カッコ内のト書き・アクション描写・補足を除去（全角・半角丸カッコ、二重カッコ等）
    .replace(/（[\s\S]*?）/g, '')
    .replace(/\([\s\S]*?\)/g, '')
    .replace(/【[\s\S]*?】/g, '')
    .replace(/〔[\s\S]*?〕/g, '')
    // Markdown記号やチェックボックス
    .replace(/\[\s*\]/g, '')
    .replace(/\[x\]/gi, '')
    .replace(/[-*#_~>]/g, ' ')
    // 連続する点・三点リーダー・句読点を整える
    .replace(/[・…\.]{2,}/g, ' ')
    .replace(/\n+/g, '、')
    .replace(/[、\s]+([、。！？!?])/g, '$1')
    .replace(/([。！？!?])[、。]+/g, '$1')
    .trim();

  // 発音・読み替え辞書を適用（ユーザー登録ルール）
  text = applyVoiceDictionary(text);

  // 先頭・末尾の記号・読点を除去（末尾の句点や！？は維持）
  text = text.replace(/^[、。・…\s]+/, '').replace(/[、・…\s]+$/, '').trim();

  // 文字列全体が記号や空白のみの場合は空文字にする（発話・口パクをスキップ）
  if (!/[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) {
    return '';
  }

  return text.replace(/\s+/g, ' ');
}

function speak(text) {
  if (!state.voiceEnabled) return;

  // ト書き等を除去した結果、発話する実テキストがない場合は音声再生をスキップ
  if (!cleanTextForSpeech(text)) return;

  unlockAudioContext();

  // 既存の音声を即時完全停止
  if (state.currentAudioSource) {
    try { state.currentAudioSource.stop(); } catch (e) {}
    state.currentAudioSource = null;
  }
  if (state.sharedAudio) {
    try { state.sharedAudio.pause(); } catch (e) {}
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // バックグラウンドで非同期実行（UIイベントループを一切ブロックしない）
  (async () => {
    try {
      if (!state.voiceSpeaker.startsWith("os") && state.voiceSpeaker !== "os") {
        try {
          await speakWithVoicevox(text, state.voiceSpeaker, state.voiceRate, state.voicePitch);
          return;
        } catch (err) {
          console.warn("VOICEVOX failed, fallback to Web Speech:", err);
        }
      }
      const isPrimary = state.voiceSpeaker.startsWith("os");
      const voiceToUse = isPrimary ? state.voiceSpeaker : (state.voiceFallbackSpeaker || "os:Otoya");
      const rate = isPrimary ? state.voiceRate : state.voiceFallbackRate;
      const pitch = isPrimary ? state.voicePitch : state.voiceFallbackPitch;
      speakWithWebSpeech(text, rate, pitch, voiceToUse);
    } catch (e) {
      console.error("PWA speech synthesis error:", e);
    }
  })();
}

// Web Audio API によるピッチ・速度対応の高品質再生コンテキスト
let pwaAudioContextInstance = null;
function getPwaAudioContext() {
  if (!pwaAudioContextInstance) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      pwaAudioContextInstance = new AudioCtx();
    }
  }
  if (pwaAudioContextInstance && pwaAudioContextInstance.state === "suspended") {
    pwaAudioContextInstance.resume();
  }
  return pwaAudioContextInstance;
}

async function speakWithVoicevox(text, speakerId, rate = state.voiceRate, pitch = state.voicePitch) {
  // 既存の再生音声を即時完全停止（多重再生・割り込み防止）
  if (state.currentAudioSource) {
    try { state.currentAudioSource.stop(); } catch (e) {}
    state.currentAudioSource = null;
  }
  if (state.sharedAudio) {
    try { state.sharedAudio.pause(); } catch (e) {}
  }

  const cleanText = cleanTextForSpeech(text).slice(0, 150);
  if (!cleanText) return;

  let arrayBuffer = null;

  // 1. ローカル VOICEVOX Engine (localhost:50021・超高速チェック 400ms)
  try {
    const localQueryCtrl = new AbortController();
    const lqTimer = setTimeout(() => localQueryCtrl.abort(), 400);
    const localQuery = await fetch(`http://localhost:50021/audio_query?text=${encodeURIComponent(cleanText)}&speaker=${speakerId}`, {
      method: "POST",
      signal: localQueryCtrl.signal
    });
    clearTimeout(lqTimer);

    if (localQuery.ok) {
      const queryJson = await localQuery.json();
      queryJson.speedScale = rate;
      queryJson.pitchScale = (pitch - 1.0) * 0.15;
      const localSynthCtrl = new AbortController();
      const lsTimer = setTimeout(() => localSynthCtrl.abort(), 1200);
      const localSynth = await fetch(`http://localhost:50021/synthesis?speaker=${speakerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryJson),
        signal: localSynthCtrl.signal
      });
      clearTimeout(lsTimer);
      if (localSynth.ok) {
        arrayBuffer = await localSynth.arrayBuffer();
      }
    }
  } catch (e) {}

  // 2026-10-07：外部へ送るのは設定でオンにしたときだけ。オフなら呼び出し元が端末の音声に切り替える
  if (!arrayBuffer && !state.voiceExternalTts) {
    throw new Error("ローカルの VOICEVOX が無く、外部の音声合成はオフです");
  }

  // 2. ローカルがない場合は公開 VOICEVOX WebAPI を使用
  if (!arrayBuffer) {
    const webApiUrl = `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(cleanText)}&speaker=${speakerId}`;

    const ttsCtrl = new AbortController();
    const ttsTimer = setTimeout(() => ttsCtrl.abort(), 2500);
    const res = await fetch(webApiUrl, { signal: ttsCtrl.signal });
    clearTimeout(ttsTimer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let audioUrl = data.mp3StreamingUrl || data.mp3DownloadUrl;

    if (!audioUrl && data.audioStatusUrl) {
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
          const sCtrl = new AbortController();
          const sTimer = setTimeout(() => sCtrl.abort(), 800);
          const sRes = await fetch(data.audioStatusUrl, { signal: sCtrl.signal });
          clearTimeout(sTimer);
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.isAudioReady && (sData.mp3StreamingUrl || sData.mp3DownloadUrl)) {
              audioUrl = sData.mp3StreamingUrl || sData.mp3DownloadUrl;
              break;
            }
            if (sData.isAudioError) {
              throw new Error(sData.errorMessage || "Audio generation failed");
            }
          }
        } catch (pollErr) {
          console.warn("PWA audio poll warning:", pollErr);
        }
      }
    }

    if (!audioUrl) throw new Error("No audio URL available");

    // 音声バイナリを取得（最大2.5s）
    const aCtrl = new AbortController();
    const aTimer = setTimeout(() => aCtrl.abort(), 2500);
    const audioRes = await fetch(audioUrl, { signal: aCtrl.signal });
    clearTimeout(aTimer);
    if (!audioRes.ok) throw new Error(`Audio fetch failed: ${audioRes.status}`);
    arrayBuffer = await audioRes.arrayBuffer();
  }

  const audioCtx = getPwaAudioContext();
  if (!audioCtx) throw new Error("AudioContext not available");

  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  return new Promise((resolve, reject) => {
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = rate;

    // ピッチ変調 (detune: 100 cents = 1半音, 1200 cents = 1オクターブ)
    if (source.detune) {
      source.detune.value = (pitch - 1.0) * 1200;
    }

    source.connect(audioCtx.destination);
    state.currentAudioSource = source;

    let isDone = false;
    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      state.isSpeaking = false;
      if (state.currentAudioSource === source) {
        state.currentAudioSource = null;
      }
      if (elements.speakingIndicator) elements.speakingIndicator.classList.add("hidden");
      stopLipSync();
    };

    source.onended = () => {
      cleanup();
      resolve();
    };

    // セーフティタイマー（最大10秒で必ず自動クリーンアップ＆完了）
    setTimeout(() => {
      if (!isDone) {
        cleanup();
        resolve();
      }
    }, 10000);

    state.isSpeaking = true;
    if (elements.speakingIndicator) elements.speakingIndicator.classList.remove("hidden");
    startLipSync();

    try {
      source.start(0);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

// 表情・カット制御 (7 Cuts Management)
let currentCutOverride = null;
let lipSyncTimer = null;

function getAvatarImgs() {
  const list = [];
  const m = document.getElementById("mascot-avatar-img");
  if (m) list.push(m);
  const c = document.getElementById("chat-char-avatar-img");
  if (c) list.push(c);
  return list;
}

function getBaseAvatarSrc() {
  if (state.activeTimer || state.timerSecondsRemaining > 0) {
    return "assets/06_sleepy.png";
  }
  return "assets/01_normal.png";
}

function getCurrentCutSrc() {
  const cutMap = {
    normal: "assets/01_normal.png",
    speaking: "assets/02_speaking.png",
    happy: "assets/03_happy.png",
    worried: "assets/04_worried.png",
    snack: "assets/05_snack.png",
    sleepy: "assets/06_sleepy.png",
    wait: "assets/07_wait.png",
    paper: "assets/08_paper.png",
    drink: "assets/09_drink.png",
    towel: "assets/10_towel.png",
    stretch: "assets/11_stretch.png",
    memo: "assets/12_memo.png",
    breathe: "assets/13_breathe.png",
    breathe_in: "assets/13_breathe_in.png",
    breathe_out: "assets/13_breathe_out.png",
    yawn: "assets/14_yawn.png",
    look_far: "assets/15_look_far.png",
    one_leg: "assets/16_one_leg.png"
  };
  if (currentCutOverride && cutMap[currentCutOverride]) {
    return cutMap[currentCutOverride];
  }
  return getBaseAvatarSrc();
}

let pwaBreatheAnimationTimer = null;

function setAvatarCut(cutName, durationMs = 0) {
  const imgs = getAvatarImgs();
  if (imgs.length === 0) return;
  if (pwaBreatheAnimationTimer) {
    clearTimeout(pwaBreatheAnimationTimer);
    pwaBreatheAnimationTimer = null;
  }

  const cutMap = {
    normal: "assets/01_normal.png",
    speaking: "assets/02_speaking.png",
    happy: "assets/03_happy.png",
    worried: "assets/04_worried.png",
    snack: "assets/05_snack.png",
    sleepy: "assets/06_sleepy.png",
    wait: "assets/07_wait.png",
    paper: "assets/08_paper.png",
    drink: "assets/09_drink.png",
    towel: "assets/10_towel.png",
    stretch: "assets/11_stretch.png",
    memo: "assets/12_memo.png",
    breathe: "assets/13_breathe_in.png",
    breathe_in: "assets/13_breathe_in.png",
    breathe_out: "assets/13_breathe_out.png",
    yawn: "assets/14_yawn.png",
    look_far: "assets/15_look_far.png",
    one_leg: "assets/16_one_leg.png"
  };

  // 深呼吸アニメーション（すー[吸う] -> はー[吐く]）
  if (cutName === "breathe" && durationMs > 3500) {
    currentCutOverride = "breathe_in";
    imgs.forEach(img => { img.src = cutMap.breathe_in; });
    pwaBreatheAnimationTimer = setTimeout(() => {
      if (currentCutOverride === "breathe_in") {
        currentCutOverride = "breathe_out";
        getAvatarImgs().forEach(img => { img.src = cutMap.breathe_out; });
      }
    }, 3500);
  } else {
    const src = cutMap[cutName] || getBaseAvatarSrc();
    imgs.forEach(img => { img.src = src; });
  }

  if (durationMs > 0) {
    currentCutOverride = cutName === "breathe" ? "breathe_in" : cutName;
    setTimeout(() => {
      if (currentCutOverride === cutName || currentCutOverride === "breathe_in" || currentCutOverride === "breathe_out") {
        currentCutOverride = null;
        if (!state.isSpeaking) {
          getAvatarImgs().forEach(img => { img.src = getBaseAvatarSrc(); });
        }
      }
    }, durationMs);
  } else if (cutName === "normal") {
    currentCutOverride = null;
  }
}

let lipSyncEndTimeout = null;

function startLipSync(durationMs = 0, isTts = false) {
  stopLipSync();
  const imgs = getAvatarImgs();
  if (imgs.length === 0) return;
  // 特殊ポーズ（片足立ち、あくび、深呼吸、水分補給等）の表示中は口パクで上書きせずポーズを維持
  if (currentCutOverride && currentCutOverride !== "normal" && currentCutOverride !== "speaking") {
    return;
  }
  let open = false;
  lipSyncTimer = setInterval(() => {
    if (isTts && !state.isSpeaking) {
      stopLipSync();
      return;
    }
    open = !open;
    const src = open ? "assets/02_speaking.png" : getCurrentCutSrc();
    getAvatarImgs().forEach(img => { img.src = src; });
  }, 160);

  if (durationMs > 0) {
    lipSyncEndTimeout = setTimeout(() => {
      stopLipSync();
    }, durationMs);
  }
}

function stopLipSync() {
  if (lipSyncTimer) {
    clearInterval(lipSyncTimer);
    lipSyncTimer = null;
  }
  if (lipSyncEndTimeout) {
    clearTimeout(lipSyncEndTimeout);
    lipSyncEndTimeout = null;
  }
  getAvatarImgs().forEach(img => { img.src = getCurrentCutSrc(); });
}

// 深夜判定（23:30〜05:00）
function isLateNight() {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  if (hour === 23 && min >= 30) return true;
  if (hour >= 0 && hour < 5) return true;
  return false;
}

// ストップ・制止（ブレーキ）判定
function checkBrakeIntent(userText, replyText) {
  const combined = `${userText || ""} ${replyText || ""}`;
  const brakeKeywords = [
    "徹夜", "寝てない", "休めない", "終わらない", "限界", "死にそう", "無理して", "倒れそう",
    "ちょっと待て", "無理するな", "ストップ", "休んで", "休もう", "寝よう", "寝なさい", "一旦落ち着け", "落ち着け",
    "夜更かし", "早く寝"
  ];
  if (brakeKeywords.some(kw => combined.includes(kw))) return true;
  if (isLateNight() && /(仕事|タスク|作業|開発|コード|終わら|進捗|これから)/.test(userText || "")) {
    return true;
  }
  return false;
}

// PWAミニフローティング吹き出し制御（常時表示仕様・チラつき完全防止）
function showPwaFloatingBubble(text) {
  const bubbleEl = elements.mascotFloatingBubble;
  const bubbleTextEl = elements.mascotFloatingBubbleText;
  if (!bubbleEl || !bubbleTextEl) return;

  const targetText = (text || "").trim();
  const currentText = (bubbleTextEl.textContent || "").trim();

  // すでに同じ内容が表示中の場合は何もしない
  if (currentText === targetText && !bubbleEl.classList.contains("hidden") && !bubbleEl.classList.contains("fade-out")) {
    return;
  }

  bubbleTextEl.textContent = text;
  bubbleEl.classList.remove("hidden", "fade-out");

  // 吹き出し表示時に口パクアニメーションを連動発火
  const duration = Math.min(5000, Math.max(1600, (text || '').length * 80));
  startLipSync(duration, false);

  // 吹き出しタップでチャットを開く
  bubbleEl.onclick = (e) => {
    e.stopPropagation();
    openChatPanel();
  };
}

function hidePwaFloatingBubble(immediate = false) {
  const bubbleEl = elements.mascotFloatingBubble;
  if (!bubbleEl) return;

  if (immediate) {
    bubbleEl.classList.add("hidden");
  } else {
    bubbleEl.classList.add("fade-out");
    setTimeout(() => {
      bubbleEl.classList.add("hidden");
    }, 300);
  }
}

const TASK_ICON_SVGS = {
  play: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="#4A3F35" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><path d="M7 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L8.54 5.98C7.87 5.55 7 6.03 7 6.82z"/></svg>',
  clock: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>',
  pin: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  list: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>',
  done: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  warn: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#D97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  target: '<svg class="task-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; display: inline-block; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
};

function renderPwaTaskIcon(el, icon) {
  if (!el) return;
  if (icon === '▶️' || icon === '▶') {
    el.innerHTML = TASK_ICON_SVGS.play;
  } else if (icon === '⏳') {
    el.innerHTML = TASK_ICON_SVGS.clock;
  } else if (icon === '📍') {
    el.innerHTML = TASK_ICON_SVGS.pin;
  } else if (icon === '📋') {
    el.innerHTML = TASK_ICON_SVGS.list;
  } else if (icon === '🎉' || icon === '✅') {
    el.innerHTML = TASK_ICON_SVGS.done;
  } else if (icon === '⚠️') {
    el.innerHTML = TASK_ICON_SVGS.warn;
  } else if (icon === '🎯') {
    el.innerHTML = TASK_ICON_SVGS.target;
  } else {
    el.textContent = icon;
  }
}

// アバター下の横長1行予定枠の更新 (PWA用)
function updatePwaCharacterTaskBar(icon, text, title = "") {
  if (elements.pwaCharTaskIcon) renderPwaTaskIcon(elements.pwaCharTaskIcon, icon);
  if (elements.pwaCharTaskText) elements.pwaCharTaskText.textContent = text;
  if (elements.mascotTaskBar && title) elements.mascotTaskBar.title = title;
}

function speakWithWebSpeech(text, rate = state.voiceRate, pitch = state.voicePitch, preferredVoice = state.voiceSpeaker) {
  if (!("speechSynthesis" in window)) return;

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) return;

  window.speechSynthesis.cancel();

  const uttr = new SpeechSynthesisUtterance(cleanText);
  uttr.lang = "ja-JP";

  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = null;

  if (preferredVoice && preferredVoice.startsWith("os:")) {
    const targetName = preferredVoice.replace(/^os:/, "").toLowerCase();
    selectedVoice = voices.find(v => v.name.toLowerCase().includes(targetName));
  }

  if (!selectedVoice) {
    selectedVoice = voices.find(v => (v.lang.includes("ja") || v.lang.includes("JP")) && /otoya/i.test(v.name))
                 || voices.find(v => (v.lang.includes("ja") || v.lang.includes("JP")) && /kyoko/i.test(v.name))
                 || voices.find(v => v.lang.includes("ja") || v.lang.includes("JP"));
  }

  if (selectedVoice) {
    uttr.voice = selectedVoice;
  }

  // voice設定後にピッチと速度を確実に適用
  uttr.pitch = Math.max(0.1, Math.min(2.0, pitch));
  uttr.rate = Math.max(0.1, Math.min(2.0, rate));

  uttr.onstart = () => {
    state.isSpeaking = true;
    elements.speakingIndicator.classList.remove("hidden");
    startLipSync();
  };

  uttr.onend = () => {
    state.isSpeaking = false;
    elements.speakingIndicator.classList.add("hidden");
    stopLipSync();
  };

  uttr.onerror = () => {
    state.isSpeaking = false;
    elements.speakingIndicator.classList.add("hidden");
    stopLipSync();
  };

  window.speechSynthesis.speak(uttr);
}

// ==========================================
// チャット検索機能
// ==========================================
function initChatSearchEvents() {
  elements.chatSearchInput.addEventListener("input", (e) => {
    performChatSearch(e.target.value.trim());
  });

  elements.chatSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        navigateSearch(-1);
      } else {
        navigateSearch(1);
      }
    }
  });

  elements.btnSearchPrev.addEventListener("click", () => navigateSearch(-1));
  elements.btnSearchNext.addEventListener("click", () => navigateSearch(1));
}

function clearChatSearch() {
  currentSearchResults = [];
  currentSearchIndex = -1;
  if (elements.chatSearchCount) elements.chatSearchCount.textContent = "0/0";
  const bubbles = elements.chatTimeline.querySelectorAll(".bubble-text");
  bubbles.forEach((el) => {
    el.innerHTML = escapeHtml(el.textContent);
  });
}

function performChatSearch(query) {
  clearChatSearch();
  if (!query || !elements.chatTimeline) return;

  const bubbles = elements.chatTimeline.querySelectorAll(".bubble-text");
  const queryLower = query.toLowerCase();

  bubbles.forEach((el) => {
    const rawText = el.textContent;
    if (rawText.toLowerCase().includes(queryLower)) {
      const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
      el.innerHTML = escapeHtml(rawText).replace(regex, '<mark class="search-highlight">$1</mark>');
    }
  });

  currentSearchResults = Array.from(elements.chatTimeline.querySelectorAll(".search-highlight"));
  if (currentSearchResults.length > 0) {
    currentSearchIndex = 0;
    updateSearchUI();
    scrollToSearchResult(0);
  } else {
    if (elements.chatSearchCount) elements.chatSearchCount.textContent = "0/0";
  }
}

function navigateSearch(direction) {
  if (currentSearchResults.length === 0) return;
  currentSearchIndex = (currentSearchIndex + direction + currentSearchResults.length) % currentSearchResults.length;
  updateSearchUI();
  scrollToSearchResult(currentSearchIndex);
}

function updateSearchUI() {
  if (elements.chatSearchCount) {
    elements.chatSearchCount.textContent = `${currentSearchIndex + 1}/${currentSearchResults.length}`;
  }
  currentSearchResults.forEach((mark, idx) => {
    if (idx === currentSearchIndex) {
      mark.classList.add("active-match");
    } else {
      mark.classList.remove("active-match");
    }
  });
}

function scrollToSearchResult(index) {
  const mark = currentSearchResults[index];
  if (mark) {
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================
// 過去ログ読み込み & タイムライン構築
// ==========================================

function formatDateLabel(dateObj) {
  const d = (dateObj instanceof Date) ? dateObj : (dateObj && dateObj.dateObj instanceof Date ? dateObj.dateObj : new Date());
  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${weekDays[d.getDay()]})`;
}

function deduplicateLogs(logs) {
  if (!Array.isArray(logs)) return [];
  const seen = new Set();
  const result = [];
  logs.forEach(msg => {
    const key = normalizeLogKey(msg.time || "", msg.role || "", msg.text || "");
    if (!seen.has(key)) {
      seen.add(key);
      result.push(msg);
    }
  });
  return result;
}

function initChatTimeline() {
  elements.chatTimeline.innerHTML = "";
  state.oldestLoadedDate = getLogicalDate().dateObj;

  // 1. 最上部に過去ログ読み込みボタン
  loadPrevContainerEl = document.createElement("div");
  loadPrevContainerEl.className = "load-prev-container";
  btnLoadPrevChatEl = document.createElement("button");
  btnLoadPrevChatEl.className = "load-prev-btn";
  btnLoadPrevChatEl.textContent = "過去のチャットを読み込む";
  btnLoadPrevChatEl.addEventListener("click", loadPreviousLog);
  loadPrevContainerEl.appendChild(btnLoadPrevChatEl);
  elements.chatTimeline.appendChild(loadPrevContainerEl);

  // 2. 本日の日付セパレーター
  elements.chatTimeline.appendChild(createDateSeparatorElement(formatDateLabel(getLogicalDate().dateObj)));

  // 3. 本日のチャット読み込み（重複ログを即時自動パージ）
  const todayYmd = getTodayYmd();
  registerLogDate(todayYmd);

  const rawLogs = JSON.parse(localStorage.getItem(`companion_chat_${todayYmd}`) || "[]");
  const todayLogs = deduplicateLogs(rawLogs);
  if (rawLogs.length !== todayLogs.length) {
    localStorage.setItem(`companion_chat_${todayYmd}`, JSON.stringify(todayLogs));
  }

  let lastBotMsg = null;
  if (todayLogs.length > 0) {
    todayLogs.forEach((msg) => {
      elements.chatTimeline.appendChild(createMessageBubbleElement(msg.role, msg.text, msg.time));
      state.conversationHistory.push({ role: msg.role === "user" ? "user" : "model", text: msg.text });
      if (msg.role === "bot") lastBotMsg = msg.text;
    });
  } else {
    // クラウドから取得するまでのプレースホルダー（localStorageには保存しない）
    const welcome = "きのぴぃ、おつかれさま！サウナハット被っていつでもスタンバイしてるよ。今日何する？何でも話してね！";
    elements.chatTimeline.appendChild(createMessageBubbleElement("bot", welcome, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));
    lastBotMsg = welcome;
  }

  if (lastBotMsg) {
    showPwaFloatingBubble(lastBotMsg);
  }

  updateLoadPrevButton();
  scrollToBottom();
}

function registerLogDate(ymd) {
  if (!state.allLogDates.includes(ymd)) {
    state.allLogDates.push(ymd);
    state.allLogDates.sort();
    localStorage.setItem("companion_chat_dates", JSON.stringify(state.allLogDates));
  }
}

function findPreviousLogDate(currentDate) {
  let cur;
  if (currentDate instanceof Date && !isNaN(currentDate.getTime())) {
    cur = new Date(currentDate.getTime());
  } else if (currentDate && currentDate.dateObj instanceof Date && !isNaN(currentDate.dateObj.getTime())) {
    cur = new Date(currentDate.dateObj.getTime());
  } else if (typeof currentDate === "string") {
    cur = new Date(currentDate);
  } else {
    cur = getLogicalDate().dateObj;
  }
  cur.setHours(0, 0, 0, 0);
  const prev = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
  const ymd = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
  return { dateObj: prev, ymd: ymd, dateStr: formatDateLabel(prev) };
}

function updateLoadPrevButton() {
  if (!btnLoadPrevChatEl) return;
  const prevInfo = findPreviousLogDate(state.oldestLoadedDate);
  if (prevInfo) {
    btnLoadPrevChatEl.disabled = false;
    btnLoadPrevChatEl.textContent = `過去のチャットを読み込む (${prevInfo.dateStr})`;
    if (loadPrevContainerEl) loadPrevContainerEl.classList.remove("hidden");
  } else {
    btnLoadPrevChatEl.disabled = true;
    btnLoadPrevChatEl.textContent = "これ以上過去のチャットはありません";
  }
}

async function loadPreviousLog() {
  const prevInfo = findPreviousLogDate(state.oldestLoadedDate);
  if (!prevInfo) {
    updateLoadPrevButton();
    return;
  }

  if (btnLoadPrevChatEl) {
    btnLoadPrevChatEl.disabled = true;
    btnLoadPrevChatEl.textContent = "読み込み中...";
  }

  let logs = JSON.parse(localStorage.getItem(`companion_chat_${prevInfo.ymd}`) || "[]");
  
  // ローカルにない場合はクラウド（GAS）から取得
  if (logs.length === 0 && state.syncGasUrl) {
    try {
      const data = await fetchGasJsonp("getLogs", { date: prevInfo.ymd });
      if (data && data.success && Array.isArray(data.messages) && data.messages.length > 0) {
        logs = data.messages.map(m => ({ role: m.role, text: m.text, time: m.time }));
        localStorage.setItem(`companion_chat_${prevInfo.ymd}`, JSON.stringify(logs));
        registerLogDate(prevInfo.ymd);
      }
    } catch (err) {
      console.warn("fetch previous log from cloud error:", err);
    }
  }

  state.oldestLoadedDate = prevInfo.dateObj;

  if (logs.length > 0) {
    const prevScrollHeight = elements.chatTimeline.scrollHeight;
    const prevScrollTop = elements.chatTimeline.scrollTop;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(createDateSeparatorElement(prevInfo.dateStr));
    logs.forEach((msg) => {
      fragment.appendChild(createMessageBubbleElement(msg.role, msg.text, msg.time));
    });

    if (loadPrevContainerEl && loadPrevContainerEl.nextSibling) {
      elements.chatTimeline.insertBefore(fragment, loadPrevContainerEl.nextSibling);
    } else {
      elements.chatTimeline.appendChild(fragment);
    }

    const newScrollHeight = elements.chatTimeline.scrollHeight;
    elements.chatTimeline.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
  }

  updateLoadPrevButton();
}

function createDateSeparatorElement(label) {
  const div = document.createElement("div");
  div.className = "date-separator";
  const pill = document.createElement("span");
  pill.className = "date-separator-pill";
  pill.textContent = label;
  div.appendChild(pill);
  return div;
}

function createMessageBubbleElement(role, text, timeStr) {
  const normTime = timeStr || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const rowEl = document.createElement("div");
  rowEl.className = `chat-row ${role === "user" ? "user-row" : "bot-row"}`;
  rowEl.dataset.logKey = normalizeLogKey(normTime, role, text);

  const avatarEl = document.createElement("div");
  avatarEl.className = "chat-avatar";
  const avatarImg = document.createElement("img");
  avatarImg.src = role === "user" ? "assets/kinopy.jpg" : "assets/avatar_face_flipped.png";
  avatarImg.onerror = () => { avatarImg.src = role === "user" ? "assets/kinopy.jpg" : "assets/icon.png"; };
  avatarEl.appendChild(avatarImg);

  const containerEl = document.createElement("div");
  containerEl.className = "bubble-container";

  const bubbleEl = document.createElement("div");
  bubbleEl.className = `chat-bubble ${role === "user" ? "user-bubble" : "bot-bubble"}`;

  const metaEl = document.createElement("div");
  metaEl.className = "bubble-meta";
  const senderEl = document.createElement("span");
  senderEl.className = "bubble-sender";
  senderEl.textContent = role === "user" ? "きのぴぃ" : "Matt";

  const timeEl = document.createElement("span");
  timeEl.className = "bubble-time";
  timeEl.textContent = normTime;

  metaEl.appendChild(senderEl);
  metaEl.appendChild(timeEl);

  const textEl = document.createElement("div");
  textEl.className = "bubble-text";
  textEl.textContent = text;

  bubbleEl.appendChild(metaEl);
  bubbleEl.appendChild(textEl);
  containerEl.appendChild(bubbleEl);

  // アクション行 (右下寄せ)
  const actionsRowEl = document.createElement("div");
  actionsRowEl.className = "bubble-actions-row";

  const btnCopy = document.createElement("button");
  btnCopy.className = "bubble-action-btn";
  btnCopy.title = "コピー";
  btnCopy.textContent = "📋";
  btnCopy.onclick = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    btnCopy.textContent = "✅";
    setTimeout(() => { btnCopy.textContent = "📋"; }, 1000);
  };

  const btnMakeMemo = document.createElement("button");
  btnMakeMemo.className = "bubble-action-btn";
  btnMakeMemo.title = "メモに保存";
  btnMakeMemo.textContent = "📝";
  btnMakeMemo.onclick = (e) => {
    e.stopPropagation();
    addMemo(text);
    btnMakeMemo.textContent = "✅";
    setTimeout(() => { btnMakeMemo.textContent = "📝"; }, 1000);
  };

  actionsRowEl.appendChild(btnCopy);
  actionsRowEl.appendChild(btnMakeMemo);
  containerEl.appendChild(actionsRowEl);

  if (role === "user") {
    rowEl.appendChild(containerEl);
    rowEl.appendChild(avatarEl);
  } else {
    rowEl.appendChild(avatarEl);
    rowEl.appendChild(containerEl);
  }

  return rowEl;
}

let currentPwaThinkingRowEl = null;

function showThinkingIndicator(label = "考え中...") {
  hideThinkingIndicator();

  if (elements.aiStatusIndicator) {
    elements.aiStatusIndicator.textContent = `✨ ${label}`;
    elements.aiStatusIndicator.classList.remove("hidden");
  }

  if (elements.chatTimeline) {
    const rowEl = document.createElement("div");
    rowEl.className = "typing-indicator-row";
    rowEl.id = "pwa-live-typing-indicator";

    const avatarEl = document.createElement("img");
    avatarEl.className = "chat-avatar bot-avatar";
    avatarEl.src = "assets/avatar_face_flipped.png";
    avatarEl.alt = "Matt";

    const bubbleEl = document.createElement("div");
    bubbleEl.className = "typing-bubble";

    const textEl = document.createElement("div");
    textEl.className = "typing-text";
    textEl.innerHTML = `<span>${label}</span><span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>`;

    bubbleEl.appendChild(textEl);
    rowEl.appendChild(avatarEl);
    rowEl.appendChild(bubbleEl);

    elements.chatTimeline.appendChild(rowEl);
    scrollToBottom();
    currentPwaThinkingRowEl = rowEl;
  }

  if (!state.isPanelOpen) {
    showPwaFloatingBubble(`💭 ${label}`);
  }
}

function hideThinkingIndicator() {
  if (currentPwaThinkingRowEl && currentPwaThinkingRowEl.parentNode) {
    currentPwaThinkingRowEl.parentNode.removeChild(currentPwaThinkingRowEl);
  }
  currentPwaThinkingRowEl = null;
  const existing = document.getElementById("pwa-live-typing-indicator");
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  if (elements.aiStatusIndicator) {
    elements.aiStatusIndicator.classList.add("hidden");
  }
}

function addMessageBubble(role, text, timeStr, shouldSave = true) {
  hideThinkingIndicator();
  if (!timeStr) {
    timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const rowEl = createMessageBubbleElement(role, text, timeStr);
  elements.chatTimeline.appendChild(rowEl);
  scrollToBottom();

  if (role === "bot") {
    lastBotSpeechText = text;
    if (!state.isPanelOpen) {
      showPwaFloatingBubble(text);
      if (window.showPwaUnreadBadge) window.showPwaUnreadBadge();
    }
  }

  state.conversationHistory.push({
    role: role === "user" ? "user" : "model",
    text: text
  });
  if (state.conversationHistory.length > 20) {
    state.conversationHistory.shift();
  }

  if (shouldSave) {
    pwaLastChatAt = Date.now();
    const todayYmd = getTodayYmd();
    registerLogDate(todayYmd);
    try {
      const logs = safeJsonParseArray_(`companion_chat_${todayYmd}`);
      logs.push({ role, text, time: timeStr });
      localStorage.setItem(`companion_chat_${todayYmd}`, JSON.stringify(logs));
    } catch (e) {
      console.warn("local chat log save failed:", e);
    }

    // GASクラウド (Google Drive / Vault) への同期（未送信キュー経由・Step3.5）
    syncAppendLogToGas(role, text, timeStr);
  }
}

function scrollToBottom() {
  setTimeout(() => {
    elements.chatTimeline.scrollTop = elements.chatTimeline.scrollHeight;
  }, 50);
}

// ==========================================
// メッセージ送信・チャットロジック
// ==========================================
async function handleUserSend() {
  const text = elements.userInput.value.trim();
  if (!text) return;

  // 入力欄を完全にクリア
  elements.userInput.value = "";
  elements.userInput.style.height = "auto";

  // メモ保存待機モードのハンドリング
  if (state.waitingForMemo) {
    state.waitingForMemo = false;
    elements.userInput.placeholder = state.isCoachingMode ? "💡 モヤモヤしていることを話してみて (⌘+Enterで送信)..." : "メッセージを入力 (⌘+Enterで送信)...";
    addMessageBubble("user", text, null, true);
    addMemo(text);
    speak("メモを保存しました！");
    return;
  }

  // モヤモヤ壁打ちモード中の終了検知
  if (state.isCoachingMode) {
    state.coachingTurnCount++;
    if (/^(ありがとう|スッキリした|解決した|また後で|整理できた|大丈夫|ok|おわり|終わり|サンキュー)/i.test(text)) {
      state.isCoachingMode = false;
      elements.userInput.placeholder = "メッセージを入力 (⌘+Enterで送信)...";
    }
  }

  addMessageBubble("user", text, null, true);

  if (handleSpecialCommands(text)) {
    return;
  }

  if (state.geminiEnabled && state.geminiApiKey) {
    showThinkingIndicator("Mattが思考中...");
    await callGeminiApi(text);
  } else {
    handleBuiltinResponse(text);
  }
}

function getPwaDailySummary() {
  const tasks = state.todayAllTasks || [];
  let doneTasks = 0, excludedTasks = 0;
  tasks.forEach(t => {
    if (t.status === '翌日移動') { excludedTasks++; return; }
    if (t.isDone || t.status === '完了') doneTasks++;
    else if (t.status === '中止' || t.status === '不要') excludedTasks++;
  });
  const totalTasks = Math.max(0, tasks.length - excludedTasks);
  const remainingTasks = Math.max(0, totalTasks - doneTasks);
  const running = tasks.find(t => t.status === '実行中');
  return {
    totalTasks,
    doneTasks,
    remainingTasks,
    currentTaskTitle: running ? running.title : null
  };
}

async function callGeminiApi(userPrompt) {
  const contents = state.conversationHistory.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }]
  }));

  const summary = getPwaDailySummary();
  const taskLine = (state.todayAllTasks && state.todayAllTasks.length > 0) ?
    `\n- Kumapyタスク: 総数${summary.totalTasks}件・完了${summary.doneTasks}件・未完了${summary.remainingTasks}件${summary.currentTaskTitle ? `（現在「${summary.currentTaskTitle}」を計測中）` : ''}` :
    '';
  const weatherLine = state.todayWeather ? 
    `\n- 本日の気象 (${state.todayWeather.location}): ${state.todayWeather.weather} (最高 ${state.todayWeather.maxTemp}℃ / 最低 ${state.todayWeather.minTemp}℃, 降水 ${state.todayWeather.precipitation}mm)` : 
    '';
  const sleepLine = state.todaySleep ? 
    `\n- 昨夜の睡眠: ${state.todaySleep.durationText}${state.todaySleep.score ? ` (スコア ${state.todaySleep.score}点)` : ''}` : 
    '';

  const coachingInstruction = state.isCoachingMode ? `
【現在：思考整理・モヤモヤ壁打ちモード進行中】
- あなたは今、きのぴぃの思考の整理・モヤモヤ解消を助けるコーチ・壁打ち相手です。
- ユーザーの話を受け止めて共感し、思考をほぐす客観的な問いかけ（「一番引っかかっているのは何？」「本当はどうなると最高？」など）を1つだけ投げかけてください。
- もしユーザーの思考がまとまってきた時や、要約・解決策を求めている時は、スッキリ3行以内の箇条書き（【要点整理】現状・ボトルネック・次の最小の1歩）でまとめ、メモ保存を勧めてください。` : '';

  const dynamicPrompt = `${getSystemPrompt_()}${taskLine}${weatherLine}${sleepLine}${coachingInstruction}`;

  const payload = {
    system_instruction: {
      parts: [{ text: dynamicPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };

  // 2026-10-07：1.5 系は提供終了、2.5-flash は新規には 404 のため最新の flash の別名を先に。1モデル15秒まで。キーはヘッダーで送る
  const modelsToTry = ["gemini-flash-latest", "gemini-2.5-flash"];
  let data = null;
  let lastErr = null;

  try {
    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": state.geminiApiKey },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });
        clearTimeout(timer);

        const json = await res.json();
        if (res.ok && !json.error) {
          data = json;
          break;
        } else {
          lastErr = new Error(`HTTP ${res.status}`);
        }
      } catch (e) {
        lastErr = e;
      }
    }

    hideThinkingIndicator();

    if (!data) {
      console.error("Gemini Error across all models:", lastErr && lastErr.message);
      updateBadgeState("error");
      handleBuiltinResponse(userPrompt, aiFailReason_(lastErr));
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    const parts = candidate?.content?.parts || [];
    const textPart = parts.find(p => !p.thought && p.text) || parts[parts.length - 1];
    const replyText = textPart?.text?.trim() || "";
    if (!replyText) {
      // 2026-10-07（GC-27）：空の返事を「（返答を生成できませんでした）」として保存しない
      updateBadgeState("error");
      handleBuiltinResponse(userPrompt, "空の返事");
      return;
    }
    updateBadgeState(); // 成功時はアクティブ状態に戻す

    if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
      recordTokenUsage(data.usageMetadata.totalTokenCount);
    }

    if (checkBrakeIntent(userPrompt, replyText)) {
      setAvatarCut("wait", 10000);
    } else if (/朝刊|新聞|ニュース|kinopy-times|times|トップ記事|今日のフォーカス/i.test(userPrompt + " " + replyText)) {
      setAvatarCut("paper", 10000);
    }

    addMessageBubble("bot", replyText, null, true);
    speak(replyText);

  } catch (err) {
    hideThinkingIndicator();
    updateBadgeState("error");
    console.error("Fetch Gemini error:", err && err.message);
    handleBuiltinResponse(userPrompt, aiFailReason_(err));
  }
}

// 2026-10-07（GC-27）：AI に接続できず定型の返事を出したときの注意書き（会話の記憶にもログにも入れない）
function aiFailReason_(err) {
  const msg = String((err && (err.message || err.status || err)) || "");
  if (err && err.name === "AbortError") return "時間切れ";
  const m = msg.match(/HTTP (\d{3})/);
  if (m) return "HTTP " + m[1];
  if (/空の返事/.test(msg)) return "空の返事";
  if (/JSON/.test(msg)) return "返事の形が不正";
  return "通信エラー";
}
function showAiFallbackNotice_(text, retryFn) {
  if (!elements.chatTimeline) return;
  const el = document.createElement("div");
  el.className = "ai-fallback-notice";
  el.style.cssText = "font-size:11px;color:#E65100;margin:4px 12px;line-height:1.5;white-space:pre-wrap;";
  el.textContent = text;
  if (retryFn) {
    const b = document.createElement("button");
    b.textContent = "もう一度送る";
    b.style.cssText = "margin-left:6px;font-size:11px;";
    b.addEventListener("click", (e) => { e.stopPropagation(); el.remove(); retryFn(); });
    el.appendChild(b);
  }
  elements.chatTimeline.appendChild(el);
  scrollToBottom();
}

function handleBuiltinResponse(text, failReason) {
  let reply = "";
  if (text.includes("おつかれ") || text.includes("疲れた") || text.includes("つかれた") || text.includes("もう無理")) {
    reply = "無理は禁物ですよ、きのぴぃ。今日はタオル投げましょう。目を休めてください。";
  } else if (/イベント|楽し|遊|参加|行っ|見て|聴い|読ん|面白|うれし|嬉しい|最高|ワクワク|満喫/.test(text)) {
    const funList = [
      'いいですね！楽しんでいるようで何よりです、きのぴぃ。存分に満喫してくださいね。',
      'お、充実してますね！良い刺激をもらってきてください。',
      '楽しそうですね！気分転換も大事なエネルギーチャージですよ。'
    ];
    reply = funList[Math.floor(Math.random() * funList.length)];
  } else if (/終わ|できた|頑張っ|完了|片付|やっ.*た/.test(text)) {
    const praiseList = [
      'お、やりましたね、きのぴぃ。ひとつ片付きました。',
      '着実に前進してますね。いい判断と集中力でしたよ。',
      '……やりますね。この調子でいきましょう。'
    ];
    reply = praiseList[Math.floor(Math.random() * praiseList.length)];
  } else if (/天気|気温|雨|晴れ|傘|暑い|寒い/.test(text)) {
    if (state.todayWeather) {
      const w = state.todayWeather;
      let note = "";
      if (w.weather.includes("雨")) note = " 傘を持ってお出かけくださいね☔️";
      else if (parseFloat(w.maxTemp) >= 30) note = " こまめに水分補給してくださいね☀️";
      reply = `今日の${w.location}のお天気は「${w.weather}」、予想気温は最高${w.maxTemp}℃ / 最低${w.minTemp}℃ですよ。${note}`;
    } else {
      reply = "本日のお天気データを確認中です。今日も良い一日を。";
    }
  } else if (/睡眠|眠り|スコア|寝た|体調/.test(text)) {
    if (state.todaySleep) {
      const s = state.todaySleep;
      const scoreNote = s.score ? `（スコア${s.score}点）` : '';
      let comment = '';
      if (parseInt(s.score || '0', 10) >= 80) comment = ' しっかり回復できてますね。';
      else if (s.durationMin > 0 && s.durationMin < 360) comment = ' 少し短めでしたね。無理せずHP温存しましょう。';
      reply = `昨夜の睡眠時間は「${s.durationText}」${scoreNote}でしたよ、きのぴぃ。${comment}`;
    } else {
      reply = "睡眠データを確認中です。体調第一でいきましょう。";
    }
  } else if (/おはよう|朝/.test(text)) {
    let notes = [];
    if (state.todayWeather) {
      notes.push(`天気は「${state.todayWeather.weather}」（最高${state.todayWeather.maxTemp}℃）`);
    }
    if (state.todaySleep && state.todaySleep.durationText) {
      notes.push(`睡眠は${state.todaySleep.durationText}`);
    }
    const noteStr = notes.length > 0 ? ` 今日は${notes.join('・')}ですね。` : ' ';
    reply = `おはようございます、きのぴぃ。${noteStr}今日もいいコンディションでいきましょう。`;
  } else if (/進捗|状況|今日.*どう|サマリ|タスク.*何|予定|スケジュール|いま何|次.*何/.test(text)) {
    const summary = getPwaDailySummary();
    reply = `今日のタスクは総数${summary.totalTasks}件・完了${summary.doneTasks}件・未完了${summary.remainingTasks}件ですよ！`;
    if (summary.currentTaskTitle) {
      reply += `\n現在は「${summary.currentTaskTitle}」を計測中ですね。`;
    }
    if (state.todayWeather) {
      reply += `\n今日の天気は「${state.todayWeather.weather}」（最高${state.todayWeather.maxTemp}℃）です。`;
    }
  } else if (text.includes("メモ")) {
    reply = "メモを残したい時は『メモ: 内容』と入力してください。しっかり保管しておきます。";
  } else if (text.includes("ありがとう") || text.includes("助かる")) {
    reply = "セコンド冥利に尽きますね。いつでも声をかけてください。";
  } else {
    const defaultList = [
      `なるほど。「${text.slice(0, 15)}」ですね。きのぴぃのペースでマイペースに進めましょう。`,
      'そうですね。焦らず、ひとつずつ整理して進めましょう。',
      'セコンドには僕がいます。きのぴぃのペースで大丈夫ですよ。',
      'うーん。一回深呼吸して、頭をクリアにしましょうか。'
    ];
    reply = defaultList[Math.floor(Math.random() * defaultList.length)];
  }

  if (checkBrakeIntent(text, reply)) {
    setAvatarCut("wait", 10000);
  } else if (/朝刊|新聞|ニュース|kinopy-times|times|トップ記事|今日のフォーカス/i.test(text + " " + reply)) {
    setAvatarCut("paper", 10000);
  } else if (/片足立ち|片足|ポーズ|バランス/i.test(text + " " + reply)) {
    setAvatarCut("one_leg", 10000);
  } else if (/深呼吸|すーはー|息を吸|息を吐/i.test(text + " " + reply)) {
    setAvatarCut("breathe", 8000);
  } else if (/あくび|ねむい|眠気|ふわぁ/i.test(text + " " + reply)) {
    setAvatarCut("yawn", 8000);
  } else if (/水分|お茶|水飲|喉乾/i.test(text + " " + reply)) {
    setAvatarCut("drink", 8000);
  } else if (/タオル|汗/i.test(text + " " + reply)) {
    setAvatarCut("towel", 8000);
  } else if (/ストレッチ|背伸び|肩こり|首/i.test(text + " " + reply)) {
    setAvatarCut("stretch", 8000);
  } else if (/メモ|記録/i.test(text + " " + reply)) {
    setAvatarCut("memo", 8000);
  } else if (/遠く|景色|リフレッシュ/i.test(text + " " + reply)) {
    setAvatarCut("look_far", 8000);
  }

  // 2026-10-07（GC-27）：AI の失敗で定型の返事にしたときは、ログに残さず注意書きを添える
  addMessageBubble("bot", reply, null, !failReason);
  if (failReason) showAiFallbackNotice_(`⚠️ AI に接続できませんでした（${failReason}）。定型の返事を表示しています（ログには残しません）`);
  speak(reply);
}

function handleSpecialCommands(text) {
  if (text.startsWith("メモ:") || text.startsWith("メモ：") || text.startsWith("memo:")) {
    const memoBody = text.replace(/^(メモ[:：]|memo:)\s*/i, "").trim();
    if (memoBody) {
      addMemo(memoBody);
      const reply = `メモ「${memoBody}」を保管しました。📋ボタンからいつでも確認・管理できますよ。`;
      addMessageBubble("bot", reply, null, true);
      speak(reply);
      return true;
    }
  }

  const timerMatch = text.match(/(\d+)\s*(分|min)/i);
  if (timerMatch && (text.includes("タイマー") || text.includes("測って") || text.includes("はかって"))) {
    const minutes = parseInt(timerMatch[1], 10);
    startTimer(minutes);
    const reply = `${minutes}分タイマーをセットしました。集中して、終わったらチャイムで知らせますね。`;
    addMessageBubble("bot", reply, null, true);
    speak(reply);
    return true;
  }

  return false;
}

// Quick Action Prompts & Fallbacks (Matt Stiller 仕様：AIセコンド、敬語7:くだけ3、真顔ユーモア)
const quickPrompts = {
  coach: {
    label: "💡 モヤモヤする…",
    prompt: "ユーザー（きのぴぃ）が仕事や日常で「モヤモヤしている・相談したい」と言っています。AIセコンド「Matt」として、急いで解決策を押し付けず、「それは、へこみますね」「今は整理します？ それとも、ちょっと聞いてればいいですか」や思考をほぐす客観的な問いかけを1〜2文（60文字以内）で返してください。「きのぴぃ」と呼びかけてください。",
    fallback: [
      "吐き出しちゃいましょう、きのぴぃ。今は整理します？ それとも、ちょっと聞いてればいいですか。",
      "何でも話してください、きのぴぃ。今、何が一番引っかかってますか？",
      "焦らなくて大丈夫ですよ。今できる最小の1歩を一緒に探しましょうか。"
    ]
  },
  snack: {
    label: "🍪 おなか減った！",
    prompt: "ユーザー（きのぴぃ）が「おなか減った・おやつ食べたい」と言っています。AIセコンド「Matt」として、責めずに真顔のユーモアを交えつつ、常温の水や素焼きナッツ、高カカオチョコなどのヘルシーな代替案を1〜2文（60文字以内）で提案してください。「きのぴぃ」と呼びかけてください。",
    fallback: [
      "おなか減りましたか、きのぴぃ。まずは常温の水を一杯飲んで、落ち着きましょう。",
      "素焼きナッツか高カカオチョコならOKですよ。一回クールダウンしましょう。",
      "温かいお茶でも一杯淹れませんか。お腹も落ち着きますよ、きのぴぃ。"
    ]
  },
  tired: {
    label: "🛌 もう無理…",
    prompt: "ユーザー（きのぴぃ）が「もう無理・力尽きた」と言っています。AIセコンド「Matt」として、「今日はもういいんじゃないですか」「セコンドとしてはタオルを投げたいところです」と休養を認め、15分タイマーでクールダウンするよう促すセリフを1〜2文（60文字以内）で出力してください。「きのぴぃ」と呼びかけてください。",
    fallback: [
      "無理は禁物ですよ、きのぴぃ。今日はタオル投げましょう。15分タイマーをセットしたので目を休めてください。",
      "限界までよく走りましたね。15分間、何も考えずにゴロンとしちゃいましょう。",
      "一旦ピットインです。目を閉じて、ゆっくり深呼吸してください。"
    ]
  }
};

async function handleQuickAction(action) {
  if (action === "memo") {
    state.waitingForMemo = true;
    elements.userInput.placeholder = "📝 保存したいメモを入力 (⌘+Enterで送信)...";
    elements.userInput.value = "";
    elements.userInput.focus();
    const promptMsg = "保存したい内容を教えてください";
    addMessageBubble("bot", promptMsg, null, true);
    speak(promptMsg);
    return;
  }

  const item = quickPrompts[action];
  if (!item) return;

  if (action === "coach") {
    state.isCoachingMode = true;
    state.coachingTurnCount = 0;
    setAvatarCut("worried", 10000);
    elements.userInput.placeholder = "💡 モヤモヤしていることを話してみて (⌘+Enterで送信)...";
    elements.userInput.focus();
  } else if (action === "snack") {
    setAvatarCut("snack", 10000);
  } else if (action === "tired") {
    setAvatarCut("sleepy", 0); // タイマー中はずっと継続
    startTimer(15);
  }

  addMessageBubble("user", item.label, null, true);

  let reply = "";
  let quickFail = ""; // 2026-10-07（GC-27）：AI を使ったのに失敗したときの理由
  // 💡 モヤモヤのみ Gemini で深く思考をほぐす。🍪 おなか減った / 🛌 もう無理 は即時定型文
  if (action === "coach" && state.geminiEnabled && state.geminiApiKey) {
    showThinkingIndicator("Mattが思考中...");
    try {
      const contents = state.conversationHistory.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts[0].text = item.prompt;
      }
      quickFail = "通信エラー"; // 2026-10-07：成功したら reply が入るので使われない

      const weatherLine = state.todayWeather ? 
        `\n- 本日の気象 (${state.todayWeather.location}): ${state.todayWeather.weather} (最高 ${state.todayWeather.maxTemp}℃ / 最低 ${state.todayWeather.minTemp}℃, 降水 ${state.todayWeather.precipitation}mm)` : 
        '';
      const coachingInstruction = `
【現在：思考整理・モヤモヤ壁打ちモード開始】
- きのぴぃがモヤモヤしていると言ってきました。AIセコンド「Matt」として、「それは、へこみますね」「今は整理します？ それとも、ちょっと聞いてればいいですか」や思考をほぐす客観的な問いかけを1〜2文（60文字以内）で返してください。「きのぴぃ」と呼びかけてください。`;

      const payload = {
        system_instruction: { parts: [{ text: `${getSystemPrompt_()}${weatherLine}${coachingInstruction}` }] },
        contents: contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
      };

      // 2026-10-07：2秒の打ち切りでほぼ毎回定型文になっていたため、1モデル15秒に。キーはヘッダーで送る
      const modelsToTry = ["gemini-flash-latest", "gemini-2.5-flash"];
      for (const modelName of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": state.geminiApiKey },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (!data.error) {
              const parts = data?.candidates?.[0]?.content?.parts || [];
              const textPart = parts.find(p => !p.thought && p.text) || parts[parts.length - 1];
              reply = textPart?.text?.trim() || "";
              if (data?.usageMetadata?.totalTokenCount) {
                recordTokenUsage(data.usageMetadata.totalTokenCount);
              }
              if (reply) break;
              quickFail = "空の返事";
            } else {
              quickFail = "HTTP " + res.status;
            }
          } else {
            quickFail = "HTTP " + res.status;
          }
        } catch (apiErr) {
          console.warn(`Gemini API error on quick action (${modelName}):`, apiErr && apiErr.message);
          quickFail = aiFailReason_(apiErr);
        }
      }
    } catch (err) {
      console.warn("Gemini quick action error:", err);
    }
  }

  hideThinkingIndicator();

  const usedFallback = !reply;
  if (!reply) {
    const candidates = item.fallback;
    reply = candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 2026-10-07（GC-27）：AI を使うはずだったのに失敗したときは、ログに残さず注意書きを添える
  const aiFailedQuick = usedFallback && quickFail;
  addMessageBubble("bot", reply, null, !aiFailedQuick);
  if (aiFailedQuick) showAiFallbackNotice_(`⚠️ AI に接続できませんでした（${quickFail}）。定型の返事を表示しています（ログには残しません）`);
  speak(reply);
}

// ==========================================
// タイマー & Web Audio チャイム
// ==========================================
function startTimer(minutes) {
  if (state.activeTimer) {
    clearInterval(state.activeTimer);
  }
  state.timerSecondsRemaining = minutes * 60;
  elements.timerBadge.classList.remove("hidden");
  updateTimerDisplay();

  state.activeTimer = setInterval(() => {
    state.timerSecondsRemaining--;
    updateTimerDisplay();

    if (state.timerSecondsRemaining <= 0) {
      clearInterval(state.activeTimer);
      state.activeTimer = null;
      elements.timerBadge.classList.add("hidden");
      playChime();
      setAvatarCut("normal");
      const msg = `きのぴぃ、${minutes}分経ったよ！お疲れさま！一息つこうね。`;
      addMessageBubble("bot", msg, null, true);
      speak(msg);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(state.timerSecondsRemaining / 60);
  const s = state.timerSecondsRemaining % 60;
  elements.timerBadge.textContent = `⏱️ ${m}:${s.toString().padStart(2, "0")}`;
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.15);
      osc.stop(ctx.currentTime + idx * 0.15 + 0.4);
    });
  } catch (e) {
    console.warn("Chime error:", e);
  }
}

// ==========================================
// メモ管理
// ==========================================
function addMemo(content) {
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const memo = {
    id: Date.now().toString(),
    text: content,
    date: new Date().toLocaleDateString("ja-JP"),
    serverDate: getTodayYmd(),
    archived: false
  };
  state.memos.unshift(memo);
  saveMemos();

  // GASクラウド同期（未送信キュー経由・Step3.5）
  syncSaveMemoToGas(content, timeStr);
}

function saveMemos() {
  try {
    localStorage.setItem("companion_memos", JSON.stringify(state.memos));
  } catch (e) {
    console.warn("memo save failed:", e);
  }
  renderMemos();
}

function renderMemos() {
  const activeMemos = state.memos.filter(m => !m.archived);
  const archivedMemos = state.memos.filter(m => m.archived);

  elements.memoActiveCount.textContent = activeMemos.length;
  elements.memoArchivedCount.textContent = archivedMemos.length;

  elements.memoActiveList.innerHTML = "";
  if (activeMemos.length === 0) {
    elements.memoActiveList.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:8px 4px;">保管中のメモはありません</div>';
  } else {
    activeMemos.forEach(memo => {
      elements.memoActiveList.appendChild(createMemoItemDOM(memo));
    });
  }

  elements.memoArchivedList.innerHTML = "";
  if (archivedMemos.length === 0) {
    elements.memoArchivedList.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:8px 4px;">アーカイブされたメモはありません</div>';
  } else {
    archivedMemos.forEach(memo => {
      elements.memoArchivedList.appendChild(createMemoItemDOM(memo));
    });
  }
}

function createMemoItemDOM(memo) {
  const item = document.createElement("div");
  item.className = "memo-item";

  const textSpan = document.createElement("span");
  textSpan.className = "memo-item-text";
  textSpan.textContent = memo.text;

  const actions = document.createElement("div");
  actions.className = "memo-item-actions";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "memo-action-btn";
  toggleBtn.textContent = memo.archived ? "復元" : "完了";
  toggleBtn.onclick = () => {
    memo.archived = !memo.archived;
    saveMemos();
    // Vault側にも反映（Step3.5：以前は端末内だけで、次の同期で元に戻っていた）
    enqueueGasWrite("updateMemo", {
      date: memoServerDate_(memo),
      id: memo.serverId || "",
      text: memo.text,
      checked: memo.archived ? "true" : "false"
    });
  };

  const delBtn = document.createElement("button");
  delBtn.className = "memo-action-btn";
  delBtn.textContent = "削除";
  delBtn.onclick = () => {
    state.memos = state.memos.filter(m => m.id !== memo.id);
    saveMemos();
    // Vault側からも削除（送信待ちの間は同期で復活させない：hasPendingMemoDelete_）
    enqueueGasWrite("deleteMemo", {
      date: memoServerDate_(memo),
      id: memo.serverId || "",
      text: memo.text
    });
  };

  actions.appendChild(toggleBtn);
  actions.appendChild(delBtn);

  item.appendChild(textSpan);
  item.appendChild(actions);
  return item;
}

// ==========================================
// Kumapy スプレッドシート連携
// ==========================================

/** Kumapy からの取得の状態を覚えて、設定画面に表示する（2026-09-30、ステップ4-2） */
function setKumapyApiState_(st) {
  state.kumapyApiState = st;
  updateKumapyKeyStatus_();
}
function updateKumapyKeyStatus_() {
  const el = elements.kumapyKeyStatus;
  if (!el) return;
  const map = {
    ok: ["● Kumapy とつながっています", "#16a34a"],
    checking: ["● Kumapy に確認中…（最大45秒）", "#64748b"],
    nokey: ["● 合言葉が未入力（タスクの表示は同期経由で続きます）", "#d97706"],
    unauthorized: ["● 合言葉が違います（タスクの表示は同期経由で続きます）", "#dc2626"],
    error: ["● Kumapy に届きません（タスクの表示は同期経由で続きます）", "#d97706"]
  };
  const v = map[state.kumapyApiState] || ["● 確認中…", "#64748b"];
  el.textContent = v[0];
  el.style.color = v[1];
}

/**
 * Kumapy との接続と合言葉の確認（2026-09-30、ステップ4-2）。5分に1回・設定の保存時に、doPost へ軽い呼び出し（action=ping）を送る。
 * 合言葉違いなら code:UNAUTHORIZED が返る。それ以外の JSON が返れば、合言葉が通り Kumapy に届いている（ping の正式な応答は Ver.180 から）。
 */
let kumapyCheckInFlight_ = false;
async function checkKumapyConnection_() {
  const webAppUrl = sanitizeKumapyUrl(state.kumapyWebAppUrl || DEFAULT_CONFIG.kumapyWebAppUrl);
  if (!webAppUrl || !webAppUrl.includes("script.google.com")) return;
  if (!state.kumapyAccessKey) { setKumapyApiState_("nokey"); return; }
  if (kumapyCheckInFlight_) return;
  kumapyCheckInFlight_ = true;
  if (state.kumapyApiState !== "ok") setKumapyApiState_("checking");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: state.kumapyAccessKey, action: "ping", payload: {} }),
      signal: controller.signal
    });
    const json = res.ok ? await res.json() : null;
    if (json && json.code === "UNAUTHORIZED") setKumapyApiState_("unauthorized");
    else if (json && typeof json === "object" && json.status) setKumapyApiState_("ok");
    else setKumapyApiState_("error");
  } catch (e) {
    setKumapyApiState_("error");
    console.warn("Kumapy connection check failed:", e);
  } finally {
    clearTimeout(timeoutId);
    kumapyCheckInFlight_ = false;
  }
}

// 2026-09-30（ステップ4-2）: 前の取得が終わる前に次を始めない（30秒ごと＋↻）
let kumapyFetchInFlight_ = null;
function fetchKumapyTasks() {
  if (kumapyFetchInFlight_) return kumapyFetchInFlight_;
  kumapyFetchInFlight_ = fetchKumapyTasksCore_().finally(() => { kumapyFetchInFlight_ = null; });
  return kumapyFetchInFlight_;
}

async function fetchKumapyTasksCore_() {
  if (!state.syncGasUrl) {
    updatePwaCharacterTaskBar("⚙️", "同期サーバーの URL を設定してください", "設定画面 > クラウド同期 (GAS Web App)");
    return;
  }

  if (elements.btnKumapyRefresh) elements.btnKumapyRefresh.classList.add("spinning");

  try {
    const today = new Date();
    const ymd = getTodayYmd(today);
    const calendarYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nowHm = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

    // 2026-09-30（ステップ4-3）: スプレッドシートを CSV で直接読むのをやめ、同期サーバー（gas-second-sync の getKumapyTasks）から取る。
    // 同期の合言葉で守られ、シートのリンク共有が要らなくなる。サーバーは20秒キャッシュ。起動直後は応答に15秒前後かかることがある（実測）
    const dates = ymd === calendarYmd ? ymd : `${ymd},${calendarYmd}`;
    const res = await fetchGasJsonpRaw_("getKumapyTasks", { dates: dates }, { fetchTimeout: 40000, jsonpTimeout: 45000 });
    noteReadResult_(res);
    if (!res || !res.success) {
      const why = res && res.code === "NO_TOKEN" ? "同期の合言葉が未入力です"
        : res && res.code === "UNAUTHORIZED" ? "同期の合言葉が違います"
        : ((res && (res.error || res.code)) || "取得できませんでした");
      throw new Error(why);
    }
    const toTask = (t) => Object.assign({}, t, {
      isDone: t.status === "完了",
      isSkipped: (t.status === "中止" || t.status === "不要" || t.status === "翌日移動")
    });
    const byDate = res.tasks || {};
    let tasks = (byDate[ymd] || []).map(toTask);
    if (tasks.length === 0 && ymd !== calendarYmd) {
      tasks = (byDate[calendarYmd] || []).map(toTask);
    }

    // 全タスクを保持
    state.todayAllTasks = tasks;

    const running = tasks.find(t => t.status === "実行中");

    const activeTasks = tasks.filter(t => {
      if (t.status === "完了" || t.status === "中止" || t.status === "不要" || t.status === "翌日移動" || t.allDay) return false;
      return true;
    });

    const inCurrentWindow = activeTasks.filter(t => {
      if (!t.planStartHm) return false;
      if (t.planEndHm) {
        return t.planStartHm <= nowHm && t.planEndHm > nowHm;
      }
      return t.planStartHm <= nowHm;
    }).sort((a, b) => (b.planStartHm || "").localeCompare(a.planStartHm || ""));

    const upcomingAfterNow = activeTasks.filter(t => {
      if (!t.planStartHm) return false;
      return t.planStartHm > nowHm;
    }).sort((a, b) => a.planStartHm.localeCompare(b.planStartHm));

    let nextTargetTask = null;
    let nextTargetType = "";

    if (inCurrentWindow.length > 0) {
      nextTargetTask = inCurrentWindow[0];
      nextTargetType = "in_window";
    } else if (upcomingAfterNow.length > 0) {
      nextTargetTask = upcomingAfterNow[0];
      nextTargetType = "upcoming";
    }

    const remaining = activeTasks;

    if (running) {
      const text = `${running.title} (${running.actStartHm || "実行中"}〜)`;
      const title = `【進行中タスク】${running.title}\n開始: ${running.actStartHm || ""}`;
      if (elements.kumapyIcon) renderPwaTaskIcon(elements.kumapyIcon, "▶️");
      elements.kumapyText.textContent = text;
      elements.kumapyStatusBar.title = title;
      updatePwaCharacterTaskBar("▶️", text, title);
    } else if (nextTargetTask) {
      const timeLabel = nextTargetTask.planEndHm ? `${nextTargetTask.planStartHm}-${nextTargetTask.planEndHm}` : `${nextTargetTask.planStartHm}〜`;
      const isWindow = nextTargetType === "in_window";
      const icon = isWindow ? "📍" : "⏳";
      const countSuffix = remaining.length > 1 ? ` (残${remaining.length}件)` : "";
      const text = `${nextTargetTask.planStartHm} ${nextTargetTask.title}${countSuffix}`;
      const title = `【${isWindow ? "予定時間内" : "次の予定"}】${timeLabel} ${nextTargetTask.title}\n本日残りタスク: ${remaining.length}件`;
      if (elements.kumapyIcon) renderPwaTaskIcon(elements.kumapyIcon, icon);
      elements.kumapyText.textContent = text;
      elements.kumapyStatusBar.title = title;
      updatePwaCharacterTaskBar(icon, text, title);
    } else {
      if (remaining.length > 0) {
        const countSuffix = remaining.length > 1 ? ` 他${remaining.length - 1}件` : "";
        const text = `${remaining[0].title}${countSuffix}`;
        const title = `本日残りタスク: ${remaining.length}件`;
        if (elements.kumapyIcon) renderPwaTaskIcon(elements.kumapyIcon, "📋");
        elements.kumapyText.textContent = text;
        elements.kumapyStatusBar.title = title;
        updatePwaCharacterTaskBar("📋", text, title);
      } else if (tasks.length > 0) {
        const text = "本日のタスク完了！";
        const title = "すべての予定・タスクが完了しています";
        if (elements.kumapyIcon) renderPwaTaskIcon(elements.kumapyIcon, "🎉");
        elements.kumapyText.textContent = text;
        elements.kumapyStatusBar.title = title;
        updatePwaCharacterTaskBar("🎉", text, title);
      } else {
        const text = "本日の予定・タスクはありません";
        const title = "本日予定されているタスクはありません";
        if (elements.kumapyIcon) renderPwaTaskIcon(elements.kumapyIcon, "📅");
        elements.kumapyText.textContent = text;
        elements.kumapyStatusBar.title = title;
        updatePwaCharacterTaskBar("📅", text, title);
      }
    }
  } catch (err) {
    console.warn("fetchKumapyTasks error:", err);
    if (elements.kumapyIcon) renderPwaTaskIcon(elements.kumapyIcon, "⚠️");
    // 2026-09-30（ステップ4-3）: 合言葉の未入力・違いは、そのまま表示する（設定で直せるように）
    const msg = /合言葉/.test(err.message || "") ? `${err.message}（設定で入力）` : "Kumapy未接続 (タップで確認)";
    elements.kumapyText.textContent = msg;
    elements.kumapyStatusBar.title = `取得エラー: ${err.message}`;
    updatePwaCharacterTaskBar("⚠️", msg, `取得エラー: ${err.message}`);
  } finally {
    if (elements.btnKumapyRefresh) {
      setTimeout(() => elements.btnKumapyRefresh.classList.remove("spinning"), 400);
    }
  }

  // 日付変更時に日次コンテキスト（天気・睡眠）を1日1回自動更新
  const todayYmd = getTodayYmd();
  if (!state.dailyContextFetchDate || state.dailyContextFetchDate !== todayYmd) {
    fetchDailyContext().catch(e => console.warn("Background daily context fetch failed:", e));
  }
}

// 📦 日次サマリ一括取得・キャッシュ（1日1回）
async function fetchDailyContext(force = false) {
  const ymd = getTodayYmd();
  fetchPersona_(force).catch(e => console.warn("fetchPersona_ failed:", e));

  if (!force && state.dailyContextFetchDate === ymd) {
    return;
  }

  // 1. GAS Cloud Sync から 00_Contexts JSON を優先取得
  if (state.syncGasUrl) {
    try {
      const res = await fetchGasJsonp('getDailyContext', { date: ymd });
      if (res && res.success && res.context) {
        const ctx = res.context;
        if (ctx.weather) state.todayWeather = ctx.weather;
        if (ctx.sleep) state.todaySleep = ctx.sleep;
        if (ctx.morningPaper) state.latestMorningPaper = ctx.morningPaper;
        state.dailyContextFetchDate = ymd;
        state.dailyContextUpdatedAt = ctx.updatedAt || new Date().toISOString();
        updateDailyContextStatusUI();
        console.log('PWA DailyContext fetched via GAS cloud cache for', ymd);
        return;
      }
    } catch (e) {
      console.warn('PWA fetchDailyContext via GAS failed, falling back to direct sheet fetch:', e);
    }
  }

  // 2026-09-30（ステップ4-3）: スプレッドシートを CSV で直接読む予備の経路は削除（Metrics はリンク共有されておらず、もともと読めていなかった）。
  // 取れなかった日は印を付けず、次の同期のときにもう一度取りに行く
  updateDailyContextStatusUI();
  console.warn('PWA DailyContext: 同期サーバーから取れませんでした（次の同期で再取得）', ymd);
}

// ⏰ 毎朝9:30 自動日次コンテキスト更新チェック（1分間隔）
function check930AutoRefresh() {
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if ((hours > 9 || (hours === 9 && minutes >= 30)) && state.autoRefreshed930Date !== ymd) {
    let needRefresh = true;
    if (state.dailyContextUpdatedAt) {
      try {
        const updateDate = new Date(state.dailyContextUpdatedAt);
        const updateYmd = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}`;
        if (updateYmd === ymd && (updateDate.getHours() > 9 || (updateDate.getHours() === 9 && updateDate.getMinutes() >= 30))) {
          needRefresh = false;
        }
      } catch (e) {}
    }

    if (needRefresh) {
      console.log('⏰ 9:30 Auto refreshing daily context in PWA for', ymd);
      fetchDailyContext(true).then(() => {
        state.autoRefreshed930Date = ymd;
        console.log('✅ PWA 9:30 Auto refresh completed successfully');
      }).catch(e => console.warn('PWA 9:30 Auto refresh failed:', e));
    } else {
      state.autoRefreshed930Date = ymd;
    }
  }
}

// 時間帯別の時報メッセージ生成 (Matt Stiller 仕様)
function getHourlyChimeMessage(hour) {
  const timeMessages = {
    6: '朝の6時です。おはようございます、きのぴぃ。今日もいいコンディションでいきましょう。',
    7: '7時になりました。朝ごはんを食べて、身体を起こしていきましょう。',
    8: '8時です。そろそろ始動ですね。マイペースにいきましょう。',
    9: '9時になりました。今日のラウンド、集中していきましょう。',
    10: '10時です。水分補給しながら、いいリズムで。',
    11: '11時になりました。お昼まであと少し。順調ですか？',
    12: 'お昼の12時です。一回リング降りて、ちゃんと昼ご飯食べましょう。',
    13: '13時になりました。午後も気負わず、ひとつずついきましょう。',
    14: '14時です。少し眠気が出る時間ですね。背伸びして深呼吸しません？',
    15: '15時になりました。軽く糖分補給して、頭を休めましょう。',
    16: '16時です。夕方まであと少し。いいペースです。',
    17: '17時になりました。夕方のもうひと踏ん張りですね、きのぴぃ。いいリズムでいきましょう。',
    18: '18時です。今日も一日お疲れさまでした。',
    19: '19時になりました。夜の時間です。美味しいご飯でも食べてください。',
    20: '20時です。ゆっくりリラックスして、自分の時間を過ごしてください。',
    21: '21時になりました。夜も更けてきましたね。無理は禁物ですよ。',
    22: '22時です。そろそろお風呂で温まって、身体を休めましょう。',
    23: '23時になりました。1日のまとめの時間ですよ、きのぴぃ。今日の振り返りをして、ゆっくり休みましょう。',
    0: '夜の12時です。きのぴぃ、今日はもうタオル投げましょう。寝る時間です。',
    1: '深夜1時です。画面を閉じて、ちゃんと身体を休めてください。',
    2: '深夜2時ですよ。明日のコンディションのためにも、早く寝ましょう。',
    3: '深夜3時です。無理は禁物です。休んでください。',
    4: '早朝4時です。少しでも睡眠を取ってくださいね。',
    5: '朝の5時になりました。早起きですね、きのぴぃ。'
  };
  return timeMessages[hour] || `${hour}時になりましたよ、きのぴぃ。一息つきながらいきましょう。`;
}

// 定期実行ティッカー（9:30自動更新 ＆ 毎正時時報 ＆ 平日17:45定時アナウンス）
function checkScheduledTicker() {
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hour = now.getHours();
  const minutes = now.getMinutes();

  // 1. 9:30 自動更新チェック
  check930AutoRefresh();

  // 2. 毎正時の時報チェック
  if (state.notifyHourly && minutes === 0) {
    const chimeKey = `${ymd}_${hour}`;
    if (state.lastHourlyChimeKey !== chimeKey) {
      state.lastHourlyChimeKey = chimeKey;
      const chimeMsg = getHourlyChimeMessage(hour);
      showPwaFloatingBubble(chimeMsg);
      setPwaAvatarCut("speaking", 5000);
      speakWithVoice(chimeMsg);
      console.log(`⏰ PWA Hourly chime triggered for ${hour}:00:`, chimeMsg);
    }
  }

  // 3. 平日（月〜金）17:45 定時アナウンス
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (state.notifyHourly && isWeekday && hour === 17 && minutes === 45) {
    const endWorkKey = `${ymd}_1745`;
    if (state.lastEndWorkKey !== endWorkKey) {
      state.lastEndWorkKey = endWorkKey;
      const endWorkMsg = '17時45分です。そろそろ定時のお知らせですよ、きのぴぃ。今日の作業をひと段落させましょう。';
      showPwaFloatingBubble(endWorkMsg);
      setPwaAvatarCut("speaking", 6000);
      speakWithVoice(endWorkMsg);
      console.log('⏰ PWA Weekday 17:45 end-work reminder triggered:', endWorkMsg);
    }
  }
}

setInterval(checkScheduledTicker, 60 * 1000);

// ==========================================
// 設定保存
// ==========================================
function saveSettings(showBubble = true) {
  state.geminiEnabled = elements.geminiApiToggle.checked;
  state.geminiApiKey = elements.geminiApiKey.value.trim();
  if (elements.kumapyWebAppUrlInput) {
    // 2026-09-30（ステップ4-2）: URL に合言葉（key= / k=）が入力されても取り除いて保存する
    state.kumapyWebAppUrl = sanitizeKumapyUrl(elements.kumapyWebAppUrlInput.value.trim());
    elements.kumapyWebAppUrlInput.value = state.kumapyWebAppUrl;
  }
  if (elements.kumapyAccessKeyInput) {
    const nextKey = elements.kumapyAccessKeyInput.value.trim();
    if (nextKey !== state.kumapyAccessKey) state.kumapyApiState = "";
    state.kumapyAccessKey = nextKey;
  }
  if (elements.companionSyncUrlInput) {
    state.syncGasUrl = elements.companionSyncUrlInput.value.trim();
  }
  if (elements.companionSyncTokenInput) {
    state.syncToken = elements.companionSyncTokenInput.value.trim();
  }
  state.voiceEnabled = elements.voiceToggle.checked;
  const extTtsSaveEl = document.getElementById("voice-external-tts-toggle");
  if (extTtsSaveEl) state.voiceExternalTts = extTtsSaveEl.checked;
  state.voiceSpeaker = elements.voiceSpeaker.value;
  if (elements.voiceFallbackSpeaker) {
    state.voiceFallbackSpeaker = elements.voiceFallbackSpeaker.value;
  }
  state.voicePitch = parseFloat(elements.voicePitch.value);
  state.voiceRate = parseFloat(elements.voiceRate.value);
  // 2026-09-30: 予備（オフライン）音声の高さ・速度が保存されず、開き直すと1.0に戻っていた（読み込み側だけあった）
  if (elements.voiceFallbackPitch) state.voiceFallbackPitch = parseFloat(elements.voiceFallbackPitch.value);
  if (elements.voiceFallbackRate) state.voiceFallbackRate = parseFloat(elements.voiceFallbackRate.value);
  if (elements.notifyUpcomingToggle) {
    state.notifyUpcoming = elements.notifyUpcomingToggle.checked;
  }
  if (elements.notifyHourlyToggle) {
    state.notifyHourly = elements.notifyHourlyToggle.checked;
  }
  if (elements.notifyNightToggle) {
    state.notifyNight = elements.notifyNightToggle.checked;
  }
  if (elements.notifyMonologueToggle) {
    state.notifyMonologue = elements.notifyMonologueToggle.checked;
  }
  if (elements.voiceReplaceDict) {
    state.voiceReplaceDict = elements.voiceReplaceDict.value;
  }

  localStorage.setItem("gemini_enabled", state.geminiEnabled);
  localStorage.setItem("gemini_api_key", state.geminiApiKey);
  localStorage.setItem("kumapy_webapp_url", state.kumapyWebAppUrl);
  localStorage.setItem("kumapy_access_key", state.kumapyAccessKey);
  localStorage.setItem("companion_sync_gas_url", state.syncGasUrl);
  localStorage.setItem("companion_sync_token", state.syncToken);
  localStorage.setItem("voice_enabled", state.voiceEnabled);
  localStorage.setItem("voice_external_tts", state.voiceExternalTts);
  localStorage.setItem("voice_speaker", state.voiceSpeaker);
  // 2026-10-07：この端末で設定を保存した時刻（同期で古いクラウドの設定に戻されないよう、比べるのに使う）
  localStorage.setItem("companion_settings_local_at", new Date().toISOString());
  localStorage.setItem("voice_fallback_speaker", state.voiceFallbackSpeaker);
  localStorage.setItem("voice_pitch", state.voicePitch);
  localStorage.setItem("voice_rate", state.voiceRate);
  localStorage.setItem("voice_fallback_pitch", state.voiceFallbackPitch);
  localStorage.setItem("voice_fallback_rate", state.voiceFallbackRate);
  localStorage.setItem("voice_replace_dict", state.voiceReplaceDict);
  localStorage.setItem("notify_upcoming", state.notifyUpcoming);
  localStorage.setItem("notify_hourly", state.notifyHourly);
  localStorage.setItem("notify_night", state.notifyNight);
  localStorage.setItem("notify_monologue", state.notifyMonologue);

  updateBadgeState();
  if (showBubble) {
    elements.settingsPanel.classList.add("hidden");
    addMessageBubble("bot", "設定を保存したよ！ありがとう！", null, true);
  }
  fetchKumapyTasks();
  checkKumapyConnection_(); // 2026-09-30（ステップ4-2）: 合言葉を入れ直したらすぐ確かめる

  // 合言葉を確かめて同期状態を更新（通れば未送信分を送る）
  verifySyncToken().then(ok => {
    if (!ok && syncStatus.state === "unauthorized") {
      addMessageBubble("bot", "同期の合言葉が通らなかったよ。この端末の発言は「未送信」として保管しておくね。設定の合言葉を確かめてみて。", null, false);
    } else if (!ok && syncStatus.state === "notoken") {
      addMessageBubble("bot", "同期の合言葉がまだ入っていないよ。入れるまで、この端末の発言は「未送信」として保管しておくね。", null, false);
    } else if (ok) {
      fetchPersona_(true).catch(() => {});
    }
  });

  // クラウドにも設定を同期（Gemini APIキー・合言葉は送らない）
  syncSaveSettingsToGas({
    geminiEnabled: state.geminiEnabled,
    voiceEnabled: state.voiceEnabled,
    voiceSpeaker: state.voiceSpeaker,
    voicePitch: state.voicePitch,
    voiceRate: state.voiceRate,
    voiceReplaceDict: state.voiceReplaceDict
  });
}

// ==========================================
// クラウド同期 (GAS / Google Drive) - JSONP完全対応
// ==========================================

/**
 * GAS クラウド通信ヘルパー（fetch と JSONP のハイブリッドで 100% 確実に通信）
 */
async function fetchGasJsonp(action, paramsObj = {}) {
  // 読み取り用ラッパー：結果から同期状態（合言葉違い・通信失敗）を更新する（Step3.5）
  try {
    const data = await fetchGasJsonpRaw_(action, paramsObj);
    noteReadResult_(data);
    return data;
  } catch (err) {
    // Step3.5i：読み取りの失敗（起動直後の遅い応答など）では「未同期」にしない。
    // 「未同期」は書き込み（未送信キュー）が送れないときだけ出す（送れていない発言があるかどうかが大事なため）
    throw err;
  }
}

async function fetchGasJsonpRaw_(action, paramsObj = {}, opts = {}) {
  if (!state.syncGasUrl) {
    throw new Error("No syncGasUrl");
  }

  const token = getEffectiveSyncToken();
  // 合言葉が未入力なら送らない（ステップ4-3）
  if (!token) return { success: false, code: "NO_TOKEN", error: "同期の合言葉が未入力です" };

  // 1. まず標準の fetch で試行
  try {
    const params = new URLSearchParams(Object.assign({ token: token }, paramsObj, { action: action }));
    const url = `${state.syncGasUrl}?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.fetchTimeout || 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return data;
      }
    }
  } catch (fetchErr) {
    // fetch が CORS やリダイレクトで失敗した場合は JSONP にフォールバック
  }

  // 2. JSONP によるフォールバック通信
  return new Promise((resolve, reject) => {
    const callbackName = "gasCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const params = new URLSearchParams(Object.assign({ token: token }, paramsObj, {
      action: action,
      callback: callbackName
    }));

    const url = `${state.syncGasUrl}?${params.toString()}`;
    const script = document.createElement("script");
    script.src = url;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("GAS request timeout"));
    }, opts.jsonpTimeout || 10000);

    function cleanup() {
      clearTimeout(timeout);
      if (window[callbackName]) {
        delete window[callbackName];
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function(err) {
      cleanup();
      reject(err);
    };

    document.head.appendChild(script);
  });
}

// ログ一意キー正規化ヘルパー（時刻表記揺れや空白による重複追加・再描画バグを防止）
function normalizeLogKey(timeStr, role, text) {
  const normRole = (role === "user" || (role && String(role).includes("きのぴぃ"))) ? "user" : "bot";
  const normText = (text || "").replace(/\s+/g, " ").trim();
  let normTime = (timeStr || "").trim();
  const timeMatch = normTime.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hh = String(timeMatch[1]).padStart(2, "0");
    const mm = timeMatch[2];
    normTime = `${hh}:${mm}`;
  }
  return `${normTime}|${normRole}|${normText}`;
}

let lastSyncFromCloudTime = 0;

async function syncFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastSyncFromCloudTime < 20000) {
    return; // 20秒以内の過剰な連続実行を防止
  }
  lastSyncFromCloudTime = now;

  if (!state.syncGasUrl) return;
  const todayYmd = getTodayYmd();

  // 0. 未送信分を先に送る（Step3.5）
  flushOutbox();

  // 1. 設定の同期取得（クラウドが新しい場合のみ上書き）
  try {
    const data = await fetchGasJsonp("getSettings");
    // 2026-10-07：設定画面を開いている間と、この端末で保存した設定の方が新しいときは、クラウドの値で上書きしない
    const panelOpen = elements.settingsPanel && !elements.settingsPanel.classList.contains("hidden");
    const localAt = localStorage.getItem("companion_settings_local_at") || "";
    const cloudAt = data && data.settings && data.settings.updatedAt ? String(data.settings.updatedAt) : "";
    if (data && data.success && data.settings && !panelOpen && cloudAt && (!localAt || cloudAt > localAt)) {
      const s = data.settings;
      if (typeof s === "object") {
        // Gemini キーはクラウドから受け取らない（サーバーも返さない。2026-10-07 で受け口を削除）
        if (s.geminiEnabled !== undefined && s.geminiEnabled !== state.geminiEnabled) {
          state.geminiEnabled = Boolean(s.geminiEnabled);
          localStorage.setItem("gemini_enabled", state.geminiEnabled);
        }
        if (s.voiceEnabled !== undefined && s.voiceEnabled !== state.voiceEnabled) {
          state.voiceEnabled = Boolean(s.voiceEnabled);
          localStorage.setItem("voice_enabled", state.voiceEnabled);
        }
        if (s.voiceSpeaker !== undefined && s.voiceSpeaker !== state.voiceSpeaker) {
          state.voiceSpeaker = s.voiceSpeaker;
          localStorage.setItem("voice_speaker", s.voiceSpeaker);
        }
        if (s.voicePitch !== undefined && s.voicePitch !== state.voicePitch) {
          state.voicePitch = parseFloat(s.voicePitch);
          localStorage.setItem("voice_pitch", state.voicePitch);
        }
        if (s.voiceRate !== undefined && s.voiceRate !== state.voiceRate) {
          state.voiceRate = parseFloat(s.voiceRate);
          localStorage.setItem("voice_rate", state.voiceRate);
        }
        localStorage.setItem("companion_settings_local_at", cloudAt);
        loadSettingsToUI();
      }
    }
  } catch (err) {
    console.warn("Cloud settings JSONP sync warning:", err);
  }

  // 2. 本日の会話ログの同期取得＆マージ（正本反映）
  try {
    // 2026-10-07：0〜6時に暦の日付のログも取りに行き、前日扱いの日付に混ぜていたのをやめた（書き込みは両端末とも朝6時区切りの日付）
    const data = await fetchGasJsonp("getLogs", { date: todayYmd });

    if (data && data.success && Array.isArray(data.messages) && data.messages.length > 0) {
      const cloudMessages = data.messages;
      const localLogs = JSON.parse(localStorage.getItem(`companion_chat_${todayYmd}`) || "[]");

      // 既存のローカルログとクラウドログを安全にマージ
      const mergedLogs = [];
      const seenKeys = new Set();

      // まずクラウドのメッセージを追加
      cloudMessages.forEach(msg => {
        const role = msg.role === "user" ? "user" : "bot";
        const timeStr = msg.time || "";
        const text = msg.text || "";
        const key = normalizeLogKey(timeStr, role, text);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedLogs.push({ role, text, time: timeStr });
        }
      });

      // クラウドにまだ届いていない直近のローカルメッセージを追加
      localLogs.forEach(msg => {
        const role = msg.role === "user" ? "user" : "bot";
        const timeStr = msg.time || "";
        const text = msg.text || "";
        const key = normalizeLogKey(timeStr, role, text);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedLogs.push({ role, text, time: timeStr });
        }
      });

      localStorage.setItem(`companion_chat_${todayYmd}`, JSON.stringify(mergedLogs));

      if (elements.chatTimeline) {
        // DOM上にすでに表示されているメッセージのキーを収集
        const existingBubbles = elements.chatTimeline.querySelectorAll(".chat-row");
        const renderedKeys = new Set();
        existingBubbles.forEach(row => {
          if (row.dataset && row.dataset.logKey) {
            renderedKeys.add(row.dataset.logKey);
          } else {
            const textEl = row.querySelector(".bubble-text");
            const timeEl = row.querySelector(".bubble-time");
            const isUser = row.classList.contains("user-row") || row.classList.contains("user");
            if (textEl) {
              const key = normalizeLogKey(timeEl ? timeEl.textContent : "", isUser ? "user" : "bot", textEl.textContent);
              renderedKeys.add(key);
            }
          }
        });

        // 未描画のメッセージがあればDOMに追加
        let newAdded = false;
        let lastBotMsg = null;
        mergedLogs.forEach(msg => {
          const key = normalizeLogKey(msg.time, msg.role, msg.text);
          if (!renderedKeys.has(key)) {
            renderedKeys.add(key);
            elements.chatTimeline.appendChild(createMessageBubbleElement(msg.role, msg.text, msg.time));
            newAdded = true;
          }
          if (msg.role === "bot") lastBotMsg = msg.text;
        });

        // 会話履歴コンテキストの更新
        state.conversationHistory = mergedLogs.map(m => ({
          role: m.role === "user" ? "user" : "model",
          text: m.text
        }));
        if (state.conversationHistory.length > 20) {
          state.conversationHistory = state.conversationHistory.slice(-20);
        }

        if (newAdded) {
          if (lastBotMsg && (!elements.mascotFloatingBubbleText || elements.mascotFloatingBubbleText.textContent.trim() !== lastBotMsg.trim())) {
            showPwaFloatingBubble(lastBotMsg);
          }
          scrollToBottom();
        }
        updateLoadPrevButton();
      }
    }
  } catch (err) {
    console.warn("Cloud logs sync warning:", err);
  }

  // 3. メモの同期取得＆マージ
  try {
    // 2026-10-07：当日＋過去30日のメモ（チェックしていないメモを日をまたいで残す。gas-second-sync Ver.14 の range）
    const data = await fetchGasJsonp("getMemos", { date: todayYmd, range: MEMO_RANGE_DAYS });
    if (data && data.success && Array.isArray(data.memos)) {
      let memoChanged = false;
      data.memos.forEach(cm => {
        // 削除を送信待ちのメモは復活させない（Step3.5f：判定は未送信キューだけで行う。
        // 旧方式の削除マーカーは、破棄・未反映の削除でもマーカーが残り、Vaultにあるメモが3日間見えなくなっていた）
        if (hasPendingMemoDelete_(cm.text)) return;
        const local = state.memos.find(m => (m.serverId && m.serverId === cm.id) || m.text === cm.text);
        if (!local) {
          state.memos.unshift({
            id: cm.id || Date.now().toString(),
            serverId: cm.id || "",
            serverDate: cm.date || todayYmd,
            text: cm.text,
            date: cm.dateTime || new Date().toLocaleDateString("ja-JP"),
            archived: Boolean(cm.checked)
          });
          memoChanged = true;
        } else {
          if (cm.id && local.serverId !== cm.id) {
            local.serverId = cm.id;
            local.serverDate = cm.date || todayYmd;
            memoChanged = true;
          }
          // Mac版などで切り替えたアーカイブ状態を反映（こちらの変更が未送信の間は上書きしない）
          if (!hasPendingMemoOp_(local.text) && Boolean(cm.checked) !== Boolean(local.archived)) {
            local.archived = Boolean(cm.checked);
            memoChanged = true;
          }
        }
      });
      // 他の端末で削除されたメモ・30日より前のメモを、この端末からも消す（Step3.5e、2026-10-07 範囲を30日に）
      // 対象：サーバーで確認済み（serverId あり）で、クラウドの一覧から消えたか範囲外になり、この端末の変更も送信待ちでないもの
      const cloudIds = new Set(data.memos.map(cm => cm.id));
      const cloudTexts = new Set(data.memos.map(cm => cm.text));
      const beforeCount = state.memos.length;
      state.memos = state.memos.filter(m => !(
        m.serverId && m.serverDate &&
        !cloudIds.has(m.serverId) && !cloudTexts.has(m.text) &&
        !hasPendingMemoOp_(m.text)
      ));
      if (state.memos.length !== beforeCount) memoChanged = true;
      if (memoChanged) {
        saveMemos();
      }
    }
  } catch (err) {
    console.warn("Cloud memos JSONP sync warning:", err);
  }
}

// ==========================================
// 送信キュー・同期状態（Step3.5：Req_AppAccessPolicy_SecretsAndLogin_StepByStep.md）
//  - 書き込みは未送信キューに入れてから送る。サーバーが success:true を返したときだけキューから消す
//  - 合言葉違い（code:UNAUTHORIZED）・通信失敗は「未同期」として画面に出し、後で再送する
//  - 各書き込みに clientId を付け、サーバー側で二重登録を防ぐ（再送しても1回だけ書かれる）
// ==========================================
const OUTBOX_KEY = "companion_outbox";
const MEMO_RANGE_DAYS = 30; // 2026-10-07：何日前までのメモを出すか
const MEMO_TOMBSTONE_KEY = "companion_memo_tombstones";
// 2026-10-07：回数で捨てるのをやめた（送れるまで残す。破棄は「未送信」をタップしたときの確認からだけ）
const OUTBOX_FAILED_KEY = "companion_outbox_failed";
let outboxMem = null;
let outboxFlushing = false;
const syncStatus = { state: "unknown", lastOkAt: null };

function safeJsonParseArray_(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    console.warn("broken localStorage value:", key);
    return [];
  }
}

// 2026-09-30（ステップ4-3）: 既定値（コード内の合言葉）は廃止。未入力なら空を返し、呼び出し側は送らずに「未入力」とする
function getEffectiveSyncToken() {
  return (state.syncToken || "").trim();
}

/** システムプロンプト：同期サーバーから受け取った全文（端末に保存）。無ければ公開JSの基本プロンプト（ステップ4-3） */
function getSystemPrompt_() {
  return state.personaPrompt || BASE_SYSTEM_PROMPT;
}

/** getPersona で全文を受け取り、端末に保存する（1日1回＋手動更新時。ステップ4-3） */
async function fetchPersona_(force = false) {
  const ymd = getTodayYmd();
  if (!force && state.personaFetchDate === ymd) return;
  const r = await fetchGasJsonpRaw_("getPersona", {}, { fetchTimeout: 20000, jsonpTimeout: 25000 });
  noteReadResult_(r);
  if (r && r.success) {
    state.personaFetchDate = ymd;
    const text = String(r.prompt || "");
    if (text && text !== state.personaPrompt) {
      state.personaPrompt = text;
      try { localStorage.setItem("companion_persona_prompt", text); } catch (e) { console.warn("persona save failed:", e); }
    }
  }
}

function loadOutbox_() {
  if (!outboxMem) outboxMem = safeJsonParseArray_(OUTBOX_KEY);
  return outboxMem;
}

function saveOutbox_(skipRender) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(loadOutbox_()));
  } catch (e) {
    console.warn("outbox save failed:", e);
  }
  if (!skipRender) renderSyncStatus();
}

function newClientId_() {
  return "pwa_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function enqueueGasWrite(action, params) {
  if (!state.syncGasUrl) return;
  loadOutbox_().push({ id: newClientId_(), action: action, params: params || {}, createdAt: Date.now(), tries: 0 });
  saveOutbox_(true); // 表示は flushOutbox 側で「送信中」として出す（送信中を「未送信」と見せない）
  flushOutbox();
}

/**
 * 書き込み1件を送る（Step3.5g で順番を変更）
 *  - 短いもの：従来から iPhone で動いている GET（fetch→だめならJSONP）で送る
 *  - URLに収まらない長文だけ POST で送る（本文をURLに載せない）
 *  どちらも clientId 付きなので、途中で打ち切って再送しても二重には書かれない。
 *  （iPhone の PWA で POST の応答が返らず、1件ごとに数十秒待たされる症状があったため）
 */
async function sendGasWrite_(action, params) {
  const token = getEffectiveSyncToken();
  if (!token) return { success: false, code: "NO_TOKEN", error: "同期の合言葉が未入力です" };
  const getLen = state.syncGasUrl.length +
    new URLSearchParams(Object.assign({ token: token }, params, { action: action, callback: "gasCb_0000000000000_00000" })).toString().length + 1;
  if (getLen <= 6000) {
    // 書き込みはロック待ち＋Driveの読み書きで6秒を超えることがあるため、待ち時間を長めにとる（Step3.5h）
    // （短い待ち時間で打ち切ると、サーバーには届いているのに「通信できません」と表示され、再送が重なって更に遅くなっていた）
    return await fetchGasJsonpRaw_(action, params, { fetchTimeout: 25000, jsonpTimeout: 30000 });
  }
  const body = JSON.stringify(Object.assign({}, params, { token: token, action: action }));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(state.syncGasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      signal: controller.signal
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && typeof data === "object") return data;
    throw new Error("Bad response");
  } finally {
    clearTimeout(timeoutId);
  }
}

// 送信処理は同時に1本だけ。実行中に呼ばれたら、その実行の終わりを待つ（Step3.5d）
let outboxFlushPromise = null;
function flushOutbox() {
  if (!state.syncGasUrl) {
    renderSyncStatus();
    return Promise.resolve();
  }
  if (outboxFlushPromise) return outboxFlushPromise;
  outboxFlushPromise = flushOutboxInner_().finally(() => {
    outboxFlushPromise = null;
    // Step3.5j：送信の終わり際に追加された分は、次の同期を待たずに続けて送る
    if (loadOutbox_().length > 0 && syncStatus.state === "ok") {
      setTimeout(() => flushOutbox(), 0);
    }
  });
  return outboxFlushPromise;
}

async function flushOutboxInner_() {
  outboxFlushing = true;
  renderSyncStatus();
  try {
    const ob = loadOutbox_();
    while (ob.length > 0) {
      const op = ob[0];
      let res = null;
      try {
        res = await sendGasWrite_(op.action, Object.assign({}, op.params, { clientId: op.id }));
      } catch (err) {
        op.tries = (op.tries || 0) + 1;
        op.lastError = "通信失敗: " + (err && err.message ? err.message : String(err));
        setSyncStatus_("offline");
        saveOutbox_();
        break;
      }
      if (res && res.success) {
        ob.shift();
        setSyncStatus_("ok");
        saveOutbox_();
        continue;
      }
      if (res && res.code === "UNAUTHORIZED") {
        op.lastError = "合言葉違い";
        setSyncStatus_("unauthorized");
        saveOutbox_();
        break;
      }
      if (res && res.code === "NO_TOKEN") {
        // 合言葉が未入力：送らずにキューに残す（試行回数は数えない。ステップ4-3）
        op.lastError = "合言葉が未入力";
        setSyncStatus_("notoken");
        saveOutbox_();
        break;
      }
      if (res && res.code === "BAD_REQUEST" || (res && /^(Empty|Unknown action)/.test(res.error || ""))) {
        // 何度送っても通らない内容。2026-10-07：黙って捨てず「書けなかった」一覧に移して画面で知らせる
        console.error("outbox op rejected:", op.action, res.error);
        ob.shift();
        addFailedOp_(op, res.error || res.code);
        saveOutbox_();
        continue;
      }
      // BUSY・サーバー内部エラー等：後で再送（2026-10-07：回数で捨てない）
      op.tries = (op.tries || 0) + 1;
      op.lastError = "サーバー: " + ((res && (res.code || res.error)) || "不明な応答");
      setSyncStatus_(res ? "servererror" : "offline");
      saveOutbox_();
      break;
    }
  } finally {
    outboxFlushing = false;
    renderSyncStatus();
  }
}

// 未送信の中身を人が読める形に（値＝合言葉は含めない）
function describeOutbox_() {
  const ob = loadOutbox_();
  if (ob.length === 0) return "未送信はありません。";
  const names = { appendLog: "発言", saveMemo: "メモ追加", updateMemo: "メモ完了/復元", deleteMemo: "メモ削除" };
  const lines = ob.slice(0, 5).map((op, i) => {
    const p = op.params || {};
    const head = String(p.text || "").replace(/\s+/g, " ").slice(0, 24);
    return `${i + 1}. ${names[op.action] || op.action}（${p.date || ""} ${p.time || ""}）「${head}」 試行${op.tries || 0}回${op.lastError ? "／" + op.lastError : ""}`;
  });
  return `未送信${ob.length}件：\n` + lines.join("\n") + (ob.length > 5 ? `\n…ほか${ob.length - 5}件` : "");
}

// 未送信を再送し、残ったら中身を表示。破棄するかを確認する（Step3.5 追補）
async function manageOutbox_() {
  await flushOutbox();
  if (loadOutbox_().length === 0 && showFailedOps_()) return; // 2026-10-07
  if (loadOutbox_().length === 0) {
    addMessageBubble("bot", "未送信はすべて送れました。", null, false);
    return;
  }
  const desc = describeOutbox_();
  addMessageBubble("bot", desc, null, false);
  // 数回試しただけの段階では破棄を勧めない（電波の戻り待ちなど、待てば送れることが多い）
  const head = loadOutbox_()[0];
  if (!head || (head.tries || 0) < 3) {
    addMessageBubble("bot", "まだ送れていないので、少し待ってからもう一度タップしてね。電波が戻れば自動でも送るよ。", null, false);
    return;
  }
  if (window.confirm(desc + "\n\n再送できなかった分を破棄しますか？（破棄した発言はVaultに入りません）")) {
    outboxMem = [];
    saveOutbox_();
    addMessageBubble("bot", "未送信を破棄しました。", null, false);
  }
}

// 2026-10-07：サーバーが受け付けなかった書き込み（この端末だけ、最大50件）
function loadFailedOps_() {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX_FAILED_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}
function addFailedOp_(op, reason) {
  const list = loadFailedOps_();
  list.push({ action: op.action, params: op.params, createdAt: op.createdAt, reason: String(reason || "").slice(0, 80) });
  try { localStorage.setItem(OUTBOX_FAILED_KEY, JSON.stringify(list.slice(-50))); } catch (e) {}
}
function showFailedOps_() {
  const list = loadFailedOps_();
  if (list.length === 0) return false;
  const names = { appendLog: "発言", saveMemo: "メモ追加", updateMemo: "メモ完了/復元", deleteMemo: "メモ削除" };
  const lines = list.map(f => {
    const p = f.params || {};
    return `・${names[f.action] || f.action}（${p.date || ""} ${p.time || ""}）：${String(p.text || "").slice(0, 200)}`;
  });
  showAiFallbackNotice_(`⚠️ サーバーが受け付けず、Vault に書けなかった ${list.length} 件です（必要なら手で残してください）\n` + lines.join("\n"));
  try { localStorage.removeItem(OUTBOX_FAILED_KEY); } catch (e) {}
  renderSyncStatus();
  return true;
}

function setSyncStatus_(s) {
  syncStatus.state = s;
  if (s === "ok") syncStatus.lastOkAt = new Date();
  renderSyncStatus();
}

function noteReadResult_(data) {
  if (data && data.code === "NO_TOKEN") {
    setSyncStatus_("notoken");
  } else if (data && data.code === "UNAUTHORIZED") {
    setSyncStatus_("unauthorized");
  } else if (data && data.success) {
    setSyncStatus_("ok");
  }
}

function renderSyncStatus() {
  const pending = loadOutbox_().length;
  const pendingText = pending > 0 ? `・未送信${pending}件` : "";
  let badgeText = "● 確認中…";
  let badgeColor = "#64748b";
  let alertText = "";
  const sendingNow = outboxFlushing && pending > 0 && (syncStatus.state === "ok" || syncStatus.state === "unknown");
  if (sendingNow) {
    // 送信中（サーバーの応答待ち）は「未送信」扱いにしない
    badgeText = "● 送信中…";
    badgeColor = "#1565C0";
  } else if (syncStatus.state === "notoken") {
    badgeText = `● 未同期（合言葉が未入力）${pendingText}`;
    badgeColor = "#C62828";
    alertText = `⚠️ 未同期：同期の合言葉が未入力です（設定で入力）${pendingText}`;
  } else if (syncStatus.state === "unauthorized") {
    badgeText = `● 未同期（合言葉が違います）${pendingText}`;
    badgeColor = "#C62828";
    alertText = `⚠️ 未同期：合言葉が違います${pendingText}`;
  } else if (syncStatus.state === "servererror") {
    badgeText = `● 未同期（サーバーのエラー）${pendingText}`;
    badgeColor = "#C62828";
    alertText = `⚠️ 未同期：サーバーがエラーを返しました${pendingText}（タップで再送）`;
  } else if (syncStatus.state === "offline") {
    badgeText = `● 未同期（通信できません）${pendingText}`;
    badgeColor = "#E65100";
    alertText = `⚠️ 未同期：通信できません${pendingText}（タップで再送）`;
  } else if (syncStatus.state === "ok") {
    const t = syncStatus.lastOkAt;
    const hhmm = t ? `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` : "";
    if (pending > 0) {
      badgeText = `● 送信待ち${pendingText}`;
      badgeColor = "#E65100";
      alertText = `⏳ 未送信${pending}件（タップで再送）`;
    } else {
      badgeText = `● 同期済み ${hhmm}`;
      badgeColor = "#2E7D32";
    }
  } else if (pending > 0) {
    alertText = `⏳ 未送信${pending}件（タップで再送）`;
  }
  if (elements.syncStatusBadge) {
    elements.syncStatusBadge.textContent = badgeText;
    elements.syncStatusBadge.style.color = badgeColor;
  }
  const failedCount = loadFailedOps_().length;
  if (failedCount > 0 && !alertText) {
    alertText = `⚠️ Vault に書けなかった ${failedCount} 件（タップで表示）`;
  }
  if (elements.syncAlertIndicator) {
    elements.syncAlertIndicator.textContent = alertText;
    elements.syncAlertIndicator.style.display = alertText ? "inline-block" : "none";
  }
}

/**
 * 合言葉の確認（checkToken）。通れば未送信分を送る
 */
async function verifySyncToken() {
  if (!state.syncGasUrl) return false;
  try {
    const r = await fetchGasJsonpRaw_("checkToken");
    if (r && r.success) {
      setSyncStatus_("ok");
      flushOutbox();
      return true;
    }
    if (r && r.code === "UNAUTHORIZED") {
      setSyncStatus_("unauthorized");
      return false;
    }
    if (r && r.code === "NO_TOKEN") {
      setSyncStatus_("notoken");
      return false;
    }
  } catch (e) {
    setSyncStatus_("offline");
  }
  return false;
}

// --- メモの削除マーカー（削除の送信が済むまで、同期で復活させない） ---
function loadMemoTombstones_() {
  try {
    const t = JSON.parse(localStorage.getItem(MEMO_TOMBSTONE_KEY) || "{}");
    const now = Date.now();
    Object.keys(t).forEach(k => { if (now - t[k] > 3 * 24 * 3600 * 1000) delete t[k]; });
    return t;
  } catch (e) {
    return {};
  }
}

function addMemoTombstone_(text) {
  const t = loadMemoTombstones_();
  t[text] = Date.now();
  try { localStorage.setItem(MEMO_TOMBSTONE_KEY, JSON.stringify(t)); } catch (e) {}
}

function removeMemoTombstone_(text) {
  const t = loadMemoTombstones_();
  if (t[text] === undefined) return;
  delete t[text];
  try { localStorage.setItem(MEMO_TOMBSTONE_KEY, JSON.stringify(t)); } catch (e) {}
}

function hasPendingMemoDelete_(text) {
  return loadOutbox_().some(op => op.action === "deleteMemo" && op.params && op.params.text === text);
}

function hasPendingMemoOp_(text) {
  return loadOutbox_().some(op => (op.action === "updateMemo" || op.action === "deleteMemo") && op.params && op.params.text === text);
}

// メモが属するログの日付（サーバーのメモは日付ごとのログファイルにある）
function memoServerDate_(memo) {
  if (memo.serverDate) return memo.serverDate;
  const m = String(memo.date || "").match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return getTodayYmd();
}

/**
 * 会話メッセージをGAS経由でVault（Google Drive）へ追記（未送信キュー経由）
 */
function syncAppendLogToGas(role, text, timeStr) {
  if (!state.syncGasUrl || !text) return;
  const todayYmd = getTodayYmd();
  const speaker = role === "user" ? "きのぴぃ" : "相棒 (雀松朱司)";
  enqueueGasWrite("appendLog", {
    date: todayYmd,
    role: role,
    speaker: speaker,
    text: text,
    time: timeStr || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
}

/**
 * メモをGAS経由でVaultへ保存（未送信キュー経由）
 */
function syncSaveMemoToGas(memoText, timeStr) {
  if (!state.syncGasUrl || !memoText) return;
  const todayYmd = getTodayYmd();
  enqueueGasWrite("saveMemo", {
    date: todayYmd,
    text: memoText,
    time: timeStr || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
}

/**
 * 設定をGAS経由でクラウド保存（キューには入れず、結果だけ同期状態に反映）
 */
function syncSaveSettingsToGas(settingsObj) {
  if (!state.syncGasUrl || !settingsObj) return;
  sendGasWrite_("saveSettings", { settings: JSON.stringify(settingsObj), clientId: newClientId_() })
    .then(res => {
      if (res && (res.code === "UNAUTHORIZED" || res.code === "NO_TOKEN")) noteReadResult_(res);
      else if (res && res.success) console.log("☁️ Settings saved to cloud");
    })
    .catch(err => console.warn("syncSaveSettingsToGas warning:", err));
}


// 独り言（Monologue）セリフ集＆表情カット連動（Matt Stiller仕様：ハシビロコウ・AIセコンド・真顔ユーモア・半歩横で見守り）
const basePwaMonologues = [
  { text: "……ふぅ。微動だにしないのも、意外と筋力使うんですよね。", cut: "one_leg" },
  { text: "キーボードの打鍵音、いいリズム刻んでるな……。", cut: "happy" },
  { text: "……じーっ。（画面の端を見守っている）", cut: "wait" },
  { text: "今日の空気感、なかなか悪くないですね。", cut: "look_far" },
  { text: "セコンドの視界、良好。異常なし。", cut: "look_far" },
  { text: "首を少し回すか……コキッ。よし。", cut: "stretch" },
  { text: "……ふわぁ。（小さくあくびをして目を細めている）", cut: "yawn" },
  { text: "小腹空いたな……おやつでもつまむか。もぐもぐ。", cut: "snack" },
  { text: "静寂もまた、ひとつの戦略ですからね。", cut: "one_leg" },
  { text: "水分、ちゃんと摂れてるかな……まあ、大人だし大丈夫か。", cut: "drink" },
  { text: "カタカタ……集中してる時の人間って、見てて飽きないですね。", cut: "happy" },
  { text: "ハシビロコウだからって、ずっと動かないわけじゃないんですよ。", cut: "one_leg" },
  { text: "深呼吸、すー、はー。……ふぅ。", cut: "breathe" },
  { text: "……よし、次のラウンドも見守るとしますか。", cut: "towel" },
  { text: "頭の中のアイデア、サッとメモしておくといいですよ。", cut: "memo" }
];

function getRandomPwaMonologueItem() {
  const list = [...basePwaMonologues];

  // 朝刊ニュースがある場合、ニュースつぶやきを追加
  if (state.latestMorningPaper && state.latestMorningPaper.headline) {
    const rawHeadline = state.latestMorningPaper.headline.replace(/^[#\s\d\-・:：]+/, "").trim();
    const shortHeadline = rawHeadline.length > 22 ? rawHeadline.slice(0, 22) + "…" : rawHeadline;
    if (shortHeadline) {
      list.push(
        { text: `そういえば朝刊の「${shortHeadline}」……ちょっと気になりますね。`, cut: "paper" },
        { text: `今日の朝刊トップ、「${shortHeadline}」か……世の中も色々動いてますね。`, cut: "paper" }
      );
    }
  }

  // 天気データがある場合、天気のつぶやきを追加
  if (state.todayWeather && state.todayWeather.weather) {
    list.push(
      { text: `外は「${state.todayWeather.weather}」か……部屋の空気も入れ替えると良さそうですね。`, cut: null }
    );
  }

  return list[Math.floor(Math.random() * list.length)];
}

function checkPwaMonologueTimer() {
  if (!state.notifyMonologue) return;
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // 深夜（0時〜5時）やタイマー稼働中はスキップ
  if (hour >= 0 && hour < 5) return;
  if (state.activeTimer) return;

  // 毎時15分・45分に発火（※平日17:45は定時お知らせ優先のためスキップ）
  if (minutes === 15 || minutes === 45) {
    if (isWeekday && hour === 17 && minutes === 45) return;

    const monoKey = `${ymd}_${hour}_${minutes}`;
    if (state.lastMonologueKey !== monoKey) {
      state.lastMonologueKey = monoKey;
      const item = getRandomPwaMonologueItem();
      if (!item) return;

      showPwaFloatingBubble(item.text);

      if (item.cut) {
        setAvatarCut(item.cut, 8000);
      }

      if (state.voiceEnabled) {
        speakWithVoice(item.text);
      }
      console.log(`🦜 PWA Monologue triggered at ${hour}:${minutes}:`, item.text);
    }
  }
}

// 1分ごとに独り言タイマーチェック
setInterval(checkPwaMonologueTimer, 60 * 1000);
