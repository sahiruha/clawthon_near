// 軽量 i18n: data-i18n / data-i18n-ph / data-i18n-rich を切り替える
// 動的テキストは window.t(key, params) で参照する
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
      stStatusActive: "ACTIVE",
      stStatusSuccess: "SUCCESS",
      stStatusError: "ERROR",
      stStatusDone: "DONE",
      confirmed: "CONFIRMED",
    },
    en: {
      appTitle: "Agentic Travel Concierge",
      appSubtitle: "Clawathon Tokyo Edition",
      statusTitle: "System healthy",
      statusSub: "All services operational",
      step1Title: "Natural-language request",
      requestPlaceholder: "e.g. Bangkok next week, budget 500 USD",
      budgetLabel: "Budget (USD)",
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
      stStatusActive: "ACTIVE",
      stStatusSuccess: "SUCCESS",
      stStatusError: "ERROR",
      stStatusDone: "DONE",
      confirmed: "CONFIRMED",
    },
  };

  const STORAGE_KEY = "atc.lang";
  const initial = localStorage.getItem(STORAGE_KEY) || (navigator.language?.startsWith("ja") ? "ja" : "en");
  let current = STRINGS[initial] ? initial : "en";

  function t(key, ...params) {
    const v = STRINGS[current][key];
    if (typeof v === "function") return v(...params);
    return v ?? key;
  }

  function applyStaticStrings() {
    document.documentElement.lang = current;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    // flow-empty は <strong> を含むので、安全に組み立てる
    const flowEmpty = document.getElementById("flowEmpty");
    if (flowEmpty) {
      flowEmpty.textContent = "";
      flowEmpty.appendChild(document.createTextNode(t("flowEmptyPrefix")));
      const strong = document.createElement("strong");
      strong.textContent = t("flowEmptyKey");
      flowEmpty.appendChild(strong);
      flowEmpty.appendChild(document.createTextNode(t("flowEmptySuffix")));
    }
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-lang") === current);
    });
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: current } }));
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    current = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyStaticStrings();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.addEventListener("click", () => setLang(b.getAttribute("data-lang")));
    });
    applyStaticStrings();
  });

  window.t = t;
  window.getLang = () => current;
  window.setLang = setLang;
})();
