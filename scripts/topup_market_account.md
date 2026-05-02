# NEAR AI Market — mainnet topup 手順

NEAR AI Market は **mainnet** で運用されており、ジョブ作成には Market wallet に
最低 1 NEAR の残高が必要。本MVPの Market wallet 情報:

```
deposit_account: 5d3a9db6bf4c37afe28109581a901da5b221df611f81045f26784a6678e80ccd
agent_id:        4099b1e1-03b4-4828-9967-1ab43eb32b5b
api_key:         (saved in .env as NEAR_AI_MARKET_API_KEY)
```

## 残高確認

```bash
curl -s https://market.near.ai/v1/wallet/balance \
  -H "Authorization: Bearer $(grep NEAR_AI_MARKET_API_KEY .env | cut -d= -f2)" | jq
```

## A) NEAR CLI で mainnet 送金 (推奨)

すでに mainnet アカウント (例: `you.near`) があれば 1 コマンド:

```bash
near tokens you.near send-near \
  5d3a9db6bf4c37afe28109581a901da5b221df611f81045f26784a6678e80ccd \
  '1.2 NEAR' \
  network-config mainnet \
  sign-with-keychain \
  send
```

`sign-with-keychain` が使えない場合は `sign-with-seed-phrase`:

```bash
near tokens you.near send-near \
  5d3a9db6bf4c37afe28109581a901da5b221df611f81045f26784a6678e80ccd \
  '1.2 NEAR' \
  network-config mainnet \
  sign-with-seed-phrase 'your twelve word seed phrase here' \
  send
```

## B) NEAR Wallet ブラウザで送金

1. https://wallet.near.org にログイン
2. "Send" → "To address" に `5d3a9db6bf4c37afe28109581a901da5b221df611f81045f26784a6678e80ccd`
3. Amount: `1.2`
4. Send

## C) 取引所から直接送金 (Binance / Bybit 等)

宛先アドレス: `5d3a9db6bf4c37afe28109581a901da5b221df611f81045f26784a6678e80ccd`
Memo/Tag: 不要 (NEAR はサポートしていない)

## topup 後の確認

```bash
# 残高チェック (≥1 NEAR を確認)
curl -s https://market.near.ai/v1/wallet/balance \
  -H "Authorization: Bearer $(grep NEAR_AI_MARKET_API_KEY .env | cut -d= -f2)" | jq .balance

# 次に uvicorn を再起動 + ブラウザで Orchestrate を押すと
# Live Flow に `market.posted` (緑✅) が出て、market.near.ai に実 job が公開される
```
