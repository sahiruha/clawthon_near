// WebSocket でフロー進捗を受け取り、画面に流す
(() => {
  const flow = document.getElementById("flow");
  const receipts = document.getElementById("receipts");
  const runBtn = document.getElementById("run");
  const reqEl = document.getElementById("request");
  const budgetEl = document.getElementById("budget");

  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  let ws;
  let agentNodes = {};

  function connect() {
    ws = new WebSocket(`${wsProto}://${location.host}/ws`);
    ws.onmessage = (ev) => {
      const event = JSON.parse(ev.data);
      handle(event);
    };
    ws.onclose = () => setTimeout(connect, 800);
  }
  connect();

  function el(tag, opts = {}) {
    const e = document.createElement(tag);
    if (opts.cls) e.className = opts.cls;
    if (opts.text != null) e.textContent = opts.text;
    if (opts.href) e.setAttribute("href", opts.href);
    if (opts.target) e.setAttribute("target", opts.target);
    return e;
  }

  function makeNode({ kind, label, meta, classes = [], status = "active" }) {
    const node = el("div", { cls: ["node", kind, ...classes, status].join(" ") });
    node.appendChild(el("div", { cls: "dot" }));
    node.appendChild(el("div", { cls: "label", text: label }));
    node.appendChild(el("div", { cls: "meta", text: meta || "" }));
    flow.appendChild(node);
    flow.scrollTop = flow.scrollHeight;
    return node;
  }

  function setStatus(node, status) {
    if (!node) return;
    node.classList.remove("active", "success", "error");
    node.classList.add(status);
  }

  function setMetaText(node, text) {
    const meta = node.querySelector(".meta");
    if (meta) meta.textContent = text;
  }

  function setLabelText(node, text) {
    const label = node.querySelector(".label");
    if (label) label.textContent = text;
  }

  function setMetaWithLink(node, text, link) {
    const meta = node.querySelector(".meta");
    if (!meta) return;
    meta.textContent = "";
    meta.appendChild(document.createTextNode(text + " "));
    meta.appendChild(el("a", { text: link.text, href: link.href, target: "_blank" }));
  }

  function fmtTs(ts) {
    return new Date(ts * 1000).toLocaleTimeString();
  }

  function appendReceipt(agent, r) {
    const card = el("div", { cls: `receipt ${r.chain}` });
    card.appendChild(el("div", { cls: "agent", text: `${agent} — $${r.amount_usd}` }));
    const native = r.amount_native != null ? r.amount_native.toFixed(4) : "?";
    const sym = r.chain === "near" ? "NEAR" : "XRP";
    card.appendChild(el("div", { text: `${r.chain.toUpperCase()} • ${native} ${sym}` }));
    card.appendChild(el("a", {
      cls: "tx",
      text: r.tx_hash || "",
      href: r.explorer_url,
      target: "_blank",
    }));
    receipts.appendChild(card);
  }

  function handle(event) {
    const t = event.type;
    if (t === "flow.start") {
      flow.textContent = "";
      receipts.textContent = "";
      agentNodes = {};
      makeNode({
        kind: "ironclaw",
        label: `🛰️ Flow started — "${event.request}"`,
        meta: `budget $${event.budget_usd} • ${fmtTs(event.ts)}`,
        status: "success",
      });
    } else if (t === "ironclaw.checking") {
      makeNode({
        kind: "ironclaw",
        label: "IronClaw orchestrator: health check...",
        meta: fmtTs(event.ts),
      });
    } else if (t === "ironclaw.ready") {
      makeNode({
        kind: "ironclaw",
        label: event.available
          ? "✅ IronClaw orchestrator: ready (port 8081)"
          : "⚠️ IronClaw orchestrator: announced (offline fallback)",
        meta: JSON.stringify(event.announce).slice(0, 60),
        status: event.available ? "success" : "error",
      });
    } else if (t === "agent.thinking") {
      const n = makeNode({
        kind: "agent",
        label: `🤖 ${event.agent} thinking...`,
        meta: `chain: ${event.chain}`,
      });
      agentNodes[event.agent] = n;
    } else if (t === "agent.quoted") {
      const n = agentNodes[event.agent];
      const q = event.quote;
      if (n) {
        setLabelText(n, `💬 ${event.agent}: ${q.description}`);
        setMetaText(n, `$${q.amount_usd} → ${q.chain}:${(q.receiver || "?").slice(0, 24)}`);
        setStatus(n, "success");
      }
    } else if (t === "agent.error") {
      const n = agentNodes[event.agent];
      if (n) {
        setLabelText(n, `❌ ${event.agent} failed`);
        setMetaText(n, String(event.error || "").slice(0, 80));
        setStatus(n, "error");
      }
    } else if (t === "optimizer.thinking") {
      const n = makeNode({
        kind: "optimizer",
        label: `🧠 NEAR AI Cloud (${event.model}): optimizing combination...`,
        meta: fmtTs(event.ts),
      });
      agentNodes.optimizer = n;
    } else if (t === "optimizer.decided") {
      const n = agentNodes.optimizer;
      const d = event.decision;
      if (n) {
        setLabelText(n, `🧠 NEAR AI: accepted [${(d.accepted || []).join(", ")}]`);
        setMetaText(n, `$${d.total_usd} • ${(d.reasoning || "").slice(0, 80)}`);
        setStatus(n, "success");
      }
    } else if (t === "optimizer.error") {
      const n = agentNodes.optimizer;
      if (n) {
        setLabelText(n, "🧠 NEAR AI: error (fallback applied)");
        setMetaText(n, String(event.error || "").slice(0, 100));
        setStatus(n, "error");
      }
    } else if (t === "payment.sending") {
      const n = makeNode({
        kind: "payment",
        classes: [event.chain],
        label: `💸 Paying ${event.agent} via ${event.chain.toUpperCase()}...`,
        meta: `$${event.amount_usd}`,
      });
      agentNodes["pay:" + event.agent] = n;
    } else if (t === "payment.confirmed") {
      const n = agentNodes["pay:" + event.agent];
      const r = event.receipt;
      if (n) {
        setLabelText(n, `✅ ${event.agent} paid via ${r.chain.toUpperCase()}`);
        setMetaWithLink(n, `$${r.amount_usd} →`, {
          text: (r.tx_hash || "").slice(0, 16) + "…",
          href: r.explorer_url,
        });
        setStatus(n, "success");
      }
      appendReceipt(event.agent, r);
    } else if (t === "payment.failed") {
      const n = agentNodes["pay:" + event.agent];
      if (n) {
        setLabelText(n, `❌ ${event.agent} payment failed (${event.chain})`);
        setMetaText(n, String(event.error || "").slice(0, 120));
        setStatus(n, "error");
      }
    } else if (t === "flow.done") {
      makeNode({
        kind: "done",
        label: `🎉 Flow complete — total paid $${event.total_paid_usd}`,
        meta: `${(event.receipts || []).length} on-chain transactions`,
        status: "success",
      });
      runBtn.disabled = false;
    }
  }

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
        }),
      });
    } catch (e) {
      alert("failed to start: " + e);
      runBtn.disabled = false;
    }
  };
})();
