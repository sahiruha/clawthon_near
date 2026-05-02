# 🛰️ Agentic Travel Concierge

> **Clawathon Tokyo Edition (2026-05-02) submission**
> AI Reasoning → Agent Orchestration → On-chain Settlement を一気通貫で実演する自律型エージェント MVP

ユーザーが「来週バンコクに行きたい、予算500ドル」と入力するだけで、3つのサブエージェントが並列で見積を返し、NEAR AI Cloud (Qwen3-30B) が最適組合せを判断、**NEAR testnet と XRPL testnet で実トランザクションが発行される**。すべてリアルタイムで画面上に可視化。

---

## ✅ Verified On-chain Receipts (本番デモ前検証)

| エージェント | チェーン | 金額 | TX |
|---|---|---|---|
| FlightAgent | NEAR testnet | $320 | [E8Wet...14Ag](https://testnet.nearblocks.io/txns/E8WetmbbGfKmTyU7rVKXfygrztpYCNaCMewNmWmu14Ag) |
| HotelAgent | NEAR testnet | $185 | [94Cgm...xtzk](https://testnet.nearblocks.io/txns/94Cgm2DKdLmZjX8UWpjtgV5hjY6xuicfGLT7uaGWxtzk) |
| LocalGuideAgent (越境) | XRPL testnet | $75 | [65B78...164DE](https://testnet.xrpl.org/transactions/65B782AE0011EBE38A776FC7A24345467FAF530626EE3D888FEBC1E1D4B164DE) |

---

## 🏆 Prize Mapping (Near Award $500 + XRPL ¥20,000 stack)

| 賞 | 必須要件 | 本MVPでの実装 |
|---|---|---|
| **Best IronClaw Use Case ($200)** | IronClaw 使用 | `backend/ironclaw_client.py` で IronClaw 0.27.0 のローカル gateway (port 3000) と binary を呼び、オーケストレーターヘルスとして組み込む。フロー画面に IronClaw のバージョン情報を可視化 |
| **Best NEAR Tech Integration ($150)** | NEAR Intents / Private Inference / on-chain 連携 (単純 wallet 接続不可) | (1) NEAR AI Cloud Private Inference (Qwen/Qwen3-30B-A3B-Instruct-2507) を OpenAI 互換 SDK 経由で呼び、各エージェント見積と最適組合せ判断に使用 (2) NEAR testnet で 2 件の実送金 |
| **Best Agentic Commerce ($150)** | エージェント間の自律経済活動 (例: PingPay / Trezu / NEAR AI Market) | 3 サブエージェントが並列見積→受注→自動入金の完全自動フロー。人間は最初の自然言語入力のみ。決済先のウォレットは各サブエージェント所有 |
| **XRPL賞 (¥20,000)** | XRP Ledger 使用 | `backend/chains/xrpl_pay.py` で越境決済 (LocalGuideAgent) を XRPL testnet 実送金 |

---

## 🏗 Architecture

```
Browser (HTML + Vanilla JS + WebSocket)
   │ realtime flow visualization
   ▼
FastAPI (Python, uvicorn)
   ├─→ IronClaw 0.27.0          (オーケストレーター, port 3000 + binary)
   ├─→ NEAR AI Cloud           (Qwen3-30B-A3B-Instruct, OpenAI互換)
   ├─→ NEAR testnet            (py-near, ステーブル決済)
   └─→ XRPL testnet            (xrpl-py, 越境決済)
```

### サブエージェント
| 名前 | 役割 | 決済チェーン |
|---|---|---|
| `FlightAgent` | 東京発の往復航空券見積 | NEAR testnet |
| `HotelAgent` | 中級ホテル数泊の見積 | NEAR testnet |
| `LocalGuideAgent` | 現地半日ガイド見積 | XRPL testnet (越境表現) |

各エージェントは Qwen3-30B に独立クエリを投げ、JSON で `{description, amount_usd}` を返す。Orchestrator が NEAR AI で組合せ最適化を判断後、`asyncio.gather` で並列決済。

---

## 🚀 Quickstart

### 1. 依存インストール

```bash
python3.11 -m venv .venv
.venv/bin/pip install -e .
```

### 2. IronClaw 0.27.0 ダウンロード (Apple Silicon)

```bash
mkdir -p .bin && cd .bin
curl -L -o ironclaw.tar.gz \
  https://github.com/nearai/ironclaw/releases/latest/download/ironclaw-aarch64-apple-darwin.tar.gz
tar -xzf ironclaw.tar.gz
./ironclaw-aarch64-apple-darwin/ironclaw --version  # → ironclaw 0.27.0
```

(他 OS は `x86_64-apple-darwin` `aarch64-unknown-linux-gnu` 等を選ぶ)

### 3. NEAR AI Cloud APIキー

https://cloud.near.ai → サインイン → Credits → Add credits → クーポン `NEAR-HACK-TOKYO`（$5）→ APIキー発行

### 4. NEAR testnet アカウント (4 個自動発行)

```bash
SUFFIX=$(date +%s | tail -c 7)
for role in orch flight hotel guide; do
  near account create-account sponsor-by-faucet-service \
    "${role}-${SUFFIX}.testnet" \
    autogenerate-new-keypair print-to-terminal \
    network-config testnet create
done
```

orchestrator の `SECRET KEYPAIR` を `.env` の `NEAR_ORCHESTRATOR_PRIVATE_KEY` に貼る。

### 5. XRPL testnet アカウント (2 個自動発行)

```bash
.venv/bin/python scripts/setup_xrpl_accounts.py
```

### 6. `.env` を埋める

`.env.example` をコピーして上記で取得した値を貼る。

### 7. 起動

```bash
.venv/bin/uvicorn backend.main:app --reload --port 8000
```

http://localhost:8000 を開く → テキスト入力 → ▶ Orchestrate

### 8. E2E スクリプトで CLI 検証

```bash
.venv/bin/python scripts/e2e_test.py
```

すべてのフローイベントと on-chain 受取の explorer URL がコンソールに流れる。

---

## 📂 Files

```
backend/
  main.py              # FastAPI: / (UI), /api/run, /api/health, /ws
  ws_manager.py        # WebSocket ブロードキャスト
  orchestrator.py      # フロー制御 + イベント発火
  ironclaw_client.py   # IronClaw gateway/binary 連携
  agents/
    base.py            # NEAR AI Cloud (OpenAI 互換) クライアント + Quote クラス + 最適化
    flight.py          # 航空券エージェント
    hotel.py           # ホテルエージェント
    local_guide.py     # 越境ガイド (XRPL 受取)
  chains/
    near_pay.py        # NEAR testnet 送金 (py-near)
    xrpl_pay.py        # XRPL testnet 送金 (xrpl-py)
frontend/
  index.html           # 2カラムUI (左: チャット+受領, 右: フロー可視化)
  app.js               # WebSocket受信→ノード描画
  style.css            # 黒背景+ネオンのデモ映え
scripts/
  e2e_test.py          # CLI から WebSocket+HTTP で完全フローを検証
  setup_xrpl_accounts.py
  SETUP.md             # 当日セットアップ手順詳細
```

---

## 🎯 Demo Script (3分プレゼン)

1. **入力** — 「来週バンコクに行きたい、予算500ドル」
2. **IronClaw 起動確認** (画面右に `ironclaw 0.27.0 ready`)
3. **3エージェント並列発火** — FlightAgent / HotelAgent / LocalGuideAgent が NEAR AI Cloud に独立クエリ → 並列で見積完了 ($320 / $185 / $75)
4. **NEAR AI 最適化** — Qwen3-30B が組合せを判断 → 全て採択 (合計 $580)
5. **NEAR testnet 並列送金** — Flight / Hotel に同時送金、エクスプローラURL表示
6. **XRPL testnet 越境送金** — LocalGuide に送金、エクスプローラURL表示
7. **完了** — `🎉 Flow complete — total paid $580` + 3 on-chain receipts

審査員は画面を見るだけで「自律オーケストレーション × NEAR推論 × NEAR/XRPL 実送金」が一目で分かる。

---

## 🛠 Tech Stack

- **Frontend**: Vanilla HTML/JS/CSS + WebSocket (no React, no build step)
- **Backend**: Python 3.11 + FastAPI + uvicorn (uvloop)
- **Agent runtime**: IronClaw 0.27.0 (Rust binary, 95MB)
- **LLM**: NEAR AI Cloud Private Inference (Qwen/Qwen3-30B-A3B-Instruct-2507) via OpenAI 互換 SDK
- **NEAR**: py-near 1.2.22, NEAR CLI rs 0.24.0
- **XRPL**: xrpl-py 4.5.0
