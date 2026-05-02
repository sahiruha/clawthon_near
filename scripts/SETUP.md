# 当日セットアップ手順

`.env` に必要な値を埋めるためのチェックリスト。所要時間目安 約20分。

---

## 1. NEAR AI Cloud APIキー取得 (5分)

1. https://cloud.near.ai/signin で GitHub or Google ログイン
2. ダッシュボード → "Credits" タブ → "Add credits"
3. Credit Card → 任意の金額 → "Add promotion code" → `NEAR-HACK-TOKYO` を入力 ($5割引)
4. API キー発行 ("API Keys" タブ)
5. `.env`:
   ```
   NEAR_AI_API_KEY=sk-...
   NEAR_AI_BASE_URL=https://cloud-api.near.ai/v1
   NEAR_AI_MODEL=qwen3-30b-a3b
   ```
   ※ `NEAR_AI_BASE_URL` は cloud.near.ai のドキュメント表示に従って必要なら修正。
   ※ モデル名はダッシュボードで利用可能なものを確認 (qwen3 系 or glm 系)。

---

## 2. NEAR testnet アカウント発行 (10分)

https://near-faucet.io/ で **4アカウント** を作成:

| 役割 | 例 | .env キー |
|---|---|---|
| Orchestrator (送金元) | `orch.testnet` | `NEAR_ORCHESTRATOR_ACCOUNT`, `NEAR_ORCHESTRATOR_PRIVATE_KEY` |
| Flight Agent | `flight.testnet` | `NEAR_FLIGHT_AGENT_ACCOUNT` |
| Hotel Agent | `hotel.testnet` | `NEAR_HOTEL_AGENT_ACCOUNT` |
| Local Guide (XRPL 受取の代表表示用) | `guide.testnet` | (XRPL側にまわすので NEAR には不要だが書いてもよい) |

**Orchestrator の Private Key 取得方法:**

near-faucet.io でアカウント作成すると json 形式の鍵がダウンロードできる。
その中の `private_key`（`ed25519:...` 形式）を `.env` に貼る。

```
NEAR_NETWORK=testnet
NEAR_NODE_URL=https://rpc.testnet.near.org
NEAR_ORCHESTRATOR_ACCOUNT=orch.testnet
NEAR_ORCHESTRATOR_PRIVATE_KEY=ed25519:xxxxxxx
NEAR_FLIGHT_AGENT_ACCOUNT=flight.testnet
NEAR_HOTEL_AGENT_ACCOUNT=hotel.testnet
NEAR_LOCAL_GUIDE_AGENT_ACCOUNT=guide.testnet
```

---

## 3. XRPL testnet アカウント発行 (1分・自動)

```bash
.venv/bin/python scripts/setup_xrpl_accounts.py
```

出力された `.env` 行をコピペ。

---

## 4. IronClaw インストール (5分)

セキュリティ上 Claude が `curl|sh` を実行できないので、ターミナルで手動実行：

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/nearai/ironclaw/releases/latest/download/ironclaw-installer.sh | sh
```

別ターミナルで起動：

```bash
HTTP_PORT=8081 ironclaw
```

※ IronClaw が起動していなくてもデモは動く (フォールバックで `⚠️ offline` と表示)。賞条件「IronClaw を使う」を満たすには起動確認できるとベスト。

---

## 5. 起動

```bash
.venv/bin/uvicorn backend.main:app --reload --port 8000
```

http://localhost:8000 を開いて、テキスト入力 → ▶ Orchestrate
