# NicoGura 公式ルール・参加ガイド

FiveMライトRPサーバー「NicoGura / にこぐら」の公式ガイドです。既存のHTML・CSS・JavaScriptによる静的サイトを継続しています。依存パッケージのインストールは不要です。

- 公開サイト: https://nicogura.github.io/
- 公式ルール（既存URL）: https://nicogura.github.io/rules/
- Web専用Repository: https://github.com/nicogura/nicogura.github.io
- v2.0.0 / 最終更新 2026-10-10

## 確認・ビルド

Node.js 20以上（Actionsは24）を使用します。

```sh
npm run build
npm test
npm start
```

`npm start` のローカルURLを開きます。サーバーはループバックのみで待ち受け、公開用ファイルだけを配信します。停止は Ctrl+C。別ポートは `node scripts/serve.mjs 4174` です。

ビルドはコンテンツを検証し、17ページと配信用JSONを生成して、公開対象だけを `_site/` にコピーします。`content/`, `scripts/`, `docs/`, Repository内部のファイルはPagesへ配信しません。

## 文章の編集

正本は `content/` のJSONです。

| ファイル | 内容 |
| --- | --- |
| `site.json` | 公式リンク、画像、更新日、バージョン、更新履歴、各ページの掲載順 |
| `general.json` | ライトRP、基本ルール、不正行為、運営判断、お問い合わせ |
| `join.json` / `character.json` | 参加方法 / 1人1キャラクター |
| `economy.json` | 経済方針、初期資金、飲食、燃料、消耗品 |
| `crime.json` / `law.json` | 犯罪RP・報酬 / ゲーム内法律・刑期 |
| `pd.json` / `ems.json` | PD / EMSと医療料金 |
| `mechanic.json` / `shops.json` | 修理・カスタム料金 / 店舗 |
| `lifejobs.json` / `gangs.json` / `faq.json` | Life Job / ギャング / FAQ |

`data/rules.json`、各ページのHTML、`sitemap.xml` は生成物です。正本を変更したら `npm run build` を実行し、生成物も一緒にCommitしてください。ページのタイトル・説明は `scripts/site-config.mjs`、UIは `assets/app.js` と `assets/style.css` で管理します。

本文は `paragraph`, `heading`, `list`, `note`, `table` のブロックです。表の各セルは文字列、列数は見出しに合わせます。本文にHTMLは使用しません。スマホでは表をラベル付きカードに切り替えます。

- `id` は既存の個別URL・保存機能に使います。公開後は維持してください。
- `number` は重複しない正の整数です。
- `status: published` は確認済みの公開本文です。
- `updatedAt` は実在する日付を `YYYY-MM-DD` で記入します。
- `severity` は `guide / notice / important / prohibited / serious` です。重大度だけで処分は決まりません。
- `tags` と `keywords` も全文検索に使用します。
- 各ページは `content/site.json` の `ruleIds` の順、続いて指定カテゴリーの項目を掲載します。

## ブラウザー編集画面

既存の `/editor/` を継続して使えます。編集内容はそのタブ内にだけ保存され、自動公開されません。

1. ルールやサイト設定、更新履歴を編集して適用します。
2. `rules.jsonをダウンロード` を押します。
3. ダウンロードしたファイルを正本へ取り込みます。

```sh
npm run import-content -- "ダウンロードしたrules.jsonのパス"
npm run build
npm test
```

取込はJSON構造を検証し、既存カテゴリーに応じて各ファイルに振り分けます。新しいカテゴリーは `general.json` に入ります。専用ファイルに分ける場合は `site.json` の `modules` に追加してください。ページから参照中の項目を削除すると取込を止めます。先に掲載構成を確認してください。

## 公開

1. 差分を読み、公式リンク・本文・金額・スマホ表示を確認します。
2. `npm run build` と `npm test` を通します。
3. 今回変更したファイルだけを明示してstageし、Commit・pushします。
4. GitHub Actions **Publish NicoGura website** の成功を確認します。
5. 公開サイトのルール、参加、料金、法律、FAQと個別URLを確認します。

Pages設定はGitHub Actionsです。CSS/JSはCommit SHAで版を更新し、JSONは読み込み時に再取得します。公開URLやRepositoryを移行する必要はありません。未確認のFiveM接続URLは作らず、公式Discordの接続案内へ誘導します。

## 公開範囲

このRepository自体も公開です。運営の内部計算、ゲーム設定、認証情報、個人情報、非公開監査資料を追加しないでください。公開文面の変更はゲーム内の設定変更を伴いません。検索・保存・テーマ切替はブラウザー内で動作し、外部分析サービスは使用しません。

公開内容の整理は [CONTENT_STATUS](docs/CONTENT_STATUS.md)、検証内容は [QA_REPORT](docs/QA_REPORT.md) を参照してください。
