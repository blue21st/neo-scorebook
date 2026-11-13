# 野球スコア・成績アプリ ワークスペース

少年野球チームの試合記録と成績管理のためのアプリ2本を、このフォルダ1つで開発している。

- **neo-scorebook** … 入力する側。試合中に1球ごとに記録するスコアブック
- **BALLSTATS** … 見る側。試合結果と成績を閲覧する成績管理

## 方針

**今は別々のアプリとして作っているが、将来は1つの流れでつなぐ。**

目指す使い方はこうなる。

1. 試合中、neo-scorebook で1球ごとに状況を記録する
2. 試合が終わると、1試合分のスコアブックに当たる記録が完成する
3. 「スコアブックに変換」を押すと、手書きのようなスコアブックができる
4. 「BALLSTATSに登録」を押すと、その試合の結果が BALLSTATS に登録される
5. あとで BALLSTATS で閲覧する

今できているのは 1・2 と、BALLSTATS 単体での閲覧（データは手入力）。3 と 4 は未着手で、2本の間にデータの受け渡しはまだない。

つなぐ前提なので、2本を同じリポジトリ・同じ Supabase プロジェクト・同じドメインに置いている。フォルダ構成も、「つながるまで並べて育てる」前提で、アプリごとのフォルダと、共有するもの（DB定義・資料・ドキュメント）のフォルダに分けている。

フォルダ名は `claude`、GitHub リポジトリ名は `blue21st/neo-scorebook`。名前は neo-scorebook だが BALLSTATS も同じリポジトリで管理する。

## どこを見ればいいか

| 知りたいこと | 見る場所 |
|---|---|
| 今どこまでできていて、次に何をやるか | [docs/STATUS.md](docs/STATUS.md) |
| システム構成（公開先・DB・認証・デプロイ） | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 2本の関係、目指す流れ、つなぐために決めること | [docs/INTEGRATION.md](docs/INTEGRATION.md) |
| 過去の開発ログ・監査レポート | [docs/history/](docs/history/) |

## フォルダ構成

```
claude/
├─ README.md                 このファイル（入口）
├─ neo-scorebook/            アプリ①：スコア記録
│   ├─ neo-scorebook.html      本体（React + Babel standalone、単一HTML）
│   ├─ scorebook-logic.js      成績・得点計算の純粋ロジック（本体とテストで共用）
│   ├─ neo-scorebook-icon*.png ファビコン・iOSホーム画面アイコン
│   ├─ tests/                  ユニットテスト1本、Playwrightテスト2本
│   ├─ archive/                参照用の旧JSX分離版（2026-06時点）
│   └─ package.json, node_modules/
├─ ballstats/                アプリ②：成績管理
│   ├─ baseball_stats.html     本体（素のJavaScript、単一HTML）
│   ├─ supabase_url_config.md  パスワードリセット用のSupabase URL設定手順
│   └─ archive/                旧版（seiryo版、過去のバックアップ）
├─ db/                       共有：Supabase のテーブル定義（2本とも同じプロジェクト）
│   ├─ neo-scorebook_nsb_games.sql
│   └─ ballstats_players_games_rls.sql
├─ docs/                     共有：ドキュメント
│   ├─ STATUS.md / ARCHITECTURE.md / INTEGRATION.md
│   └─ history/                過去の開発ログ・監査レポート（更新しない）
├─ reference/                共有：資料
│   ├─ 公認野球規則_記録について_officialrule_900.pdf
│   ├─ UIUX/                   UIUXガイドライン100項目のメモ
│   ├─ 経過画面参照/            経過タブ設計時の参照スクリーンショット
│   └─ previews/               画面プレビュー画像
├─ .claude/                  Claude Code 用レビューエージェント・コマンド
├─ .github/workflows/        自動デプロイ設定（neo-scorebook のみ）
└─ _to_delete/               不要と判断したもの。確認して手動で削除する
```

## よく使う手順

### neo-scorebook をローカルで動かす

```bash
cd neo-scorebook
python3 -m http.server 8082        # → http://localhost:8082/neo-scorebook.html
```

### neo-scorebook のテスト

```bash
cd neo-scorebook
node tests/test-logic.js                                   # ユニットテスト（サーバー不要）
python3 -m http.server 8082 & node tests/test-game.js      # 3イニング通しテスト
python3 -m http.server 8765 & node tests/test-scorebook.js # 基本操作テスト
```

Playwright テストは Supabase の実データ（`nsb_teams` / `nsb_players`）を使う。

### デプロイ

- **neo-scorebook**：`main` に push すると GitHub Actions が本体HTML・`scorebook-logic.js`・アイコン3枚を FTPS で `https://baseball.versus.jp/` へアップロードする。
- **BALLSTATS**：自動デプロイの対象外。

### レビュー（Claude Code）

`/review-bug`、`/review-style`、`/review-design`。いずれも neo-scorebook 向け。

## ドキュメントの更新ルール

- 機能を足した・課題を潰した → `docs/STATUS.md` を更新
- テーブル・認証・デプロイを変えた → `docs/ARCHITECTURE.md` と `db/` を更新
- 2本の連携について何か決めた → `docs/INTEGRATION.md` の「決めたこと」に追記
- フォルダを増やした・動かした → この README の構成図を更新
