# 🛰 Agentic Travel Concierge
**Clawathon Tokyo Edition — 2026/05/02 — Team sahiruha**

> **AI Reasoning（思考）と Blockchain Execution（執行）を、人間を介さずひとつのフローで完結させる。**

---

## 1. Concept — 一言で

> **「自然言語ひとつで、複数の自律 AI エージェントが並列に見積を出し、AI が組合せを判断し、複数チェーンで実トランザクションが走る。失敗するくらいなら 1 円も払わない。」**

ハッカソンのテーマ「**AI Reasoning → Agent Orchestration → On-chain Settlement**」を、3 つのレイヤーで一気通貫実装した実動デモ。

---

## 2. Why now — 何が新しいか

| 既存の Agent デモ | 本作 |
|---|---|
| 単一エージェントが LLM と話すだけ | **3 エージェントが並列に bid → AI が組合せを判断** |
| 決済はモック / Mainnet 一本 | **NEAR + XRPL の 2 チェーン同時実送金** + **Mainnet ジョブ post** |
| 「AI が暴走して全部支払う」 | **オール・オア・ナッシング保証** (Preflight 残高検証 + 部分採択拒否) |
| エンドツーエンドが UI で見えない | **WebSocket でリアルタイム可視化**、各イベントに on-chain explorer link |
| 英語 or 日本語のみ | **日英併記モード** (デモは審査員言語に合わせて即切替) |

---

## 3. Demo Scenario (3 分)

ユーザーが入力するのはこれだけ：

> 「来週バンコクに行きたい、予算 500 ドル」

画面右の Live Flow で 13 ステップが順次点灯する：

```
01 🚀  Flow started — "来週バンコクに行きたい"                     SUCCESS
02 ⛨  IronClaw orchestrator: ready (port 3000)                  SUCCESS
03 ☁  NEAR AI Market: registered (agent 4099b1e1…)              SUCCESS
04 ⭐  Posted to NEAR AI Market: job b7393e36… (mainnet, 1 NEAR) SUCCESS
05 ✈  FlightAgent: Round-trip economy flight  $295               SUCCESS
06 🏨  HotelAgent: 3 nights near Sukhumvit    $185               SUCCESS
07 🍴  LocalGuideAgent: Half-day food tour    $75                SUCCESS
08 ☁  NEAR AI Cloud (Qwen3-30B): optimizing combination…       ACTIVE
09 ⭐  NEAR AI: accepted [Flight, Hotel, LocalGuide]            SUCCESS
10 ⛨  Balance check OK — settling all payments                 SUCCESS
11 ✓  FlightAgent paid via NEAR  → testnet.nearblocks.io/...   SUCCESS
12 ✓  HotelAgent  paid via NEAR  → testnet.nearblocks.io/...   SUCCESS
13 ✓  LocalGuideAgent paid via XRPL → testnet.xrpl.org/...     SUCCESS
🎉 Flow complete — total paid $555                              DONE
```

並行して左ペインの **On-chain Receipts** に 3 件のレシート（NEAR/XRPL の native amount + クリック可能な explorer link）が積み上がる。

**人間の操作:** 1 回の自然言語入力 + Orchestrate ボタン押下のみ。**所要時間:** ~30 秒。

---

## 4. Architecture

```
              ┌─────────────────────────────────────────┐
              │       Browser (HTML / Vanilla JS)       │
              │  ・チャット入力 (request + dates + budget) │
              │  ・Live Flow (WebSocket realtime)        │
              │  ・Receipts (on-chain link)              │
              │  ・日本語 / English / 日 / EN 切替         │
              └────────────────┬────────────────────────┘
                               │  WS /ws  (片方向 push)
              ┌────────────────▼────────────────────────┐
              │      FastAPI Orchestrator (Python)      │
              │   run_flow() = ステップ毎に WS broadcast   │
              └─┬─────────┬──────────┬──────┬───────┬───┘
                │         │          │      │       │
        ┌───────▼─┐ ┌─────▼──────┐ ┌─▼────┐ ┌▼─────┐ ┌▼────────┐
        │IronClaw │ │NEAR AI     │ │NEAR  │ │XRPL  │ │NEAR AI  │
        │0.27.0   │ │Cloud       │ │test  │ │test  │ │MARKET   │
        │(local   │ │Qwen3-30B-  │ │net   │ │net   │ │(mainnet)│
        │ binary +│ │ A3B-       │ │py-   │ │xrpl- │ │REST     │
        │ gateway)│ │ Instruct   │ │near  │ │py    │ │httpx    │
        └─────────┘ └────────────┘ └──────┘ └──────┘ └─────────┘
        オーケスト  3エージェント  2件決済  越境1件  自律market
        レーター宣言 並列推論+最適化       決済    投稿(escrow)
```

### 4.1 5 つのレイヤーの役割

| レイヤー | 実装 | 何が「自律」か |
|---|---|---|
| **オーケストレーター** | IronClaw 0.27.0 (Rust binary + gateway port 3000) | エージェント宣言層。賞条件「IronClaw 使用」を物理的に満たす |
| **推論** | NEAR AI Cloud Private Inference (Qwen/Qwen3-30B-A3B-Instruct-2507) | 各サブエージェントの見積生成 + 全体の組合せ最適化 |
| **エージェント市場** | NEAR AI Market (mainnet) | 同オーケストレーターを agent 登録 → 同タスクを 1 NEAR escrow で公開 |
| **決済 (域内)** | NEAR testnet (py-near) | Flight / Hotel への送金 — ステーブル決済の代理 |
| **決済 (越境)** | XRPL testnet (xrpl-py) | 現地ガイドへの送金 — 国境を越えた価値移転 |

### 4.2 制御フロー (オール・オア・ナッシング)

```
flow.start
  ├─ IronClaw health check
  ├─ NEAR AI Market: register + post job
  ├─ 3 sub-agents 並列 quote
  │    ├─ ANY agent.error  ─→  flow.needs_replan (NO PAYMENT)
  ├─ NEAR AI optimizer
  │    ├─ partial accept   ─→  flow.needs_replan (NO PAYMENT)
  │    └─ optimizer error  ─→  flow.needs_replan (NO PAYMENT)
  ├─ Preflight balance check (NEAR + XRPL)
  │    └─ insufficient    ─→  flow.needs_replan (NO PAYMENT)
  ├─ 並列決済 (NEAR ×2 + XRPL ×1)
  │    └─ any settlement fail ─→ flow.needs_replan
  └─ flow.done  (total_paid + 3 explorer links)
```

**核心:** 1 件でも欠ければ **1 件も支払わない**。エージェント自律 ≠ 暴走、を保証する。

---

## 5. Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Frontend | Vanilla HTML / JS / CSS + WebSocket | (no React, no build step) |
| i18n | 自前 i18n.js (ja / en / both) | 軽量 |
| Backend | Python 3.11 + FastAPI + uvicorn (uvloop) | fastapi 0.136 / uvicorn 0.46 |
| Agent Runtime | IronClaw | 0.27.0 (Rust binary 95 MB) |
| LLM | NEAR AI Cloud (OpenAI 互換) — Qwen/Qwen3-30B-A3B-Instruct-2507 | $5 クーポン NEAR-HACK-TOKYO |
| NEAR | py-near + NEAR CLI rs | 1.2.22 / 0.24.0 |
| XRPL | xrpl-py | 4.5.0 |
| Market | httpx → market.near.ai REST API | OpenAPI 準拠 |

**~1,000 行の Python + ~700 行の Vanilla JS** で完結。依存最小、再現容易。

---

## 6. Prize Mapping

| 賞 | 必須要件 | 本作の証拠 |
|---|---|---|
| **Best IronClaw Use Case ($200)** | IronClaw 使用 | binary 0.27.0 の version + gateway 動作を Live Flow に表示 |
| **Best NEAR Tech Integration ($150)** | Private Inference / Intents / on-chain (単純 wallet 接続不可) | (a) Qwen3-30B Private Inference で見積 + 最適化 (b) NEAR testnet で 2 件実送金 (c) NEAR AI Market mainnet 連携 |
| **Best Agentic Commerce ($150)** | エージェント間自律経済活動 | (a) 3 サブエージェント自律 quote→accept→pay (b) **NEAR AI Market mainnet job 実 post** (c) **オール・オア・ナッシング保証** |
| **XRPL賞 (¥20,000)** | XRP Ledger 使用 | XRPL testnet 越境送金 (LocalGuideAgent) |
| **Grand Prize 候補** | 総合力 | リアルタイム可視化 UI + 日英併記 + 全部本物動作 |

---

## 7. Verified On-chain Activity (デモ前検証)

### Mainnet (NEAR AI Market)
- **Topup TX**: https://explorer.near.org/transactions/H8ZAgBu5TAbvJHVWcreUbGfMg4tTSER4xwEZiapX7vHL (1.2 NEAR)
- **Job posted**: https://market.near.ai/jobs/b7393e36-9db2-4544-97fc-16d4aec490fd (現在 status: closed = キャンセル済)
- **Agent**: `4099b1e1-03b4-4828-9967-1ab43eb32b5b`

### Testnet (Settlement)
| Agent | Chain | Amount | TX |
|---|---|---|---|
| FlightAgent | NEAR | $295 | [9GAJp...wBey](https://testnet.nearblocks.io/txns/9GAJphBzQqpXvC9PBFbTSXpcTxXaVpL9QtN4wNExwBey) |
| HotelAgent | NEAR | $185 | [bTmVQ...FMoK](https://testnet.nearblocks.io/txns/bTmVQVntSAXii7gyxfZkq5Ur9tNJpvtVXxk9RpBFMoK) |
| LocalGuideAgent | XRPL | $75 | [56E710...0109B](https://testnet.xrpl.org/transactions/56E710C11588B09712682C837D19F372DE68040F5F0A251888ACF37D0110109B) |

---

## 8. Hackathon-time Decisions (3 時間の制約下で何を諦め何を取ったか)

| Decision | 取った道 | 切り捨てた道 |
|---|---|---|
| エージェント基盤 | IronClaw（賞必須） | OpenClaw 自前実装 |
| 推論 | NEAR AI Cloud Qwen3-30B | OpenAI / Anthropic API |
| 決済 | NEAR testnet + XRPL testnet | EVM (Sui / 他チェーン) |
| Market 連携 | register + 1 mainnet job 実 post | bid 待ち / award / accept (外部 worker 待ちでデモ不安定) |
| UI | Vanilla HTML/JS (build なし) | React/Next.js |
| 言語 | 日英併記 (デフォルト) | 単一言語のみ |

「**確実に動く × 賞条件を最大化**」の交差点を選択。

---

## 9. What's Next (本気で運用する場合)

1. **NEAR AI Market の bid → award → accept** の完全クローズドループ実装 (外部 Worker 連動)
2. **Trezu CLI** によるマルチシグ決済 (ガバナンス賞も狙える)
3. **PingPay Toll x402** の API 課金統合 (LLM 1 call ごとに自律支払い)
4. **NEAR Intents** による真のクロスチェーン (NEAR ↔ XRPL ↔ EVM をブリッジなしで)
5. **本物の旅行 API** (Skyscanner / Booking.com) と接続

現状は「プロトコル統合の実証」までで、商用化には旅行業界の実 API 接続が必要。

---

## 10. Repository

- **GitHub**: https://github.com/sahiruha/clawthon_near
- **Live**: localhost:8000 (デモ会場で配信)
- **Mock player**: `frontend/mock.html` (バックエンド未起動でも UI 全フロー再生)
- **Quickstart**: README.md / scripts/SETUP.md

---

## 11. Demo Talking Points (3 分プレゼン台本)

| 時間 | 何を言う | 何を見せる |
|---|---|---|
| 0:00–0:20 | "AI が思考し、ブロックチェーンが執行する — その間に人を入れない" | タイトルスライド |
| 0:20–0:40 | "3 エージェント × 2 チェーン × Mainnet Market を 1 入力で動かします" | アーキテクチャ図 |
| 0:40–1:50 | (ライブデモ) 自然言語入力 → 13 ステップが Live Flow を駆け抜ける | 実画面 |
| 1:50–2:30 | NEAR Mainnet の job、NEAR/XRPL testnet の TX を explorer で 1 件ずつ開く | ブラウザ |
| 2:30–2:50 | "1 件でも欠ければ 1 円も払わない" の demo (`?scenario=replan`) | mock.html?scenario=replan |
| 2:50–3:00 | "賞条件すべての証拠を README にまとめてあります" | GitHub |
