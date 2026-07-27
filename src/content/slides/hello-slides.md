---
title: Markdown で書くスライド
published: 2026-07-26
description: remark プラグインで Markdown をスライドに分割するデモ
event: demo
theme: midnight
slides: true
---

# Markdown で書くスライド

`src/content/slides/*.md` に置くだけ

---

## 書き方

- フロントマターに **`slides: true`** を入れる
- 本文を **`---`** で区切ると 1 枚ずつのスライドになる
- ブログと同じ remark / rehype を通るので、数式もコードも admonition もそのまま使える

---

## テーマ

```yaml
theme: paper
```

- `midnight` — 今までの暗色テーマ
- `paper` — 明るい資料向け
- `studio` — コントラスト強め
- `terminal` — 技術発表向け
- `sunset` — 写真や作品紹介向け

---

## コードもそのまま

```go
func main() {
	fmt.Println("hello, slides")
}
```

インラインの `code` もいつも通り。

---

## 画像もそのまま大きく

![ruby image art](/art/go/ruby_image/art.gif)

- Markdown の `![alt](/path)` だけで表示
- 画像と文章が同じスライドにあると、発表向けに大きく扱う

---

![retro game art](/art/go/retro_game/art.gif)

---

## 操作

| キー | 動作 |
| --- | --- |
| → / Space | 次へ |
| ← | 前へ |
| O | 一覧 |
| T | サムネイル |
| S | 発表者パネル |
| F | 全画面 |
| P | 印刷（PDF 化） |

---

## おわり

`/slides/` に一覧、`/slides/hello-slides/` がこのデッキ
