import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// テーマ生成用のカテゴリと要素
const THEME_CATEGORIES = {
  // 自然現象
  nature: [
    "波紋",
    "オーロラ",
    "雷",
    "雨",
    "雪",
    "風",
    "炎",
    "霧",
    "虹",
    "日の出",
    "月光",
    "星空",
    "流星",
    "渦潮",
    "砂嵐",
  ],
  // 生物
  life: [
    "蝶",
    "魚群",
    "鳥の群れ",
    "花",
    "木",
    "葉",
    "細胞分裂",
    "DNA",
    "心臓",
    "神経",
    "クラゲ",
    "珊瑚",
    "蛍",
    "胞子",
  ],
  // 幾何学
  geometry: [
    "フラクタル",
    "螺旋",
    "万華鏡",
    "モザイク",
    "格子",
    "多角形",
    "円",
    "三角形",
    "六角形",
    "波形",
    "曲線",
    "対称",
  ],
  // 物理
  physics: [
    "重力",
    "振り子",
    "波動",
    "粒子",
    "軌道",
    "衝突",
    "反射",
    "屈折",
    "磁場",
    "電場",
    "流体",
    "弾性",
  ],
  // 人工物
  artificial: [
    "歯車",
    "回路",
    "ネットワーク",
    "都市",
    "迷路",
    "時計",
    "音楽",
    "文字",
    "織物",
    "建築",
    "機械",
  ],
  // 感情・抽象
  abstract: [
    "夢",
    "記憶",
    "時間",
    "空間",
    "無限",
    "混沌",
    "調和",
    "リズム",
    "静寂",
    "躍動",
    "融合",
    "分裂",
  ],
};

// 動きの表現
const MOTIONS = [
  "回転する",
  "脈動する",
  "流れる",
  "浮遊する",
  "拡散する",
  "収縮する",
  "揺らめく",
  "弾む",
  "渦巻く",
  "波打つ",
  "成長する",
  "崩れる",
  "踊る",
  "呼吸する",
  "変形する",
  "分裂する",
  "融合する",
  "反射する",
  "追いかける",
  "避ける",
];

// 色彩の表現
const COLOR_MOODS = [
  "虹色の",
  "モノクロの",
  "暖色の",
  "寒色の",
  "ネオンカラーの",
  "パステルカラーの",
  "深い青の",
  "燃えるような赤の",
  "神秘的な紫の",
  "輝く金色の",
  "透明感のある",
  "グラデーションの",
  "コントラストの強い",
  "淡い",
  "鮮やかな",
];

// スタイル
const STYLES = [
  "ピクセルアート風の",
  "水彩画風の",
  "油絵風の",
  "ミニマルな",
  "サイケデリックな",
  "レトロな",
  "未来的な",
  "和風の",
  "宇宙的な",
  "有機的な",
  "機械的な",
  "幻想的な",
  "シンプルな",
  "複雑な",
  "繊細な",
];

// p5goのサンプルコード（プロンプト用）
const SAMPLE_CODE = `package main

import (
	"math"

	"github.com/ryomak/p5go"
)

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
	)
	select {}
}

var angle float64

func setup(p *p5go.Canvas) {
	p.CreateCanvas(400, 400)
	p.NoStroke()
}

func draw(p *p5go.Canvas) {
	p.Background(30, 30, 40)

	// アニメーションロジック
	for i := 0; i < 12; i++ {
		x := 200 + math.Cos(angle+float64(i)*math.Pi/6)*100
		y := 200 + math.Sin(angle+float64(i)*math.Pi/6)*100
		p.Fill(100, 200, 255, 200)
		p.Ellipse(x, y, 30, 30)
	}

	angle += 0.02
}`;

const SYSTEM_PROMPT = `あなたはp5go（Go言語でProcessingライクなクリエイティブコーディングができるライブラリ）のエキスパートです。
美しくアニメーションするジェネラティブアートを生成してください。

## p5goの基本構造
- p5go.Run("#canvas-detail", ...) でキャンバスを初期化
- p5go.Setup(setup) でセットアップ関数を登録
- p5go.Draw(draw) で毎フレーム呼ばれる描画関数を登録
- select {} でプログラムの終了を防ぐ

## 利用可能なp5goの主要メソッド
### キャンバス
- CreateCanvas(width, height float64)
- Background(r, g, b float64) または Background(gray float64)

### 描画設定
- Fill(r, g, b float64) または Fill(r, g, b, a float64)
- Stroke(r, g, b float64) または Stroke(r, g, b, a float64)
- StrokeWeight(weight float64)
- NoFill()
- NoStroke()

### 図形
- Rect(x, y, w, h float64)
- Ellipse(x, y, w, h float64)
- Circle(x, y, d float64)
- Line(x1, y1, x2, y2 float64)
- Triangle(x1, y1, x2, y2, x3, y3 float64)
- Arc(x, y, w, h, start, stop float64)

### 頂点描画
- BeginShape()
- Vertex(x, y float64)
- EndShape(mode int) // p5go.CLOSE で閉じる

### 変換
- Push() / Pop()
- Translate(x, y float64)
- Rotate(angle float64)
- Scale(s float64) または Scale(sx, sy float64)

### その他
- NoLoop() // アニメーションを停止（静止画用）
- FrameCount() int // 現在のフレーム数

## 制約
- キャンバスサイズは400x400を推奨
- パッケージは "github.com/ryomak/p5go" と標準ライブラリのみ使用可能
- mathパッケージを使って三角関数などを利用可能
- math/randを使ってランダム性を追加可能

## サンプルコード
${SAMPLE_CODE}

## 出力形式
Goのコードのみを出力してください。説明やマークダウンは不要です。
コードブロック(\`\`\`)も不要です。純粋なGoコードのみを出力してください。`;

async function generateArt(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  theme: string
): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}

テーマ「${theme}」に基づいた、美しいアニメーションするp5goアートを生成してください。

独創的で視覚的に魅力的なアートを作成してください。
色彩は調和の取れた配色を心がけ、動きは滑らかで心地よいものにしてください。`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  let code = response.text();

  // コードブロックが含まれている場合は除去
  code = code.replace(/^```go\n?/gm, "");
  code = code.replace(/^```\n?/gm, "");
  code = code.trim();

  return code;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomTheme(): string {
  const strategies = [
    // 戦略1: カテゴリ + 動き
    () => {
      const category = pickRandom(
        Object.keys(THEME_CATEGORIES)
      ) as keyof typeof THEME_CATEGORIES;
      const element = pickRandom(THEME_CATEGORIES[category]);
      const motion = pickRandom(MOTIONS);
      return `${motion}${element}`;
    },
    // 戦略2: スタイル + カテゴリ
    () => {
      const style = pickRandom(STYLES);
      const category = pickRandom(
        Object.keys(THEME_CATEGORIES)
      ) as keyof typeof THEME_CATEGORIES;
      const element = pickRandom(THEME_CATEGORIES[category]);
      return `${style}${element}`;
    },
    // 戦略3: 色彩 + 動き + カテゴリ
    () => {
      const color = pickRandom(COLOR_MOODS);
      const motion = pickRandom(MOTIONS);
      const category = pickRandom(
        Object.keys(THEME_CATEGORIES)
      ) as keyof typeof THEME_CATEGORIES;
      const element = pickRandom(THEME_CATEGORIES[category]);
      return `${color}${motion}${element}`;
    },
    // 戦略4: 2つの要素の組み合わせ
    () => {
      const cat1 = pickRandom(
        Object.keys(THEME_CATEGORIES)
      ) as keyof typeof THEME_CATEGORIES;
      const cat2 = pickRandom(
        Object.keys(THEME_CATEGORIES)
      ) as keyof typeof THEME_CATEGORIES;
      const elem1 = pickRandom(THEME_CATEGORIES[cat1]);
      const elem2 = pickRandom(THEME_CATEGORIES[cat2]);
      const connectors = [
        "と",
        "が織りなす",
        "のような",
        "に浮かぶ",
        "を纏った",
        "と共鳴する",
      ];
      return `${elem1}${pickRandom(connectors)}${elem2}`;
    },
    // 戦略5: スタイル + 色彩 + カテゴリ
    () => {
      const style = pickRandom(STYLES);
      const color = pickRandom(COLOR_MOODS);
      const category = pickRandom(
        Object.keys(THEME_CATEGORIES)
      ) as keyof typeof THEME_CATEGORIES;
      const element = pickRandom(THEME_CATEGORIES[category]);
      return `${style}${color}${element}`;
    },
  ];

  return pickRandom(strategies)();
}

async function generateThemeWithAI(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>
): Promise<string> {
  const prompt = `ジェネラティブアートのテーマを1つ考えてください。
視覚的に美しく、アニメーションとして表現できるものが望ましいです。
テーマのみを短く（10-30文字程度）で回答してください。説明は不要です。
例: 「渦巻く銀河の光」「脈動する細胞の分裂」「万華鏡の中の蝶」`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text().trim().replace(/[「」]/g, "");
}

async function selectRandomTheme(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>
): Promise<string> {
  // 50%の確率でAIでテーマ生成、50%で組み合わせ生成
  if (Math.random() < 0.5) {
    console.log("Generating theme with AI...");
    return generateThemeWithAI(model);
  }
  console.log("Generating theme from combinations...");
  return generateRandomTheme();
}

function generateArtName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function updateDataTs(artName: string, date: string): void {
  const dataPath = path.join(process.cwd(), "art/data/data.ts");
  let content = fs.readFileSync(dataPath, "utf-8");

  // 新しいエントリを作成
  const newEntry = `\t{
\t\tlanguage: "go",
\t\tname: "${artName}",
\t\tat: "${date}"
\t}`;

  // arts配列の最後に追加
  // 最後の } の前に新しいエントリを挿入
  const insertPosition = content.lastIndexOf("];");
  if (insertPosition === -1) {
    throw new Error("Could not find arts array end in data.ts");
  }

  // 最後のエントリの後にカンマがあるか確認
  const beforeInsert = content.substring(0, insertPosition).trimEnd();
  const needsComma = !beforeInsert.endsWith(",") && !beforeInsert.endsWith("[");

  const newContent =
    beforeInsert +
    (needsComma ? "," : "") +
    "\n" +
    newEntry +
    "\n" +
    content.substring(insertPosition);

  fs.writeFileSync(dataPath, newContent);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const artName = process.env.ART_NAME || generateArtName();
  const date = new Date().toISOString().split("T")[0];

  // テーマを決定（環境変数で指定されていなければランダム生成）
  const theme = process.env.ART_THEME || (await selectRandomTheme(model));

  console.log(`Generating art with theme: "${theme}"`);
  console.log(`Art name: ${artName}`);

  // アートを生成
  const code = await generateArt(model, theme);

  // ディレクトリを作成
  const artDir = path.join(process.cwd(), "art/go", artName);
  fs.mkdirSync(artDir, { recursive: true });

  // main.goを保存
  const mainGoPath = path.join(artDir, "main.go");
  fs.writeFileSync(mainGoPath, code);
  console.log(`Generated: ${mainGoPath}`);

  // data.tsを更新
  updateDataTs(artName, date);
  console.log(`Updated: art/data/data.ts`);

  // 環境変数として出力（GitHub Actions用）
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `art_name=${artName}\n`);
    fs.appendFileSync(githubOutput, `art_theme=${theme}\n`);
    fs.appendFileSync(githubOutput, `art_date=${date}\n`);
  }

  console.log("\nGenerated code:");
  console.log("---");
  console.log(code);
  console.log("---");
}

main().catch((error) => {
  console.error("Error generating art:", error);
  process.exit(1);
});
