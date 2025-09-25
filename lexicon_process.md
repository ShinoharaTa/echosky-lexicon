# atproto Lexicon リポジトリ運用ドキュメント

このドキュメントは **フロントエンドから分離**した Lexicon（atproto スキーマ）専用リポジトリの構成・運用ガイドです。2ch風掲示板（板→スレ→レス＋メンション＋リアクション）MVP を念頭に、将来の拡張や型生成、CI までをカバーします。

---

## 目的

* フロントエンド/ビュー実装と **スキーマ定義を分離** し、スキーマ進化（versioning）を安全に行う。
* すべてのクライアント（Web/アプリ/インデクサ/バッチ）に **同一ソースの真実（SSOT）** を提供。
* CI により **静的検証（lint/validate）** と **互換性チェック** を自動化。

---

## 想定するスキーマ（MVP）

* `app.echosky.board.thread`：スレッド
* `app.echosky.board.post`：レス（メンション・アンカー対応）
* `app.echosky.board.reaction`：リアクション（like/laugh/sad/angry/star）

> 将来：モデレーション、ラベル、添付（BLOB）などの Lexicon を追加。

---

## リポジトリ構成（テンプレ）

```
lexicons/
  app.echosky.board.thread.json
  app.echosky.board.post.json
  app.echosky.board.reaction.json
schema/
  meta/                      # 取り込むメタスキーマ類（必要なら）
  examples/                  # サンプルレコード
  docs/                      # 自動生成ドキュメントの出力先
scripts/
  validate.ts                # Lexicon 検証（@atproto/lexicon で parse）
  build-types.ts             # 型定義生成（TypeScript）
  diff-compat.ts             # 前バージョンとの差分・互換性チェック
package.json
README.md
CHANGELOG.md
LICENSE
```

### パッケージ種別

* Node 18+ / TypeScript を想定。
* 公開パッケージとする場合は `"type": "module"` を推奨。

---

## Lexicon 定義（初期版）

> **注意**：`id` はパッケージの名前空間（逆ドメイン）に合わせて変更してください。

### `lexicons/app.echosky.board.thread.json`

```json
{
  "lexicon": 1,
  "id": "app.echosky.board.thread",
  "defs": {
    "record": {
      "type": "record",
      "description": "掲示板スレッド",
      "key": "tid-{tid}",
      "record": {
        "type": "object",
        "required": ["title", "createdAt"],
        "properties": {
          "title": { "type": "string", "maxLength": 200 },
          "board": { "type": "string", "maxLength": 50 },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `lexicons/app.echosky.board.post.json`

```json
{
  "lexicon": 1,
  "id": "app.echosky.board.post",
  "defs": {
    "record": {
      "type": "record",
      "description": "スレ内の投稿（メンション/参照対応）",
      "record": {
        "type": "object",
        "required": ["thread", "text", "createdAt"],
        "properties": {
          "thread": { "type": "string" },
          "text": { "type": "string", "maxLength": 5000 },
          "createdAt": { "type": "string", "format": "datetime" },
          "facets": {
            "type": "array",
            "items": { "$ref": "app.bsky.richtext.facet" }
          },
          "refPost": {
            "type": "ref",
            "ref": "com.atproto.repo.strongRef",
            "nullable": true,
            "description": ">>123 参照（対象投稿の AT URI/CID）"
          }
        }
      }
    }
  }
}
```

### `lexicons/app.echosky.board.reaction.json`

```json
{
  "lexicon": 1,
  "id": "app.echosky.board.reaction",
  "defs": {
    "record": {
      "type": "record",
      "description": "投稿へのリアクション",
      "key": "r-{subject}-{reaction}-{did}",
      "record": {
        "type": "object",
        "required": ["subject", "reaction", "createdAt"],
        "properties": {
          "subject": { "type": "ref", "ref": "com.atproto.repo.strongRef" },
          "reaction": {
            "type": "string",
            "enum": ["like", "laugh", "sad", "angry", "star"]
          },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

---

## セマンティックバージョニング指針

* **MAJOR**: 破壊的変更（必須フィールドの追加/削除、型変更、意味変更）
* **MINOR**: 後方互換な追加（任意フィールドの追加、enum 値の追加）
* **PATCH**: ドキュメント修正、説明の追加、typo など

> 例：`1.2.0` → `1.3.0` は新規任意フィールドの追加。

---

## `package.json`（例）

```json
{
  "name": "@example/board-lexicons",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "files": [
    "lexicons/",
    "dist/",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "ts-node scripts/build-types.ts && ts-node scripts/validate.ts",
    "validate": "ts-node scripts/validate.ts",
    "diff": "ts-node scripts/diff-compat.ts",
    "docs": "ts-node scripts/generate-docs.ts"
  },
  "devDependencies": {
    "@atproto/lexicon": "^0.5.0",
    "typescript": "^5.4.0",
    "ts-node": "^10.9.2"
  }
}
```

> `@atproto/lexicon` は Lexicon の parse/検証用ライブラリ。バージョンは環境に合わせて調整してください。

---

## 検証スクリプト（`scripts/validate.ts`）

Lexicon ファイルの構文・参照関係を静的検証します。

```ts
// scripts/validate.ts
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { Lexicons } from '@atproto/lexicon';

async function main() {
  const dir = resolve(process.cwd(), 'lexicons');
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));

  const lex = new Lexicons();
  for (const f of files) {
    const json = JSON.parse(await fs.readFile(resolve(dir, f), 'utf-8'));
    lex.add(json);
    console.log(`[ok] added ${f}`);
  }

  // 参照解決のチェック（存在しない $ref があれば例外）
  console.log('All lexicons loaded successfully');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

## 型生成（`scripts/build-types.ts`）

最小実装として、Lexicon JSON を `dist/` にコピーし、TypeScript の **型エクスポート** を用意します（高度なコード生成が不要な場合）。

```ts
// scripts/build-types.ts
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const src = resolve(process.cwd(), 'lexicons');
  const out = resolve(process.cwd(), 'dist');
  await fs.mkdir(out, { recursive: true });

  const files = (await fs.readdir(src)).filter(f => f.endsWith('.json'));
  const exports: string[] = [];

  for (const f of files) {
    const json = await fs.readFile(resolve(src, f), 'utf-8');
    await fs.writeFile(resolve(out, f), json, 'utf-8');

    const id = JSON.parse(json).id as string;
    const constName = id.replace(/\W+/g, '_');
    exports.push(`export { default as ${constName} } from './${f}' assert { type: 'json' };`);
  }

  // 型定義 index（JSON モジュールをそのまま re-export）
  await fs.writeFile(resolve(out, 'index.d.ts'), `
  declare module '*.json' { const v: any; export default v; }
  export {};
  `);
  await fs.writeFile(resolve(out, 'index.js'), exports.join('\n'));

  console.log('Built dist/ with JSON exports');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

> 本格的にやるなら、カスタムコードジェネレータを用いて **型安全なレコード I/O** を生成してください（将来拡張）。

---

## 互換性チェック（`scripts/diff-compat.ts`）

タグ付け済みの前バージョン（例：`v0.1.0`）と作業ツリー差分を検査し、**破壊的変更** を検知します。

```ts
// scripts/diff-compat.ts
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

const PREV_TAG = process.env.PREV_TAG || 'v0.1.0';

async function loadAtTag(tag: string) {
  const tmp = '.tmp_lex_prev';
  execSync(`rm -rf ${tmp}`);
  execSync(`git show ${tag}:lexicons > /dev/null 2>&1 || true`);
  execSync(`git archive --format=tar ${tag} lexicons | tar -x -C .`);
  return tmp; // 省略（実運用では安全に展開）
}

function analyzeChange(prev: any, curr: any) {
  // 超簡易判定：required の増加、型の変化、enum の狭めは BREAKING。
  // 実運用は細かい規則に合わせて実装。
  return [] as string[];
}

async function main() {
  // 前タグをチェックアウトしてファイル群取得（実装省略）
  // prev/curr を突き合わせて analyzeChange()
  console.log('No breaking changes detected (stub).');
}

main().catch(e => { console.error(e); process.exit(1); });
```

> 実サービスでは JSON Schema レベルの詳細比較を実装してください。

---

## 例：サンプルレコード（`schema/examples/`）

* `thread.json`
* `post-1.json`（メンションあり、`facets` サンプル）
* `reaction-like.json`

これらは **CI で実際に parse してバリデーション** します。

---

## CI（GitHub Actions 例）

`.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run validate
      - run: npm run build
```

> リリース時に `npm publish --access public` するワークフローを追加しても良いです。

---

## 公開・配布

* OSS として配布する場合：

  * **npm パッケージ**として JSON を配布（`dist/` 配下を `exports`）
  * **Git タグ**でバージョン固定、CHANGELOG を維持
  * **GitHub Releases** に `dist/` を添付

* 社内配布の場合：

  * Git submodule / subtree で参照
  * Private npm registry（GitHub Packages など）

---

## 利用（フロントエンド側）

* `@echosky/board-lexicons` を依存に追加し、`app_echosky_board_post` 等の **定義 JSON を直接参照**。
* atproto クライアントで `collection` 名として `id` を使用（例：`app.echosky.board.post`）。
* UI 側のバリデーションに **同じ制約（maxLength 等）** を適用。

---

## 命名・スタイル規約

* `id` は **逆ドメイン**（`app.echosky.*`）
* `record.description` を **簡潔に** ただし具体的に
* フィールド名は `camelCase`
* 日時は ISO8601（`format: datetime`）
* 文字列長は上限を必ず設定

---

## ライセンス

* AGPL / MIT / Apache-2.0 など、運用方針に合わせて選定。

---

## 今後の拡張

* 画像・添付：BLOB 参照 Lexicon の追加
* モデレーション：labels、通報 Lexicon
* 紐付け簡素化：`thread` を AT URI から StrongRef へ（改変検出の厳格化）
* ドキュメント自動生成：Lexicon → Markdown/HTML（`schema/docs/` 出力）

---

### 付録 A：README テンプレ

````md
# @example/board-lexicons

atproto 用の掲示板スキーマ定義（Lexicon）集。

## Install

```bash
npm i @example/board-lexicons
````

## Usage

* コレクション名：

  * `app.echosky.board.thread`
  * `app.echosky.board.post`
  * `app.echosky.board.reaction`

* クライアント例：`com.atproto.repo.createRecord({ collection: 'app.echosky.board.post', ... })`

## Development

```bash
npm run validate
npm run build
```

## Versioning

* SemVer 準拠。破壊的変更は MAJOR を上げる。

```

---

## 合意事項チェックリスト
- [ ] 逆ドメイン `id` の登録
- [ ] 文字列上限・必須項目の定義
- [ ] `facets` 参照（`app.bsky.richtext.facet`）の互換性確認
- [ ] `reaction` の enum 値の合意
- [ ] CI の最小検証（parse 成功）
- [ ] 互換性ポリシー（MAJOR/MINOR/PATCH）

---

> 必要であれば、このまま雛形を zip 化した **最小スタータ**（`npm`/`pnpm` 対応）を用意できます。

```
