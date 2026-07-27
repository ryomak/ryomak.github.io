---
title: トップページを WebGL で作り直した話
published: 2026-07-26
description: Astro のトップページに three.js のシーンを載せ、スクロールをカメラワークに割り当てるまで
event: draft
draft: true
theme: studio
slides: true
---

# トップページを<br />WebGL で作り直した話

ryomak — 2026

---

## 何を作ったか

- 静的なポートフォリオだったトップを、**スクロール＝カメラワーク**の一本道に置き換えた
- 文章は既存のセクションをそのまま流用。変えたのは *見せ方* だけ
- WebGL が無い環境ではただの縦積みページに戻る

---

## 構成

```
src/
├── pages/index.astro          # マークアップ（5章ぶん）
├── components/home/
│   ├── CityStage.astro        # canvas とフォールバック
│   └── city/
│       ├── config.ts          # カメラの経由点
│       └── scene.ts           # three.js 本体
├── scripts/home-city.ts       # スクロール → 進捗 → カメラ
└── styles/home-city.css       # 夜のパレット
```

---

## カメラは「経由点」だけ書く

```ts
export const WAYPOINTS: Waypoint[] = [
  { pos: [360.0, 178, 0.0], target: [0, 46, 0] },   // 海の上から俯瞰
  { pos: [-20.4, 55, -62.8], target: [0, 46, 0] },  // 球体へ寄る
  { pos: [0.0, 52, 0.0], target: [0, 52, 0] },      // 水中を通過
]
```

Catmull-Rom で補間して、スクロール進捗 `0..1` をそのまま曲線の位置に割り当てる。

---

## 効いた判断

1. **スクロールを自前で持つ** — ドキュメントは固定し、専用スクローラで距離を供給する
2. **パネルは `<body>` 直下へ退避** — position: fixed 同士の重なり順を素直にするため
3. **章ごとにシーンの状態を進める** — 廃墟が組み上がる進捗をスクロールに紐付けた

---

## ハマったところ

継承していた文字色が、パネルを `<body>` へ移した瞬間に消える。

```css
/* .city の外に出た時点でこれは効かなくなる */
.city { color: var(--city-ink); }

/* 色はパネル自身に持たせる */
.city-panels { color: var(--city-ink); }
```

> 位置を動かす最適化は、継承も一緒に動かす。

---

## パフォーマンス

| 項目 | 方針 |
| --- | --- |
| モデル | Draco 圧縮の GLB を1つだけ |
| 描画 | `prefers-reduced-motion` で静的版に切替 |
| 初期表示 | シーン読み込み前はグラデーションで代替 |
| DPR | 上限 2 でクランプ |

---

## まとめ

- スクロールに意味を与えると、同じ文章でも読み方が変わる
- 退避は速いが、**CSS の継承だけは付いてこない**
- フォールバックを先に書くと、後が楽

---

# ありがとうございました

[github.com/ryomak](https://github.com/ryomak)
