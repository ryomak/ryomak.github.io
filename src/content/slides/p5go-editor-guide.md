---
title: p5go Editorの使い方
published: 2026-07-27
description: p5go EditorでGoのクリエイティブコーディングを始めるための具体例
event: draft
draft: true
theme: studio
slides: true
---

# p5go Editorの使い方

Goだけで、ブラウザ上に動く絵をすぐ描ける

---

## 入口

まずはエディタを開き、最小コードを動かすところから始める

- エディタ: [p5go Editor](https://p5go-editor.ryomak.jp/)
- ライブラリ: [github.com/ryomak/p5go](https://github.com/ryomak/p5go)
- サンプル: [p5go examples](https://github.com/ryomak/p5go/tree/main/example)

---

## 作品の例

短いコードでも、動きと入力を入れると作品らしくなる

![p5go ruby art](/art/go/ruby_image/art.gif)

---

## エディタで見る場所

コード、プレビュー、エラーの3点を往復すると、修正が速くなる

| 場所 | 見ること | 詰まった時 |
| --- | --- | --- |
| Editor | Goコード | 関数名、import、括弧を見る |
| Preview | Canvasの結果 | 背景が塗れているかを見る |
| Console | エラー | 最初のエラー行から直す |

---

## 基本構造

`Setup`で初期化し、`Draw`で毎フレーム描く

```go
package main

import "github.com/ryomak/p5go"

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
	)
	select {}
}
```

---

## 実行の流れ

`Setup`は一度だけ、`Draw`は描画のたびに呼ばれる

<div class="diagram">
  <div class="node">Run<small>キャンバスに接続</small></div>
  <div class="arrow">→</div>
  <div class="node">Setup<small>初期化</small></div>
  <div class="arrow">→</div>
  <div class="node">Draw<small>毎フレーム</small></div>
  <div class="arrow">↺</div>
</div>

---

## 画面を作る

最初の1枚は、キャンバスの大きさと背景色だけで十分に動く

```go
func setup(p *p5go.Canvas) {
	p.CreateCanvas(640, 360)
}

func draw(p *p5go.Canvas) {
	p.Background(18, 20, 28)
}
```

---

## 実コード: 角度で動かす

`art/go/ruby_image/main.go`では、グローバルな角度を少しずつ増やして回転を作っている

```go
var angle float64

func draw(p *p5go.Canvas) {
	p.Push()
	p.Translate(150, 150)
	p.Rotate(angle)
	p.BeginShape()
	p.Vertex(-45, 45)
	p.Vertex(-45, -45)
	p.Vertex(-10, -70)
	p.Vertex(65, 0)
	p.Vertex(-10, 70)
	p.EndShape(p5go.CLOSE)
	p.Pop()

	angle += 0.01
}
```

---

## 実コード: 背景を作る

Ruby作品は、背景も1本の命令ではなく、細い矩形を重ねてグラデーションにしている

```go
func draw(p *p5go.Canvas) {
	for i := 0; i < 300; i++ {
		r := 220 - float64(i)*0.3
		g := 20 - float64(i)*0.05
		b := 60 - float64(i)*0.1
		p.Fill(r, g, b)
		p.Rect(0, float64(i), 300, 1)
	}
}
```

---

## 実コードでよく出る命令

ART配下の作品では、図形命令だけでなく座標変換とイベントをよく使っている

| 命令 | 使いどころ |
| --- | --- |
| `Background` | 前のフレームを消す |
| `Fill` | 図形の中の色を決める |
| `Push` / `Pop` | TranslateやRotateの影響範囲を閉じる |
| `Translate` / `Rotate` | パーツ単位で動かす |
| `BeginShape` / `Vertex` / `EndShape` | 多角形を描く |
| `MousePressed` | クリックで状態を変える |
| `FrameRate` | アニメーション速度を決める |

---

![p5go retro game art](/art/go/retro_game/art.gif)

---

## マウスに反応する

`art/go/move_eye/main.go`では、マウスとの角度を計算して黒目を回している

```go
func (f *face) eye(p *p5go.Canvas, x, y float64) {
	angle := p.Atan2(p.MouseY()-y, p.MouseX()-x)
	p.Push()
	p.Translate(x, y)
	p.Fill("white")
	p.Ellipse(0, 0, 0.25*f.width, 0.25*f.width)
	p.Rotate(angle)
	p.Fill(f.color)
	p.Ellipse(0.0625*f.width, 0, 0.125*f.width, 0.125*f.width)
	p.Pop()
}
```

---

## 作品にするコツ

実コードを見ると、作品らしさは「状態」「描画」「入力」を分けることで作られている

| 観点 | 実コードの例 |
| --- | --- |
| 状態 | `angle`、`faces`、`currentCells`、`captureState` |
| 描画 | `draw`から小さな描画関数を呼ぶ |
| 入力 | `MousePressed`で盤面やゲーム状態を変える |
| 速度 | `FrameRate(10)`や`FrameRate(60)`で作品に合わせる |

---

## 詰まった時の見方

動かない時は、コード全体ではなく「実行入口」と「描画関数」を見る

- `main`から`p5go.Run`が呼ばれているか
- `select {}`でWASM側の処理を止めずに待っているか
- `Setup`と`Draw`の関数名が一致しているか
- `Draw`の中で毎フレーム背景を塗っているか
- `MousePressed`などのイベント登録を忘れていないか

---

## 次に作るもの

小さな作品を3つ作ると、p5goの勘所がつかめる

- マウスを追う目
- ランダムに光る星空
- クリックで姿が変わるキャラクター

---

## 40分ワークショップ

作りながら進めると、エディタの使い方とp5goの考え方が同時に入る

| 時間 | 作業 | できるようになること |
| --- | --- | --- |
| 0-5分 | エディタを開いてサンプルを動かす | Runと画面確認 |
| 5-15分 | 図形と色を変える | 座標、色、描画命令 |
| 15-25分 | `angle`や状態変数で動かす | 毎フレームの考え方 |
| 25-35分 | マウス入力を足す | インタラクション |
| 35-40分 | 作品名をつけて共有する | 次に直す点を言語化 |

---

## 座標の見方

画面は左上が原点で、右に行くほどX、下に行くほどYが増える

<div class="diagram">
  <div class="node">0,0<small>左上</small></div>
  <div class="arrow">x →</div>
  <div class="node">Canvas<small>640 x 360</small></div>
  <div class="arrow">y ↓</div>
  <div class="node">640,360<small>右下</small></div>
</div>

| 置きたい場所 | X | Y |
| --- | --- | --- |
| 中央 | `p.Width()/2` | `p.Height()/2` |
| 左上寄り | 小さい | 小さい |
| 右下寄り | 大きい | 大きい |

---

## 色を決める

最初は背景、主役、アクセントの3色だけにすると画面がまとまる

| 役割 | 例 | 使う場所 |
| --- | --- | --- |
| 背景 | `Background(18, 20, 28)` | 毎フレーム最初 |
| 主役 | `Fill(255, 207, 109)` | キャラクター、星 |
| アクセント | `Stroke(110, 231, 183)` | 軌跡、線、輪郭 |

---

## 動きのレシピ

「値が少しずつ変わる」だけで、アニメーションになる

| 作りたい動き | 考え方 | コードの種 |
| --- | --- | --- |
| 回転 | 角度を増やして`Rotate` | `angle += 0.01` |
| 周回 | `math.Sin` / `math.Cos`で座標を作る | `x := cx + math.Cos(angle)*r` |
| 視線 | マウスとの角度を取る | `p.Atan2(p.MouseY()-y, p.MouseX()-x)` |
| クリック反応 | 状態を入れ替える | `p5go.MousePressed(mousePressed)` |

---

## 実コード: クリックイベント

`art/go/20250118/main.go`では、クリックでライフゲームの盤面を作り直している

```go
func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
		p5go.MousePressed(mousePressed),
	)
	select {}
}

func mousePressed(p *p5go.Canvas) {
	randomizeBoard()
}
```

---

## エラーを読む

エラーは全部読むより、最初の1行と自分が最後に触った場所を見る

| 表示 | よくある原因 | 直し方 |
| --- | --- | --- |
| `undefined` | 関数名や変数名の違い | 大文字小文字を合わせる |
| `missing` | 括弧やカンマ不足 | 直前の行を見る |
| 画面が真っ黒 | `Draw`が呼ばれていない | 関数名、`Run`、`select {}`を見る |
| 前の絵が残る | 背景を塗っていない | `Background`を最初に置く |

---

## 作品レビューの型

うまい下手ではなく、次に変える一点を見つける

<div class="matrix">
  <div><h4>見た目</h4><p>主役が一目で分かるか。背景と色が近すぎないか。</p></div>
  <div><h4>動き</h4><p>速すぎないか。止まって見える要素と動く要素が分かれているか。</p></div>
  <div><h4>入力</h4><p>マウスを動かした時に、どこが反応するか分かるか。</p></div>
  <div><h4>コード</h4><p>1つの関数が長すぎないか。数字の意味を説明できるか。</p></div>
</div>

---

## 共有する

リンクを開ける形にすると、作品はレビューしやすくなる

| リンク | 用途 |
| --- | --- |
| [p5go Editor](https://p5go-editor.ryomak.jp/) | ブラウザで書いて動かす |
| [p5go GitHub](https://github.com/ryomak/p5go) | ライブラリのコードを見る |
| [examples](https://github.com/ryomak/p5go/tree/main/example) | 次に真似する題材を探す |

---

## 5分演習

<div class="workshop">
  <div class="timebox">5m</div>
  <div class="prompt">
    <p>「マウスを追う目」を作る。白い円、黒い円、マウスに近づく瞳の3つだけでよい。</p>
    <p>完成したら、色か動きのどちらか一つだけ変えて、作品名をつける。</p>
  </div>
</div>
