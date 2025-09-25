# @echosky/board-lexicons

Echosky (app.echosky.*) の atproto 用掲示板スキーマ定義集。

## Install

```bash
npm i @echosky/board-lexicons
```

## Usage

- コレクション ID
  - app.echosky.board.thread
  - app.echosky.board.post
  - app.echosky.board.reaction

- クライアント例
```ts
import { com_atproto_repo_createRecord } from '@atproto/api'

// 例: 投稿の作成
// await agent.com.atproto.repo.createRecord({
//   collection: 'app.echosky.board.post',
//   repo: did,
//   record: { thread: 'at://.../app.echosky.board.thread/xxx', text: 'hello', createdAt: new Date().toISOString() }
// })
```

## Scripts

```bash
npm run validate
npm run build
npm run diff
npm run docs
```

## License

MIT
