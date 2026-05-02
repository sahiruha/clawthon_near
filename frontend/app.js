// Live Flow renderer (bilingual labels + replan detection)
(() => {
  const flow = document.getElementById("flow");
  const flowEmpty = document.getElementById("flowEmpty");
  const receipts = document.getElementById("receipts");
  const runBtn = document.getElementById("run");
  const reqEl = document.getElementById("request");
  const budgetEl = document.getElementById("budget");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const autoscrollEl = document.getElementById("autoscroll");

  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  let ws;
  let agentNodes = {};
  let stepCounter = 0;

  function connect() {
    ws = new WebSocket(`${wsProto}://${location.host}/ws`);
    ws.onmessage = (ev) => {
      try { handle(JSON.parse(ev.data)); } catch (_) {}
    };
    ws.onclose = () => setTimeout(connect, 800);
  }
  connect();

  // ---------- helpers ----------
  function el(tag, opts = {}) {
    const e = document.createElement(tag);
    if (opts.cls) e.className = opts.cls;
    if (opts.text != null) e.textContent = opts.text;
    if (opts.href) e.setAttribute("href", opts.href);
    if (opts.target) e.setAttribute("target", opts.target);
    return e;
  }

  function fmtTs(ts) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour12: false });
  }
  function pad2(n) { return String(n).padStart(2, "0"); }

  // SVG icons
  const ICONS = {
    rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13a8 8 0 0 1 8-8h6v6a8 8 0 0 1-8 8H5z"/><path d="M5 19l-2 2"/><circle cx="14" cy="10" r="2"/></svg>',
    pulse:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
    plane:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l8-3 4-7 2 1-1 7 7 4-1 2-8-2-4 7-2-1 1-7-6-1z"/></svg>',
    hotel:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/></svg>',
    food:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-2 0-3 1-3 4v6h3v8"/></svg>',
    cloud:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1-1-7.9 6 6 0 0 1 11.7 1.4A4 4 0 0 1 17 18z"/></svg>',
    star:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 10 17 15 18 22 12 19 6 22 7 15 2 10 9 9"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
    check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
    error:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 17h.01"/></svg>',
    finish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
    stop:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  };

  function setIcon(node, name) {
    const ic = node.querySelector(".icon");
    if (!ic) return;
    ic.textContent = "";
    const wrap = document.createElement("span");
    wrap.style.lineHeight = "0";
    wrap.innerHTML = ICONS[name] || ICONS.pulse; // 静的SVGのみ. eslint-disable-line
    ic.appendChild(wrap);
  }

  // ---- bilingual label/meta builder ----
  // `label` / `meta` の値は `{primary, secondary}` の object か string を受ける
  function asDual(v) {
    if (v == null) return { primary: "", secondary: null };
    if (typeof v === "string") return { primary: v, secondary: null };
    return { primary: v.primary || "", secondary: v.secondary || null };
  }
  function renderDual(target, dual, primaryCls = "lbl-primary", secondaryCls = "lbl-secondary") {
    target.textContent = "";
    const p = el("span", { cls: primaryCls, text: dual.primary });
    target.appendChild(p);
    if (dual.secondary) {
      const s = el("span", { cls: secondaryCls, text: dual.secondary });
      target.appendChild(s);
    }
  }
  function setLabel(node, dualOrStr) {
    const lbl = node.querySelector(".label");
    if (lbl) renderDual(lbl, asDual(dualOrStr));
  }
  function setMeta(node, str) {
    const m = node.querySelector(".meta");
    if (m) m.textContent = str || "";
  }
  function setMetaWithLink(node, prefix, link) {
    const m = node.querySelector(".meta");
    if (!m) return;
    m.textContent = "";
    if (prefix) m.appendChild(document.createTextNode(prefix + " "));
    m.appendChild(el("a", { text: link.text, href: link.href, target: "_blank" }));
  }
  function setTs(node, ts) { const x = node.querySelector(".ts"); if (x && ts) x.textContent = fmtTs(ts); }

  function pillText(status) {
    const T = window.t || ((k) => k);
    if (status === "active") return T("stStatusActive");
    if (status === "success") return T("stStatusSuccess");
    if (status === "error")   return T("stStatusError");
    if (status === "done")    return T("stStatusDone");
    if (status === "replan")  return T("stStatusReplan");
    return status.toUpperCase();
  }
  function setStatus(node, status) {
    if (!node) return;
    node.classList.remove("status-active", "status-success", "status-error", "status-done", "status-replan");
    node.classList.add(`status-${status}`);
    const pill = node.querySelector(".pill");
    if (pill) pill.textContent = pillText(status);
  }

  function makeNode({ category, icon, label, meta, status = "active", ts, kind = "" }) {
    if (flowEmpty) flowEmpty.style.display = "none";
    stepCounter += 1;
    const node = document.createElement("li");
    node.className = `node cat-${category} status-${status}` + (kind ? " " + kind : "");

    const step = el("div", { cls: "step", text: pad2(stepCounter) });
    const ic = el("div", { cls: "icon" });
    const labelEl = el("div", { cls: "label" });
    renderDual(labelEl, asDual(label));
    const metaEl = el("div", { cls: "meta", text: meta || "" });
    const right = el("div", { cls: "right-meta" });
    const pill = el("div", { cls: "pill", text: pillText(status) });
    const tsEl = el("div", { cls: "ts", text: ts ? fmtTs(ts) : "" });
    right.appendChild(pill);
    right.appendChild(tsEl);

    node.appendChild(step);
    node.appendChild(ic);
    node.appendChild(labelEl);
    node.appendChild(metaEl);
    node.appendChild(right);

    flow.appendChild(node);
    setIcon(node, icon);
    autoscroll();
    return node;
  }

  function autoscroll() {
    if (autoscrollEl?.checked) {
      const right = document.querySelector(".right.card");
      if (right) right.scrollTop = right.scrollHeight;
    }
  }

  function chainCategory(chain) { return chain === "xrpl" ? "xrpl" : "near"; }
  function agentIcon(agent, chain) {
    if (agent === "FlightAgent") return "plane";
    if (agent === "HotelAgent") return "hotel";
    if (agent === "LocalGuideAgent") return "food";
    return chain === "xrpl" ? "wallet" : "shield";
  }

  function appendReceipt(agent, r) {
    const empty = receipts.querySelector(".receipts-empty");
    if (empty) empty.remove();

    const card = el("div", { cls: `receipt ${r.chain}` });
    const ic = el("div", { cls: "icon", text: r.chain === "near" ? "Ⓝ" : "✕" });
    const body = el("div", { cls: "body" });
    body.appendChild(el("div", { cls: "agent", text: agent }));
    const native = r.amount_native != null ? r.amount_native.toFixed(2) : "?";
    const sym = r.chain === "near" ? "NEAR" : "XRP";
    body.appendChild(el("div", { cls: "meta", text: `${native} ${sym}` }));
    body.appendChild(el("a", {
      cls: "tx",
      text: `tx: ${(r.tx_hash || "").slice(0, 8)}...${(r.tx_hash || "").slice(-4)}`,
      href: r.explorer_url,
      target: "_blank",
    }));
    const right = el("div", { cls: "right-col" });
    right.appendChild(el("div", { cls: "amount", text: `$${r.amount_usd}` }));
    right.appendChild(el("span", { cls: "pill", text: window.t ? window.t("confirmed") : "CONFIRMED" }));
    card.appendChild(ic);
    card.appendChild(body);
    card.appendChild(right);
    receipts.appendChild(card);
  }

  // ---------- event handler ----------
  function handle(event) {
    const T = window.t || ((k) => k);
    const D = window.tDual || ((k, ...p) => ({ primary: T(k, ...p), secondary: null }));
    const t = event.type;

    if (t === "flow.start") {
      flow.textContent = "";
      receipts.textContent = "";
      const empty = el("div", { cls: "receipts-empty" });
      const dE = D("receiptsEmpty");
      empty.appendChild(el("div", { text: dE.primary }));
      if (dE.secondary) empty.appendChild(el("div", { text: dE.secondary, cls: "i18n-secondary" }));
      receipts.appendChild(empty);
      if (flowEmpty) flowEmpty.style.display = "none";
      agentNodes = {};
      stepCounter = 0;
      makeNode({
        category: "ironclaw",
        icon: "rocket",
        label: D("flowStarted", event.request),
        meta: D("budgetMeta", event.budget_usd).primary,
        status: "success",
        ts: event.ts,
      });
    } else if (t === "ironclaw.checking") {
      agentNodes._ironclawCheck = makeNode({
        category: "ironclaw", icon: "pulse",
        label: D("icCheck"), meta: "", status: "active", ts: event.ts,
      });
    } else if (t === "ironclaw.ready") {
      const ann = event.announce || {};
      const ver = ann.binary_version || "";
      makeNode({
        category: "ironclaw", icon: "shield",
        label: event.available ? D("icReady") : D("icOffline"),
        meta: ver ? T("icBinary", ver) : "",
        status: event.available ? "success" : "error",
        ts: event.ts,
      });
    } else if (t === "market.posting") {
      agentNodes._market = makeNode({
        category: "nearai", icon: "cloud",
        label: D("marketPosting"), meta: "",
        status: "active", ts: event.ts,
      });
    } else if (t === "market.registered") {
      const n = agentNodes._market;
      const short = (event.agent_id || "").slice(0, 8);
      if (n) {
        setLabel(n, D("marketRegistered", short));
        setMeta(n, `near_account: ${(event.near_account_id || "").slice(0, 16)}…`);
        setStatus(n, "success");
        setIcon(n, "star");
        setTs(n, event.ts);
      }
    } else if (t === "market.skipped") {
      makeNode({
        category: "nearai", icon: "wallet",
        label: D("marketSkipped"),
        meta: `mainnet topup → ${(event.deposit_account || "").slice(0, 24)}…`,
        status: "error",
        ts: event.ts,
      });
    } else if (t === "market.posted") {
      const n = agentNodes._market;
      if (n) {
        setLabel(n, D("marketPosted", event.job_id));
        setMetaWithLink(n, "", { text: event.market_url || event.job_id, href: event.market_url || "#" });
        setStatus(n, "success");
        setIcon(n, "star");
        setTs(n, event.ts);
      }
    } else if (t === "market.error") {
      const n = agentNodes._market;
      if (n) {
        setLabel(n, D("marketError", String(event.error || "").slice(0, 60)));
        setMeta(n, String(event.error || "").slice(0, 200));
        setStatus(n, "error");
        setIcon(n, "error");
        setTs(n, event.ts);
      }
    } else if (t === "agent.thinking") {
      const cat = chainCategory(event.chain);
      agentNodes[event.agent] = makeNode({
        category: cat, icon: agentIcon(event.agent, event.chain),
        label: D("agentThinking", event.agent),
        meta: T("agentChain", event.chain),
        status: "active", ts: event.ts,
      });
    } else if (t === "agent.quoted") {
      const n = agentNodes[event.agent];
      const q = event.quote;
      if (n) {
        setLabel(n, D("agentQuoted", event.agent, q.description));
        setMeta(n, `$${q.amount_usd} → ${q.chain}:${(q.receiver || "?").slice(0, 24)}`);
        setStatus(n, "success");
        setTs(n, event.ts);
      }
    } else if (t === "agent.error") {
      const n = agentNodes[event.agent];
      if (n) {
        setLabel(n, D("agentFailed", event.agent));
        setMeta(n, String(event.error || "").slice(0, 100));
        setStatus(n, "error");
        setTs(n, event.ts);
      }
    } else if (t === "optimizer.thinking") {
      agentNodes._optimizer = makeNode({
        category: "nearai", icon: "cloud",
        label: D("optimizerThinking", event.model || "Qwen3-30B"),
        meta: "", status: "active", ts: event.ts,
      });
    } else if (t === "optimizer.decided") {
      const n = agentNodes._optimizer;
      const d = event.decision || {};
      const list = (d.accepted || []).map(a => a.replace("Agent","")).join(", ");
      if (n) {
        setLabel(n, D("optimizerDecided", list));
        setMeta(n, `$${d.total_usd} • ${(d.reasoning || "").slice(0, 80)}`);
        setStatus(n, "success");
        setTs(n, event.ts);
      }
    } else if (t === "optimizer.error") {
      const n = agentNodes._optimizer;
      if (n) {
        setLabel(n, D("optimizerError"));
        setMeta(n, String(event.error || "").slice(0, 100));
        setStatus(n, "error");
        setTs(n, event.ts);
      }
    } else if (t === "payment.sending") {
      const cat = chainCategory(event.chain);
      agentNodes["pay:" + event.agent] = makeNode({
        category: cat, icon: "wallet",
        label: D("paying", event.agent, event.chain),
        meta: `$${event.amount_usd}`,
        status: "active", ts: event.ts,
      });
    } else if (t === "payment.confirmed") {
      const n = agentNodes["pay:" + event.agent];
      const r = event.receipt || {};
      if (n) {
        setLabel(n, D("paid", event.agent, r.chain));
        setMetaWithLink(n, `$${r.amount_usd} →`, {
          text: `tx: ${(r.tx_hash || "").slice(0, 8)}...${(r.tx_hash || "").slice(-4)}`,
          href: r.explorer_url,
        });
        setStatus(n, "success");
        n.classList.remove("cat-near", "cat-xrpl");
        n.classList.add("cat-" + chainCategory(r.chain));
        setIcon(n, "check");
        setTs(n, event.ts);
      }
      appendReceipt(event.agent, r);
    } else if (t === "payment.failed") {
      const n = agentNodes["pay:" + event.agent];
      if (n) {
        setLabel(n, D("payFailed", event.agent, event.chain));
        setMeta(n, String(event.error || "").slice(0, 120));
        setStatus(n, "error");
        setIcon(n, "error");
        setTs(n, event.ts);
      }
    } else if (t === "preflight.ok") {
      makeNode({
        category: "nearai", icon: "shield",
        label: D("preflightOk"),
        meta: "",
        status: "success",
        ts: event.ts,
      });
    } else if (t === "flow.needs_replan") {
      // 詳細ラベルを reason に応じて構築
      let detail;
      if (event.reason === "quote_failed") {
        detail = D("replanQuoteFailed", event.failed_agents || []);
      } else if (event.reason === "partial_acceptance") {
        detail = D("replanPartialAccept", event.missing_agents || []);
      } else if (event.reason === "optimizer_error") {
        detail = D("replanOptimizerError");
      } else if (event.reason === "settlement_partial") {
        detail = D("replanSettlementPartial", event.failed_agents || []);
      } else if (event.reason === "insufficient_balance_near") {
        detail = D("replanInsufficientNear");
      } else if (event.reason === "insufficient_balance_xrpl") {
        detail = D("replanInsufficientXrpl");
      } else if (event.reason === "preflight_error") {
        detail = D("replanPreflightError");
      } else {
        detail = { primary: event.message || "", secondary: event.message_en || null };
      }
      // タイトル + 理由 を2つのノードで
      makeNode({
        category: "done", icon: "stop",
        label: D("replanTitle"),
        meta: "",
        status: "replan",
        ts: event.ts,
        kind: "replan",
      });
      makeNode({
        category: "done", icon: "error",
        label: detail,
        meta: event.message || "",
        status: "replan",
        ts: event.ts,
      });
      runBtn.disabled = false;
    } else if (t === "flow.done") {
      makeNode({
        category: "done", icon: "finish",
        label: D("flowDone", event.total_paid_usd),
        meta: T("flowDoneMeta", (event.receipts || []).length),
        status: "done",
        ts: event.ts,
        kind: "done",
      });
      runBtn.disabled = false;
    }
  }

  // i18n 切替時にラン中ボタンの表示を再評価 (DONEなど)
  document.addEventListener("i18n:changed", () => {
    document.querySelectorAll(".node .pill").forEach((p) => {
      const node = p.closest(".node");
      if (!node) return;
      const cls = [...node.classList].find((c) => c.startsWith("status-"));
      if (cls) p.textContent = pillText(cls.slice("status-".length));
    });
    document.querySelectorAll(".receipt .pill").forEach((p) => {
      p.textContent = window.t ? window.t("confirmed") : "CONFIRMED";
    });
  });

  runBtn.onclick = async () => {
    const request = reqEl.value.trim();
    if (!request) return;
    runBtn.disabled = true;
    try {
      await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request,
          budget_usd: parseFloat(budgetEl.value || "500"),
          start_date: startDateEl?.value || null,
          end_date: endDateEl?.value || null,
        }),
      });
    } catch (e) {
      alert("failed to start: " + e);
      runBtn.disabled = false;
    }
  };
})();
