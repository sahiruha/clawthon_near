# UI 機能仕様書 — Agentic Travel Concierge

このドキュメントは、デザイナーに UI を再設計してもらうための機能仕様書。
すべての画面要素・状態・データソース・遷移をここに集約してある。

> 現在の実装: `frontend/index.html`, `frontend/app.js`, `frontend/style.css`
> バックエンドAPIは変更しないので、HTML/JS/CSSの差し替えだけで再デザイン可能。

---

## 1. プロダクト一行説明

> 「ユーザーが自然言語で旅行リクエストを入力すると、3つの自律AIエージェントが並列で見積を返し、AIが最適組合せを判断、NEAR/XRPLの2チェーンで実トランザクションが走る」体験を、リアルタイムで可視化するダッシュボード。

ターゲット: ハッカソンの審査員 (3分のデモで「自律エージェント × on-chain 決済」が伝わることが最優先)

---

## 2. 画面の論理構成

ユーザーが触る画面は 1 枚 (Single Page Application)。論理的には4つのセクション：

| ID | セクション | 役割 |
|---|---|---|
| `header` | ヘッダー | プロダクト名 + 使用技術バッジ |
| `input` | 入力 | 自然言語リクエスト + 予算 + 実行ボタン |
| `flow` | リアルタイムフロー | エージェント・決済の進行をライブで可視化 (デモの主役) |
| `receipts` | オンチェーン受領 | 完了したトランザクションのリンク集 |

---

## 3. 各セクションのデータと状態

### 3.1 header

**静的表示。** プロダクト名と使用技術バッジ。

| 要素 | 内容 | 備考 |
|---|---|---|
| プロダクト名 | "Agentic Travel Concierge" | アイコン候補: 🛰 / ✈ |
| サブタイトル | "Clawathon Tokyo Edition" | (任意) |
| バッジ #1 | "IronClaw" | 紫系 |
| バッジ #2 | "NEAR AI Cloud" | 緑系 (NEARカラー) |
| バッジ #3 | "NEAR testnet" | 緑系 |
| バッジ #4 | "XRPL testnet" | 橙系 (XRPLカラー) |

### 3.2 input

| 要素 | 種別 | 既定値 | バリデーション |
|---|---|---|---|
| `request` | 複数行テキスト | プレースホルダ:「来週バンコクに行きたい、予算500ドル」 | 空でなければOK |
| `budget_usd` | 数値 | `500` | 正数 |
| `run` | ボタン | "▶ Orchestrate" | 実行中は disabled |

ボタン押下時のアクション:
```
POST /api/run
Content-Type: application/json
{ "request": "<request>", "budget_usd": <budget_usd> }
```
レスポンスは即座に 200。実フローは WebSocket で配信。

### 3.3 flow (デモの主役、最も視認性が大事)

WebSocket `/ws` から受け取るイベントを時系列で **積み上げ表示**。
イベントが来るたびに新しい「ノード」が追加されるか、既存ノードが更新される。

**ノードの構成要素:**
- カテゴリアイコン (IronClaw / Agent / Optimizer / Payment / Done)
- ステータスドット (active = 点滅 / success = 緑 / error = 赤)
- ラベル (1行の主要メッセージ)
- メタ情報 (補足、金額、時刻、エクスプローラリンクなど)

**カテゴリ別のスタイル指針:**
| カテゴリ | キーカラー | ノードの「左ボーダー」色 |
|---|---|---|
| IronClaw (オーケストレーター) | 紫 | 紫 |
| Agent (Flight/Hotel/LocalGuide) | 緑 (NEAR系のとき) / 橙 (XRPL系のとき) | チェーンの色 |
| Optimizer (NEAR AI Cloud) | シアン/水色 | シアン |
| Payment | NEARなら緑、XRPLなら橙 | チェーンの色 |
| Done (完了) | 黄色 / 強調 | 黄色 |

#### イベントの種類とノード仕様 (ここがUI設計の核心)

| イベント種 | 発生タイミング | ノードのラベル例 | メタ表示 | ステータス |
|---|---|---|---|---|
| `flow.start` | フロー開始 | 🛰️ Flow started — "来週バンコクに行きたい" | budget $500 • 14:23:11 | success |
| `ironclaw.checking` | IronClaw ヘルスチェック開始 | IronClaw orchestrator: health check... | (時刻) | active |
| `ironclaw.ready` | IronClaw ヘルスチェック完了 | ✅ IronClaw orchestrator: ready (port 3000) または ⚠️ offline fallback | binary version 表示 | success / error |
| `agent.thinking` | サブエージェントが見積開始 | 🤖 FlightAgent thinking... | chain: near | active |
| `agent.quoted` | サブエージェントが見積完了 (上のノードを更新) | 💬 FlightAgent: Round-trip economy flight | $295 → near:flight-701307.testnet | success |
| `agent.error` | サブエージェント失敗 | ❌ FlightAgent failed | エラーメッセージ | error |
| `optimizer.thinking` | NEAR AI で組合せ判断開始 | 🧠 NEAR AI Cloud (Qwen3-30B): optimizing combination... | (時刻) | active |
| `optimizer.decided` | 最適化決定 (上のノードを更新) | 🧠 NEAR AI: accepted [Flight, Hotel, LocalGuide] | $580 • reasoning | success |
| `payment.sending` | 決済送信開始 | 💸 Paying FlightAgent via NEAR... | $295 | active |
| `payment.confirmed` | TXコンファーム (上のノードを更新) | ✅ FlightAgent paid via NEAR | $295 → [TX hash クリックで explorer] | success |
| `payment.failed` | TX失敗 | ❌ FlightAgent payment failed (NEAR) | エラーメッセージ | error |
| `flow.done` | 全フロー完了 | 🎉 Flow complete — total paid $580 | 3 on-chain transactions | success |

#### 重要な UI 動作

1. **ノードの「上書き更新」**:
   - `agent.thinking` で出たノードは `agent.quoted` で **同じノードのラベル/メタを書き換える** (新ノードを作らない)
   - `optimizer.thinking` → `optimizer.decided` も同様
   - `payment.sending` → `payment.confirmed` も同様
   - キーは `agent name`。ペイメントは `pay:<agent>`。
2. **アクティブ状態の点滅**: `active` 状態のドットはパルス (1.2秒周期で 100% ↔ 45%)
3. **新ノードのアニメーション**: 上から `translateY(-6px)` → `0`、opacity 0→1 (250ms)
4. **オートスクロール**: 新ノード追加時は flow セクション最下部にスクロール
5. **再実行時はクリア**: `flow.start` イベントで flow と receipts を空にしてから始める

### 3.4 receipts

`payment.confirmed` イベントが来るたびに 1 枚追加。

| 要素 | 内容 |
|---|---|
| Agent 名 | FlightAgent / HotelAgent / LocalGuideAgent |
| USD金額 | `$320` |
| ネイティブ通貨表示 | `1.0 NEAR` または `7.5 XRP` |
| TX hash (リンク) | クリックで explorer (`https://testnet.nearblocks.io/txns/<hash>` か `https://testnet.xrpl.org/transactions/<hash>`) |
| 左ボーダー色 | NEAR は緑 / XRPL は橙 |

---

## 4. 配色とトーン

### 現状の配色 (参考)
```
背景: #0a0e16 (ほぼ黒)
パネル: #121826
線: #1f2a3d
NEAR緑: #4ade80
XRPL橙: #f97316
IronClaw紫: #c084fc
アクセント水色: #38bdf8
警告: #fb923c
エラー: #f87171
ミュート: #6b7a90
テキスト: #e6edf3
```

### デザイナーへの方針
- **暗いダッシュボード調** が望ましい (Bloomberg Terminal / Vercel Analytics 風)
- 「**動いている感**」が出ることが最重要 (パルス、流れる線、フェードイン)
- 文字情報量が多い → モノスペースフォント (SF Mono / JetBrains Mono など) と通常フォントの混在もOK
- アクセシビリティは優先度低 (デモ用途、3分プロジェクター投影が主)
- ダーク前提だがライトテーマ提案も歓迎

---

## 5. 想定ブレークポイント

| ブレークポイント | 用途 | 推奨レイアウト |
|---|---|---|
| 1280px+ | デモプロジェクター/会場ディスプレイ | 左ペイン (input + receipts) 380px / 右ペイン (flow) 残り |
| 768-1280px | ノートPC | 同上 (左を縮める) |
| < 768px | スマホ (任意対応) | 縦積み |

---

## 6. 通信フォーマット (デザイナーが触る必要はないが、JSの実装で必要)

WebSocket `/ws` への接続: 接続するだけ。サーバから片方向で push される。

各イベントは JSON、必ず `type` と `ts` (UNIX秒) を持つ。

完全なイベント形式の例:

```json
{"type":"flow.start","ts":1714630991.21,"request":"...","budget_usd":500}
{"type":"ironclaw.checking","ts":1714630991.31}
{"type":"ironclaw.ready","ts":1714630991.45,"available":true,"announce":{"gateway_running":true,"binary_version":"ironclaw 0.27.0","available":true,"delivery":"gateway","status":405}}
{"type":"agent.thinking","ts":1714630991.55,"agent":"FlightAgent","chain":"near"}
{"type":"agent.quoted","ts":1714630995.10,"agent":"FlightAgent","quote":{"agent":"FlightAgent","description":"Round-trip economy flight from Tokyo to Bangkok","amount_usd":295.0,"chain":"near","receiver":"flight-701307.testnet"}}
{"type":"agent.error","ts":1714630995.10,"agent":"FlightAgent","error":"..."}
{"type":"optimizer.thinking","ts":1714630995.50,"model":"Qwen/Qwen3-30B-A3B-Instruct-2507"}
{"type":"optimizer.decided","ts":1714630997.20,"decision":{"accepted":["FlightAgent","HotelAgent","LocalGuideAgent"],"reasoning":"...","total_usd":580}}
{"type":"optimizer.error","ts":1714630997.20,"error":"..."}
{"type":"payment.sending","ts":1714630998.00,"agent":"FlightAgent","chain":"near","amount_usd":320.0}
{"type":"payment.confirmed","ts":1714631002.50,"agent":"FlightAgent","receipt":{"chain":"near","tx_hash":"E8Wet...","explorer_url":"https://testnet.nearblocks.io/txns/E8Wet...","amount_usd":320,"amount_native":3.2,"receiver":"flight-701307.testnet"}}
{"type":"payment.failed","ts":1714631002.50,"agent":"FlightAgent","chain":"near","error":"..."}
{"type":"flow.done","ts":1714631005.00,"decision":{...},"receipts":[{...},{...},{...}],"total_paid_usd":580}
```

---

## 7. デザイナー作業時に必要な開発環境

```bash
# 起動 (要 .env 設定済)
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 静的ファイルは frontend/ に置けば即反映 (uvicorn --reload)
# index.html / app.js / style.css を差し替えるだけでOK
```

実フローを再現したい場合:
```bash
.venv/bin/python scripts/e2e_test.py
```

実フローを動かさずにモックデータで UI 開発したい場合:
- `frontend/` 配下に `mock.html` を作り、JSON イベントを `setTimeout` で順番に流す JS を書くと、API 不要で UI のみ調整できる
- (希望があればモック用スクリプトを別途作成)

---

## 8. デザイナーへの参考リンク

- 画面サンプル (現状の Live Flow の見た目): `frontend/style.css` の `.node` クラス周り
- NEAR ブランド: https://near.org/brand
- XRPL ブランド: https://xrpl.org/brand
- IronClaw: https://docs.ironclaw.com/

---

## 9. デザイナー成果物として欲しいもの

1. `index.html` (構造)
2. `style.css` (装飾)
3. (任意) `app.js` の差分 — 状態遷移ロジックは現状のままで良いが、新しい DOM クラス名に合わせて微調整が必要なはず
4. ロゴアイコン (SVG / PNG)
5. 配色トークンの定義 (CSS Custom Property `:root` ブロック)

API・WebSocket・イベント形式は変更不可。`backend/` 以下には触らない。
