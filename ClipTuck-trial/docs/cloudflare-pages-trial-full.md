# Cloudflare Pages に Trial 版と Full 版をデプロイする手順

このドキュメントは、既存の Cloudflare Pages 運用から「Trial 版」と「Full 版」を分けて公開するための、実践的な手順をまとめたものです。おすすめ構成（方法A）は Pages プロジェクトを 2 つに分けるやり方です。代替として、単一プロジェクト＋ルーティング（方法B）も紹介します。

## ゴール
- Trial と Full を別 URL で安定運用（例: `trial.example.com`, `app.example.com`）
- ビルド差分（機能/文言）を環境変数やスクリプトで安全に切替
- 将来の CI/CD・アクセス制御にも拡張しやすい構成

## 前提
- Cloudflare アカウント作成済み、対象ドメインを Cloudflare に追加済み
- リポジトリにビルドスクリプトがある（例: Vite/Next.js 等）
- Pages で既に 1 プロジェクト運用中でも可（その場合は複製して Trial を新設）
- CLI を使う場合は `wrangler` をインストール済み（任意）

---

## 図解（全体像）

```mermaid
flowchart LR
  user[(User)]

  %% 方法A: プロジェクトを2つに分割
  subgraph A[方法A: Pages プロジェクトを2つに分ける（推奨）]
    user -->|trial.example.com| dnsA1[Cloudflare DNS]
    user -->|app.example.com|   dnsA2[Cloudflare DNS]

    dnsA1 --> pagesTrial[Pages Project: trial]
    pagesTrial --> trialAssets[(静的アセット/Functions)]

    dnsA2 --> pagesFull[Pages Project: full]
    pagesFull --> fullAssets[(静的アセット/Functions)]
  end

  %% 方法B: 単一Pages + Workerで振り分け
  subgraph B[方法B: 単一Pages + Worker で振り分け]
    user -->|trial.example.com, app.example.com| dnsB[Cloudflare DNS]
    dnsB --> worker[Cloudflare Worker ルーター]
    worker -->|/trial/*| pagesSingle[単一 Pages Project]
    worker -->|/full/*|  pagesSingle
    pagesSingle --> assets[(dist/trial と dist/full を内包)]
  end
```

---

## 方法A（推奨）: Pages プロジェクトを 2 つに分ける
最もシンプルで管理しやすい構成です。Trial/Full で環境変数やカスタムドメインを独立させられます。

### 1) URL と命名を決める
- 例:
  - Trial: `trial.example.com` → プロジェクト名例 `cliptuck-trial`
  - Full:  `app.example.com`   → プロジェクト名例 `cliptuck-full`

### 2) リポジトリのビルド差分を用意
- 単一コードベース＋フラグで切り替えるのが簡単です。
- Vite 例（ビルド時に VITE_ 変数を使う）:

```json
{
  "scripts": {
    "build:trial": "cross-env VITE_EDITION=trial vite build",
    "build:full":  "cross-env VITE_EDITION=full vite build"
  }
}
```

アプリ側（Vite/React の例）:

```ts
// 例: src/config/edition.ts
export const edition = import.meta.env.VITE_EDITION || "full";
export const isTrial = edition === "trial";
```

- Next.js（Pages でも Functions でも）例:
  - Cloudflare Pages の環境変数に `EDITION=trial|full` を設定し、アプリ内で `process.env.EDITION` を参照して分岐。

```ts
// 例: next.config.js やアプリコード内で参照
const edition = process.env.EDITION ?? "full";
```

- モノレポなら `apps/trial/` と `apps/full/` を分け、各々にビルドスクリプトを用意してもOK。

### 3) Trial 用 Pages プロジェクトを作成
- Cloudflare ダッシュボード → Pages → Create project → リポジトリを接続
- ルートディレクトリ（モノレポ時のみ）や Build command を Trial 用に設定
  - 例（Vite）: Build: `npm ci && npm run build:trial` / Output dir: `dist`
  - 例（Next.js + next-on-pages）: Build: `npx @cloudflare/next-on-pages@latest build`
- Settings → Environment variables に Trial 用の値を設定
  - 例: `VITE_EDITION=trial`（Vite）または `EDITION=trial`（Next）
- デプロイ後、`<trial-project>.pages.dev` で動作確認

### 4) Full 用 Pages プロジェクトを作成
- 同一リポジトリを再接続して別プロジェクトを作成
- Build: `npm ci && npm run build:full` / Output dir: `dist`
- Environment variables に Full 用の値（`VITE_EDITION=full` または `EDITION=full`）
- デプロイ後、`<full-project>.pages.dev` で確認

### 5) カスタムドメインの割り当て
- Trial プロジェクトで `trial.example.com` を追加
- Full プロジェクトで `app.example.com`（または希望の本番ドメイン）を追加
- 画面に従って CNAME/証明書を有効化（自動構成）

### 6) 任意の追加設定
- リダイレクト: ルート `example.com` → `app.example.com` へ恒久リダイレクト（`_redirects`、DNS、または Worker）
- アクセス制御: Full を Cloudflare Access で保護
- 分析: Cloudflare Web Analytics、Pages Analytics

### 7) CLI（任意）
```bash
# 新規プロジェクト作成（production ブランチを指定）
wrangler pages project create cliptuck-full  --production-branch main
wrangler pages project create cliptuck-trial --production-branch main

# それぞれのビルド成果物をデプロイ
wrangler pages deploy ./dist --project-name cliptuck-full   # Full ビルド後
wrangler pages deploy ./dist --project-name cliptuck-trial  # Trial ビルド後
```

---

## 方法B: 単一 Pages + Worker で振り分け
1 つの Pages に `/trial` と `/full` の 2 セットを同梱し、Worker でサブドメインからサブパスへルーティングします。複雑度は上がりますが、プロジェクト数を増やしたくない場合に有効です。

### 1) ビルド成果物の配置
- ビルドで `dist/trial/**` と `dist/full/**` を生成し、Pages には `dist` をデプロイ
- 例: `https://<project>.pages.dev/trial` と `https://<project>.pages.dev/full`

### 2) Worker でサブドメインをサブパスにマッピング
`trial.example.com/*` → `<project>.pages.dev/trial/*`
`app.example.com/*`   → `<project>.pages.dev/full/*`

サンプル（TypeScript, Modules）:

```ts
// src/worker.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const host = request.headers.get("host") || "";

    // Pages のホスト名（例: cliptuck-singular.pages.dev）を環境変数で渡す
    const pagesHost = env.PAGES_HOST as string;

    // そのまま原形を保ってフォワード
    url.hostname = pagesHost;

    if (host.startsWith("trial.")) {
      url.pathname = "/trial" + url.pathname;
    } else if (host.startsWith("app.")) {
      url.pathname = "/full" + url.pathname;
    }

    // 元のリクエストを引き継いでフェッチ
    const forward = new Request(url.toString(), request);
    return fetch(forward);
  }
};
```

`wrangler.toml` 例:

```toml
name = "cliptuck-router"
main = "src/worker.ts"
compatibility_date = "2024-08-01"

routes = [
  { pattern = "trial.example.com/*", zone_name = "example.com" },
  { pattern = "app.example.com/*",   zone_name = "example.com" }
]

[vars]
PAGES_HOST = "<project>.pages.dev"
```

### 3) 代替: Pages Functions での分岐
- 同じ Pages プロジェクト配下の Functions（`functions/` or `_worker.js`）でも `Host` ヘッダを見て `/trial` / `/full` にリライト可能
- ただしサブパス運用は 404/アセットパスに配慮が必要なため、まずは Worker での外側ルーティングを推奨

---

## CI/CD（GitHub Actions 例）
- `WRANGLER_AUTH_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を Secrets に保存
- 片方のブランチを Trial、もう片方を Full 用にする例:

```yaml
name: Deploy Pages (Trial/Full)

on:
  push:
    branches: [ main, trial ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Build
        run: |
          if [ "${GITHUB_REF_NAME}" = "trial" ]; then
            npm run build:trial
          else
            npm run build:full
          fi
      - name: Deploy
        run: |
          if [ "${GITHUB_REF_NAME}" = "trial" ]; then
            npx wrangler pages deploy dist --project-name cliptuck-trial
          else
            npx wrangler pages deploy dist --project-name cliptuck-full
          fi
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          WRANGLER_AUTH_TOKEN:   ${{ secrets.WRANGLER_AUTH_TOKEN }}
```

---

## 検証チェックリスト
- Trial/Full それぞれのプレビュー URL で文言・機能が正しく切り替わる
- カスタムドメインが有効化され、HTTPS 証明書が正常に発行済み
- ルートリダイレクトやアクセス制御（必要な場合）が期待通り
- キャッシュ/ヘッダ（`Cache-Control`, `Security Headers`）の方針がバージョン間で適切

## トラブルシュート
- 404/アセットパスが崩れる: サブパス運用時はビルドの `base` 設定（Vite の `base`, Next の `assetPrefix` 等）を確認
- 環境変数が反映されない: Pages の環境変数は「ビルド時」に効く（再デプロイが必要）
- Custom Domain が緑にならない: DNS 伝播待ち or 既存レコード衝突を確認
- Worker で CORS/Headers が欠落: `new Request(url, request)` で元ヘッダを引き継ぎ、不要なヘッダ改変を避ける

## 運用のコツ
- 機能フラグで差分を最小化し、本番・トライアルを同一コードベースで維持
- Full は Cloudflare Access で内向き限定やメールドメイン制限を検討
- Pages Analytics と Cloudflare Web Analytics で導線や離脱を別々に把握
- メジャー変更は Preview（プルリク）で先に UI 差分をレビュー

---

## まとめ
- まずは方法A（プロジェクト分割）で `trial.example.com` と `app.example.com` を用意するのが簡単・安全。
- 将来的に 1 プロジェクトで集約したい場合は、方法B（単一 Pages + Worker）で段階的に移行可能。

必要に応じて、あなたのリポジトリ構成（Next/Vite/静的 等）に合わせて `package.json` や Worker/Actions の雛形をプロジェクトへ組み込みます。希望のドメイン名と現在のビルド方法を教えてください。

