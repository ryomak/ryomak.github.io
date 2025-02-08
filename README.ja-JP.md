## 記事のヘッダー

```yaml
---
title: My First Blog Post
published: 2023-09-09
description: This is the first post of my new Astro blog.
image: /images/cover.jpg
tags: [Foo, Bar]
category: Front-end
draft: false
---
```

## コマンド

すべてのコマンドは、ターミナルでプロジェクトのルートから実行する必要があります:

| Command                             | Action                                           |
|:------------------------------------|:-------------------------------------------------|
| `pnpm install` AND `pnpm add sharp` | 依存関係のインストール                           |
| `pnpm dev`                          | `localhost:4321`で開発用ローカルサーバーを起動      |
| `pnpm build`                        | `./dist/`にビルド内容を出力          |
| `pnpm preview`                      | デプロイ前の内容をローカルでプレビュー     |
| `pnpm new-post <filename>`          | 新しい投稿を作成                                |
| `pnpm astro ...`                    | `astro add`, `astro check`の様なコマンドを実行する際に使用 |
| `pnpm astro --help`                 | Astro CLIのヘルプを表示                     |

## アートの追加方法

1. `art/data/data.ts`にアートの情報を追加します。
2. `art/go/dir/main.go`にアートのコードを追加します。
3. `make go-build ART_NAME=dir`を実行します。
4. `yarn dev`を実行します。
5. `sh scripts/art_gif.sh go dir`を実行します。