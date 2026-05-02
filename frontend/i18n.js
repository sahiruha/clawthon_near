// 軽量 i18n: モード ja / en / both (併記)
// 表示モードは LocalStorage "atc.lang" に保存。デフォルトは "both".
// - 静的テキストは applyStaticStrings() で書き換え
// - 動的テキスト (フローイベント) は window.t(key, ...params) または
//   window.tDual(key, ...params) で取得
(() => {
  const STRINGS = {
    ja: {
      appTitle: "Agentic Travel Concierge",
      appSubtitle: "Clawathon Tokyo Edition",
      statusTitle: "システム正常",
      statusSub: "すべてのサービス稼働中",
      step1Title: "自然言語リクエスト",
      requestPlaceholder: "例: 来週バンコクに行きたい、予算500ドル",
      budgetLabel: "予算 (USD)",
      startDateLabel: "開始日",
      endDateLabel: "終了日",
      orchestrate: "Orchestrate",
      step2Title: "オンチェーン受領",
      viewAll: "すべて表示",
      receiptsEmpty: "まだ受領はありません — Orchestrate を押すとオンチェーン決済がここに表示されます。",
      step3Title: "Live Flow",
      step3Sub: "リアルタイム・オーケストレーション・タイムライン",
      autoscroll: "自動スクロール",
      flowEmptyPrefix: "",
      flowEmptyKey: "▶ Orchestrate",
      flowEmptySuffix: " を押すと、エージェントたちのリアルタイムな協調が見えます。",
      flowStarted: (req) => `フロー開始 — "${req}"`,
      budgetMeta: (b) => `予算 $${b}`,
      icCheck: "IronClaw orchestrator: ヘルスチェック中…",
      icReady: "✅ IronClaw orchestrator: 準備完了 (port 3000)",
      icOffline: "⚠️ IronClaw orchestrator: オフライン (フォールバック)",
      icBinary: (v) => `binary version: ${v}`,
      agentThinking: (a) => `${a}: 思考中…`,
      agentChain: (c) => `chain: ${c}`,
      agentQuoted: (a, desc) => `${a}: ${desc}`,
      agentFailed: (a) => `❌ ${a} 失敗`,
      optimizerThinking: (m) => `NEAR AI Cloud (${m}): 組合せ最適化中…`,
      optimizerDecided: (list) => `NEAR AI: 採択 [${list}]`,
      optimizerError: "🧠 NEAR AI: エラー (フォールバック適用)",
      paying: (a, c) => `${a} に ${c.toUpperCase()} で送金中…`,
      paid: (a, c) => `${a} を ${c.toUpperCase()} で支払い完了`,
      payFailed: (a, c) => `❌ ${a} 支払い失敗 (${c})`,
      flowDone: (total) => `フロー完了 — 合計 $${total} 支払い済み`,
      flowDoneMeta: (n) => `${n} 件のオンチェーン取引`,
      replanTitle: "🛑 再提案が必要",
      replanQuoteFailed: (failed) => `見積失敗: ${failed.join(", ")} → 部分支払いを避けて中止`,
      replanPartialAccept: (missing) => `AI が ${missing.join(", ")} を不採択 → 部分支払いを避けて中止`,
      replanOptimizerError: "最適化エラー → 中止",
      replanSettlementPartial: (failed) => `決済中に失敗 (${failed.join(", ")}) → 再提案要`,
      replanInsufficientNear: "NEAR 残高不足 → 1件も決済せず中止",
      replanInsufficientXrpl: "XRP 残高不足 → 1件も決済せず中止",
      replanPreflightError: "残高確認エラー → 中止",
      preflightOk: "✅ 残高チェック OK — 決済を一括発火",
      marketPosting: "📡 NEAR AI Market に接続中…",
      marketRegistered: (agent) => `📡 NEAR AI Market 登録済 (agent ${agent}…)`,
      marketSkipped: "📡 NEAR AI Market: ジョブ投稿は mainnet 残高がないためスキップ",
      marketPosted: (jobId) => `📡 NEAR AI Market 投稿完了: job ${jobId}`,
      marketError: (msg) => `⚠️ NEAR AI Market エラー: ${msg}`,
      stStatusActive: "ACTIVE",
      stStatusSuccess: "SUCCESS",
      stStatusError: "ERROR",
      stStatusDone: "DONE",
      stStatusReplan: "REPLAN",
      confirmed: "完了",
    },
    en: {
      appTitle: "Agentic Travel Concierge",
      appSubtitle: "Clawathon Tokyo Edition",
      statusTitle: "System healthy",
      statusSub: "All services operational",
      step1Title: "Natural-language request",
      requestPlaceholder: "e.g. Bangkok next week, budget 500 USD",
      budgetLabel: "Budget (USD)",
      startDateLabel: "Start date",
      endDateLabel: "End date",
      orchestrate: "Orchestrate",
      step2Title: "On-chain Receipts",
      viewAll: "View all",
      receiptsEmpty: "No receipts yet — run an orchestration to see on-chain payments here.",
      step3Title: "Live Flow",
      step3Sub: "Real-time orchestration timeline",
      autoscroll: "Auto-scroll",
      flowEmptyPrefix: "Press ",
      flowEmptyKey: "▶ Orchestrate",
      flowEmptySuffix: " to see the agents collaborate in real time.",
      flowStarted: (req) => `Flow started — "${req}"`,
      budgetMeta: (b) => `budget $${b}`,
      icCheck: "IronClaw orchestrator: health check...",
      icReady: "✅ IronClaw orchestrator: ready (port 3000)",
      icOffline: "⚠️ IronClaw orchestrator: offline (fallback)",
      icBinary: (v) => `binary version: ${v}`,
      agentThinking: (a) => `${a} thinking...`,
      agentChain: (c) => `chain: ${c}`,
      agentQuoted: (a, desc) => `${a}: ${desc}`,
      agentFailed: (a) => `❌ ${a} failed`,
      optimizerThinking: (m) => `NEAR AI Cloud (${m}): optimizing combination...`,
      optimizerDecided: (list) => `NEAR AI: accepted [${list}]`,
      optimizerError: "🧠 NEAR AI: error (fallback applied)",
      paying: (a, c) => `Paying ${a} via ${c.toUpperCase()}...`,
      paid: (a, c) => `${a} paid via ${c.toUpperCase()}`,
      payFailed: (a, c) => `❌ ${a} payment failed (${c})`,
      flowDone: (total) => `Flow complete — total paid $${total}`,
      flowDoneMeta: (n) => `${n} on-chain transactions`,
      replanTitle: "🛑 Replan required",
      replanQuoteFailed: (failed) => `Quote failed: ${failed.join(", ")} → aborted to avoid partial payment`,
      replanPartialAccept: (missing) => `AI did not accept ${missing.join(", ")} → aborted to avoid partial payment`,
      replanOptimizerError: "Optimization error → aborted",
      replanSettlementPartial: (failed) => `Settlement failed (${failed.join(", ")}) → replan required`,
      replanInsufficientNear: "Insufficient NEAR balance → aborted without any payment",
      replanInsufficientXrpl: "Insufficient XRP balance → aborted without any payment",
      replanPreflightError: "Balance precheck failed → aborted",
      preflightOk: "✅ Balance check OK — settling all payments",
      marketPosting: "📡 Connecting to NEAR AI Market…",
      marketRegistered: (agent) => `📡 Registered on NEAR AI Market (agent ${agent}…)`,
      marketSkipped: "📡 NEAR AI Market: job post skipped (no mainnet balance)",
      marketPosted: (jobId) => `📡 Posted to NEAR AI Market: job ${jobId}`,
      marketError: (msg) => `⚠️ NEAR AI Market error: ${msg}`,
      stStatusActive: "ACTIVE",
      stStatusSuccess: "SUCCESS",
      stStatusError: "ERROR",
      stStatusDone: "DONE",
      stStatusReplan: "REPLAN",
      confirmed: "CONFIRMED",
    },
  };

  const STORAGE_KEY = "atc.lang"; // "ja" | "en" | "both"
  const stored = localStorage.getItem(STORAGE_KEY);
  let mode = stored && ["ja", "en", "both"].includes(stored) ? stored : "both";

  // primary / secondary 言語を返す (both のときは ja / en)
  function langs() {
    if (mode === "ja") return { primary: "ja", secondary: null };
    if (mode === "en") return { primary: "en", secondary: null };
    return { primary: "ja", secondary: "en" };
  }

  function pick(lang, key, params) {
    const v = STRINGS[lang][key];
    if (typeof v === "function") return v(...(params || []));
    return v ?? key;
  }

  // 単言語版: モードに従い primary を返す
  function t(key, ...params) {
    return pick(langs().primary, key, params);
  }

  // 併記版: { primary, secondary } を返す。both 以外は secondary が null
  function tDual(key, ...params) {
    const { primary, secondary } = langs();
    return {
      primary: pick(primary, key, params),
      secondary: secondary ? pick(secondary, key, params) : null,
    };
  }

  function applyStaticStrings() {
    document.documentElement.lang = langs().primary;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      const dual = tDual(k);
      el.textContent = "";
      const main = document.createElement("span");
      main.className = "i18n-primary";
      main.textContent = dual.primary;
      el.appendChild(main);
      if (dual.secondary) {
        const sub = document.createElement("span");
        sub.className = "i18n-secondary";
        sub.textContent = dual.secondary;
        el.appendChild(sub);
      }
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const k = el.getAttribute("data-i18n-ph");
      const dual = tDual(k);
      // placeholder は1行表示しかできないので、both のときは 全/英 を改行で繋ぐ
      el.setAttribute("placeholder", dual.secondary ? `${dual.primary}\n${dual.secondary}` : dual.primary);
    });
    // flow-empty (strong を含む合成テキスト)
    const flowEmpty = document.getElementById("flowEmpty");
    if (flowEmpty) {
      flowEmpty.textContent = "";
      const buildLine = (lang) => {
        const wrap = document.createElement("div");
        wrap.appendChild(document.createTextNode(pick(lang, "flowEmptyPrefix")));
        const strong = document.createElement("strong");
        strong.textContent = pick(lang, "flowEmptyKey");
        wrap.appendChild(strong);
        wrap.appendChild(document.createTextNode(pick(lang, "flowEmptySuffix")));
        return wrap;
      };
      const { primary, secondary } = langs();
      const p = buildLine(primary);
      p.classList.add("i18n-primary");
      flowEmpty.appendChild(p);
      if (secondary) {
        const s = buildLine(secondary);
        s.classList.add("i18n-secondary");
        flowEmpty.appendChild(s);
      }
    }
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-lang") === mode);
    });
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { mode } }));
  }

  function setMode(next) {
    if (!["ja", "en", "both"].includes(next)) return;
    mode = next;
    localStorage.setItem(STORAGE_KEY, mode);
    applyStaticStrings();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.addEventListener("click", () => setMode(b.getAttribute("data-lang")));
    });
    applyStaticStrings();
  });

  window.t = t;
  window.tDual = tDual;
  window.getLang = () => mode;
  window.setLang = setMode;
})();
