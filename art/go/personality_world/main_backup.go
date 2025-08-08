package main

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/ryomak/p5go"
)

const (
	CANVAS_WIDTH  = 400
	CANVAS_HEIGHT = 400
	PIXEL_SIZE    = 4  // ドットアートスタイル
	ROOM_SIZE     = 100 // 立方体の部屋
)

var (
	p          *p5go.Canvas
	
	// MBTI と財産パラメータ
	mbtiType    string
	wealthLevel int // 0-100
	
	// MBTI 次元の解析
	isExtrovert bool // E vs I (外向的 vs 内向的)
	isSensing   bool // S vs N (感覚的 vs 直感的)
	isThinking  bool // T vs F (思考的 vs 感情的)
	isJudging   bool // J vs P (判断的 vs 知覚的)
	
	// カラーパレット
	palette map[string][3]float64
	
	// 部屋の要素
	roomElements []RoomElement
	
	// ピクセルエフェクト
	pixelEffects []PixelEffect
)

type RoomElement struct {
	x, y, z      float64
	width        float64
	height       float64
	depth        float64
	elementType  string
	color        string
}

type PixelEffect struct {
	x, y    float64
	color   [3]float64
	life    float64
}

// ─────────────────────────────
// カラーパレット
func initPalette() {
	palette = make(map[string][3]float64)
	
	// MBTIタイプに基づくベースカラー
	var baseHue float64
	
	// 外向/内向でベース色相を決定
	if isExtrovert {
		baseHue = 30 // オレンジ〜イエロー系
	} else {
		baseHue = 210 // ブルー〜パープル系
	}
	
	// 感覚/直感で色相を調整
	if !isSensing {
		baseHue += 60 // より幻想的な色へ
	}
	
	// 思考/感情で彩度を調整
	var saturation float64
	if isThinking {
		saturation = 0.4 // 低彩度
	} else {
		saturation = 0.7 // 高彩度
	}
	
	// 判断/知覚で明度を調整
	var brightness float64
	if isJudging {
		brightness = 0.8 // 明るめ
	} else {
		brightness = 0.6 // 暗め
	}
	
	// HSVからRGBへ変換してパレット生成
	mainColor := hsvToRgb(baseHue, saturation, brightness)
	accentColor := hsvToRgb(math.Mod(baseHue+120, 360), saturation*0.8, brightness)
	subColor := hsvToRgb(math.Mod(baseHue+240, 360), saturation*0.6, brightness*0.9)
	
	// 床と壁の色
	palette["floor_light"] = [3]float64{240, 235, 230}
	palette["floor_dark"] = [3]float64{220, 215, 210}
	palette["wall_back"] = [3]float64{
		mainColor[0]*0.3 + 180,
		mainColor[1]*0.3 + 180,
		mainColor[2]*0.3 + 180,
	}
	palette["wall_left"] = [3]float64{
		mainColor[0]*0.2 + 160,
		mainColor[1]*0.2 + 160,
		mainColor[2]*0.2 + 160,
	}
	palette["wall_right"] = [3]float64{
		mainColor[0]*0.25 + 170,
		mainColor[1]*0.25 + 170,
		mainColor[2]*0.25 + 170,
	}
	
	// 家具の色
	palette["furniture_main"] = mainColor
	palette["furniture_accent"] = accentColor
	palette["furniture_sub"] = subColor
	palette["decoration"] = [3]float64{
		(mainColor[0] + accentColor[0]) / 2,
		(mainColor[1] + accentColor[1]) / 2,
		(mainColor[2] + accentColor[2]) / 2,
	}
	
	// 特定要素の色
	palette["tech"] = [3]float64{180, 200, 220}
	palette["screen"] = [3]float64{100, 200, 255}
	palette["plant"] = [3]float64{120, 200, 100}
	palette["book"] = [3]float64{160, 140, 120}
	palette["cushion"] = accentColor
	palette["window"] = [3]float64{200, 220, 240}
	palette["paper"] = [3]float64{255, 250, 245}
	palette["clock"] = [3]float64{100, 80, 60}
	palette["rug"] = subColor
	palette["shelf"] = [3]float64{140, 100, 80}
	palette["tv"] = [3]float64{60, 60, 60}
	palette["speaker"] = [3]float64{80, 80, 80}
	palette["keyboard"] = [3]float64{220, 220, 220}
	palette["mouse"] = [3]float64{100, 100, 100}
	palette["mug"] = accentColor
	palette["poster"] = [3]float64{255, 240, 200}
	palette["trophy"] = [3]float64{255, 215, 0}
	palette["guitar"] = [3]float64{160, 82, 45}
	palette["mirror"] = [3]float64{200, 220, 240}
	palette["drawer"] = mainColor
	palette["vase"] = [3]float64{200, 150, 100}
	palette["candle"] = [3]float64{255, 240, 200}
	
	// ペットの色（MBTIに応じて変化）
	if isThinking {
		palette["pet_main"] = [3]float64{200, 200, 200} // グレー系（ロボット風）
		palette["pet_accent"] = [3]float64{100, 100, 100}
	} else {
		palette["pet_main"] = [3]float64{240, 200, 150} // ブラウン系（猫）
		palette["pet_accent"] = [3]float64{80, 60, 50}
	}
	
	// 富裕度による装飾色
	if wealthLevel > 70 {
		palette["luxury"] = [3]float64{255, 215, 0}  // ゴールド
		palette["frame"] = [3]float64{200, 200, 200} // シルバー
		palette["diamond"] = [3]float64{240, 250, 255}
	} else if wealthLevel > 40 {
		palette["luxury"] = mainColor
		palette["frame"] = subColor
		palette["diamond"] = accentColor
	} else {
		palette["luxury"] = [3]float64{150, 150, 150}
		palette["frame"] = [3]float64{120, 120, 120}
		palette["diamond"] = [3]float64{180, 180, 180}
	}
	
	// エフェクト色（MBTIに基づく）
	palette["pixel_accent"] = accentColor
	palette["glow"] = [3]float64{
		math.Min(255, accentColor[0]*1.2),
		math.Min(255, accentColor[1]*1.2),
		math.Min(255, accentColor[2]*1.2),
	}
	palette["shadow"] = [3]float64{50, 50, 60}
	palette["light"] = [3]float64{255, 255, 240}
}

func hsvToRgb(h, s, v float64) [3]float64 {
	h = h / 60
	c := v * s
	x := c * (1 - math.Abs(math.Mod(h, 2) - 1))
	m := v - c
	
	var r, g, b float64
	switch int(h) {
	case 0:
		r, g, b = c, x, 0
	case 1:
		r, g, b = x, c, 0
	case 2:
		r, g, b = 0, c, x
	case 3:
		r, g, b = 0, x, c
	case 4:
		r, g, b = x, 0, c
	default:
		r, g, b = c, 0, x
	}
	
	return [3]float64{
		(r + m) * 255,
		(g + m) * 255,
		(b + m) * 255,
	}
}

// ─────────────────────────────
// メイン関数

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
	)
	select {}
}

func setup(canvas *p5go.Canvas) {
	p = canvas
	p.CreateCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
	p.FrameRate(30)
	p.NoStroke()
	
	// ランダムシード初期化
	rand.Seed(time.Now().UnixNano())
	
	// ランダムなMBTIと財産を生成
	generateRandomPersonality()
	
	// MBTI解析
	parseMBTI()
	
	// パレット初期化
	initPalette()
	
	// 部屋を生成
	generateRoom()
	
	fmt.Printf("MBTI: %s, 財産: %d%%\n", mbtiType, wealthLevel)
}

func draw(canvas *p5go.Canvas) {
	p = canvas
	
	// 背景を描画
	drawBackground()
	
	// 部屋を描画（壁→床の順）
	drawRoom()
	
	// 部屋の要素を描画
	drawRoomElements()
	
	// ピクセルエフェクトを描画
	updateAndDrawPixelEffects()
	
	// UIを描画
	drawUI()
}

func generateRandomPersonality() {
	// ランダムなMBTIタイプ
	types := []string{
		"INTJ", "INTP", "ENTJ", "ENTP",
		"INFJ", "INFP", "ENFJ", "ENFP",
		"ISTJ", "ISFJ", "ESTJ", "ESFJ",
		"ISTP", "ISFP", "ESTP", "ESFP",
	}
	mbtiType = types[rand.Intn(16)]
	
	// ランダムな富裕度
	wealthLevel = rand.Intn(101)
}

func parseMBTI() {
	isExtrovert = mbtiType[0] == 'E'
	isSensing = mbtiType[1] == 'S'
	isThinking = mbtiType[2] == 'T'
	isJudging = mbtiType[3] == 'J'
}

func generateRoom() {
	roomElements = []RoomElement{}
	
	// MBTIに基づいた部屋レイアウト
	if isThinking && isJudging {
		// 整理整頓されたオフィスレイアウト
		generateOrganizedOffice()
	} else if isThinking && !isJudging {
		// クリエイティブなワークスペース
		generateCreativeWorkspace()
	} else if !isThinking && isJudging {
		// 快適で整頓されたリビング
		generateCozyOrganizedLiving()
	} else {
		// 自由でアーティスティックな空間
		generateArtisticSpace()
	}
	
	// 共通の追加家具
	addCommonFurniture()
	
	// 性格に基づく追加要素
	addPersonalityElements()
	
	// 富裕度に基づく装飾
	addWealthElements()
	
	// ピクセルエフェクトを初期化
	initPixelEffects()
}

func generateOrganizedOffice() {
	// デスク
	roomElements = append(roomElements, RoomElement{
		x: 30, y: 0, z: 15,
		width: 40, height: 25, depth: 25,
		elementType: "desk",
		color: "furniture_main",
	})
	
	// モニター
	roomElements = append(roomElements, RoomElement{
		x: 40, y: 25, z: 17,
		width: 20, height: 15, depth: 3,
		elementType: "monitor",
		color: "tech",
	})
	
	// チェア
	roomElements = append(roomElements, RoomElement{
		x: 40, y: 0, z: 45,
		width: 20, height: 25, depth: 20,
		elementType: "chair",
		color: "furniture_accent",
	})
	
	// 本棚
	if wealthLevel > 30 {
		roomElements = append(roomElements, RoomElement{
			x: 5, y: 0, z: 20,
			width: 15, height: 40, depth: 10,
			elementType: "shelf",
			color: "shelf",
		})
	}
}

func generateCreativeWorkspace() {
	// デスク
	roomElements = append(roomElements, RoomElement{
		x: 25, y: 0, z: 15,
		width: 50, height: 25, depth: 30,
		elementType: "desk",
		color: "furniture_main",
	})
	
	// モニター
	roomElements = append(roomElements, RoomElement{
		x: 35, y: 25, z: 18,
		width: 30, height: 18, depth: 4,
		elementType: "monitor",
		color: "tech",
	})
	
	// チェア
	roomElements = append(roomElements, RoomElement{
		x: 40, y: 0, z: 50,
		width: 20, height: 28, depth: 20,
		elementType: "chair",
		color: "furniture_accent",
	})
	
	// ギター
	if !isThinking {
		roomElements = append(roomElements, RoomElement{
			x: 70, y: 0, z: 20,
			width: 10, height: 35, depth: 6,
			elementType: "guitar",
			color: "guitar",
		})
	}
}

func generateCozyOrganizedLiving() {
	// ソファ（L字型）
	roomElements = append(roomElements, RoomElement{
		x: 45, y: 0, z: 35,
		width: 70, height: 30, depth: 35,
		elementType: "sofa",
		color: "furniture_main",
	})
	
	// サイドソファ
	roomElements = append(roomElements, RoomElement{
		x: 20, y: 0, z: 50,
		width: 35, height: 30, depth: 30,
		elementType: "sofa",
		color: "furniture_main",
	})
	
	// コーヒーテーブル
	roomElements = append(roomElements, RoomElement{
		x: 60, y: 0, z: 75,
		width: 40, height: 16, depth: 25,
		elementType: "table",
		color: "furniture_accent",
	})
	
	// テレビ台
	roomElements = append(roomElements, RoomElement{
		x: 120, y: 0, z: 25,
		width: 45, height: 20, depth: 20,
		elementType: "tv_stand",
		color: "furniture_sub",
	})
	
	// テレビ
	roomElements = append(roomElements, RoomElement{
		x: 125, y: 20, z: 27,
		width: 35, height: 22, depth: 3,
		elementType: "tv",
		color: "tv",
	})
	
	// 植物（複数）
	roomElements = append(roomElements, RoomElement{
		x: 15, y: 0, z: 20,
		width: 18, height: 45, depth: 18,
		elementType: "plant",
		color: "plant",
	})
	
	roomElements = append(roomElements, RoomElement{
		x: 135, y: 0, z: 60,
		width: 14, height: 32, depth: 14,
		elementType: "plant",
		color: "plant",
	})
	
	// ラグ
	roomElements = append(roomElements, RoomElement{
		x: 45, y: 0.5, z: 50,
		width: 60, height: 1, depth: 45,
		elementType: "rug",
		color: "rug",
	})
	
	// クッション
	for i := 0; i < 4; i++ {
		roomElements = append(roomElements, RoomElement{
			x: 50 + float64(i%2)*30, y: 30, z: 40 + float64(i/2)*15,
			width: 12, height: 8, depth: 12,
			elementType: "cushion",
			color: "cushion",
		})
	}
	
	// 本棚（整理整頓）
	roomElements = append(roomElements, RoomElement{
		x: 5, y: 0, z: 65,
		width: 25, height: 55, depth: 12,
		elementType: "shelf",
		color: "shelf",
	})
	
	// 花瓶
	roomElements = append(roomElements, RoomElement{
		x: 75, y: 16, z: 80,
		width: 8, height: 12, depth: 8,
		elementType: "vase",
		color: "vase",
	})
	
	// ペット
	roomElements = append(roomElements, RoomElement{
		x: 100, y: 0, z: 65,
		width: 16, height: 18, depth: 14,
		elementType: "pet",
		color: "pet_main",
	})
	
	// 鏡
	roomElements = append(roomElements, RoomElement{
		x: 90, y: 50, z: 2,
		width: 30, height: 40, depth: 2,
		elementType: "mirror",
		color: "mirror",
	})
}

func generateArtisticSpace() {
	// 低いテーブル
	roomElements = append(roomElements, RoomElement{
		x: 65, y: 0, z: 45,
		width: 50, height: 12, depth: 30,
		elementType: "low_table",
		color: "furniture_main",
	})
	
	// フロアクッション（円形配置）
	for i := 0; i < 5; i++ {
		angle := float64(i) * 2 * math.Pi / 5
		roomElements = append(roomElements, RoomElement{
			x: 75 + math.Cos(angle)*35,
			y: 0,
			z: 55 + math.Sin(angle)*25,
			width: 22, height: 8, depth: 22,
			elementType: "floor_cushion",
			color: "cushion",
		})
	}
	
	// イーゼル
	roomElements = append(roomElements, RoomElement{
		x: 20, y: 0, z: 25,
		width: 22, height: 45, depth: 12,
		elementType: "easel",
		color: "furniture_sub",
	})
	
	// キャンバス棚
	roomElements = append(roomElements, RoomElement{
		x: 5, y: 0, z: 50,
		width: 20, height: 35, depth: 10,
		elementType: "canvas_rack",
		color: "shelf",
	})
	
	// アート用品箱
	for i := 0; i < 3; i++ {
		roomElements = append(roomElements, RoomElement{
			x: 120 + float64(i)*12,
			y: 0,
			z: 20 + float64(i)*8,
			width: 10, height: 8, depth: 10,
			elementType: "art_supply",
			color: "decoration",
		})
	}
	
	// 本の山（複数）
	for i := 0; i < 4; i++ {
		roomElements = append(roomElements, RoomElement{
			x: 90 + rand.Float64()*40,
			y: float64(i) * 4,
			z: 60 + rand.Float64()*20,
			width: 12, height: 4, depth: 9,
			elementType: "book_pile",
			color: "book",
		})
	}
	
	// キャンドル
	for i := 0; i < 3; i++ {
		roomElements = append(roomElements, RoomElement{
			x: 60 + float64(i)*15, y: 12, z: 48,
			width: 4, height: 8, depth: 4,
			elementType: "candle",
			color: "candle",
		})
	}
	
	// ギャラリーウォール（複数の絵）
	for i := 0; i < 3; i++ {
		for j := 0; j < 2; j++ {
			roomElements = append(roomElements, RoomElement{
				x: 45 + float64(i)*30, y: 45 + float64(j)*25, z: 2,
				width: 20, height: 18, depth: 2,
				elementType: "painting",
				color: "frame",
			})
		}
	}
	
	// 楽器（創造性）
	roomElements = append(roomElements, RoomElement{
		x: 140, y: 0, z: 65,
		width: 12, height: 40, depth: 8,
		elementType: "guitar",
		color: "guitar",
	})
}

func addCommonFurniture() {
	// 共通で追加される可能性のある家具
	
	// ゴミ箱
	roomElements = append(roomElements, RoomElement{
		x: 155, y: 0, z: 85,
		width: 10, height: 12, depth: 10,
		elementType: "trash",
		color: "furniture_sub",
	})
	
	// サイドテーブル（ランダム配置）
	if rand.Float64() > 0.3 {
		roomElements = append(roomElements, RoomElement{
			x: 110 + rand.Float64()*20, y: 0, z: 70,
			width: 18, height: 20, depth: 18,
			elementType: "side_table",
			color: "furniture_accent",
		})
	}
	
	// スタンドライト（夜型の人向け）
	if !isExtrovert || rand.Float64() > 0.5 {
		roomElements = append(roomElements, RoomElement{
			x: 25, y: 0, z: 75,
			width: 12, height: 50, depth: 12,
			elementType: "floor_lamp",
			color: "luxury",
		})
	}
}

func addPersonalityElements() {
	// 外向的な人は窓を追加
	if isExtrovert {
		roomElements = append(roomElements, RoomElement{
			x: 0, y: 50, z: 40,
			width: 3, height: 40, depth: 50,
			elementType: "window",
			color: "window",
		})
		
		// カーテン
		roomElements = append(roomElements, RoomElement{
			x: 2, y: 45, z: 38,
			width: 2, height: 48, depth: 54,
			elementType: "curtain",
			color: "decoration",
		})
	}
	
	// 直感型は装飾アート
	if !isSensing {
		roomElements = append(roomElements, RoomElement{
			x: 40, y: 55, z: 2,
			width: 35, height: 25, depth: 2,
			elementType: "abstract_art",
			color: "frame",
		})
		
		// 天体望遠鏡
		if rand.Float64() > 0.6 {
			roomElements = append(roomElements, RoomElement{
				x: 145, y: 0, z: 45,
				width: 8, height: 35, depth: 8,
				elementType: "telescope",
				color: "tech",
			})
		}
	}
	
	// 感情型は写真や思い出の品
	if !isThinking {
		for i := 0; i < 3; i++ {
			roomElements = append(roomElements, RoomElement{
				x: 10 + float64(i)*25, y: 65, z: 2,
				width: 12, height: 10, depth: 2,
				elementType: "photo",
				color: "frame",
			})
		}
		
		// ぬいぐるみ
		roomElements = append(roomElements, RoomElement{
			x: 35, y: 30, z: 45,
			width: 10, height: 12, depth: 10,
			elementType: "plushie",
			color: "cushion",
		})
	}
	
	// 判断型は整理用品
	if isJudging {
		// ファイルキャビネット
		roomElements = append(roomElements, RoomElement{
			x: 150, y: 0, z: 55,
			width: 20, height: 35, depth: 18,
			elementType: "cabinet",
			color: "furniture_sub",
		})
	}
}

func addWealthElements() {
	if wealthLevel > 60 {
		// 高級ランプ
		roomElements = append(roomElements, RoomElement{
			x: 130, y: 0, z: 15,
			width: 12, height: 48, depth: 12,
			elementType: "lamp",
			color: "luxury",
		})
		
		// アートコレクション
		roomElements = append(roomElements, RoomElement{
			x: 60, y: 60, z: 2,
			width: 40, height: 30, depth: 3,
			elementType: "expensive_art",
			color: "frame",
		})
		
		if wealthLevel > 80 {
			// 宝石類
			roomElements = append(roomElements, RoomElement{
				x: 85, y: 18, z: 35,
				width: 8, height: 8, depth: 8,
				elementType: "diamond",
				color: "diamond",
			})
			
			// 高級チェア
			roomElements = append(roomElements, RoomElement{
				x: 15, y: 0, z: 85,
				width: 22, height: 32, depth: 20,
				elementType: "luxury_chair",
				color: "luxury",
			})
			
			// ワインラック
			roomElements = append(roomElements, RoomElement{
				x: 165, y: 0, z: 30,
				width: 12, height: 45, depth: 20,
				elementType: "wine_rack",
				color: "furniture_sub",
			})
		}
	} else if wealthLevel < 30 {
		// 質素な追加要素
		
		// ダンボール箱
		for i := 0; i < 2; i++ {
			roomElements = append(roomElements, RoomElement{
				x: 140 + float64(i)*15, y: 0, z: 80,
				width: 12, height: 10, depth: 12,
				elementType: "cardboard",
				color: "decoration",
			})
		}
		
		// 古い扇風機
		roomElements = append(roomElements, RoomElement{
			x: 110, y: 0, z: 85,
			width: 12, height: 35, depth: 12,
			elementType: "fan",
			color: "furniture_sub",
		})
	}
}

func initPixelEffects() {
	pixelEffects = []PixelEffect{}
	
	// MBTIに基づくエフェクト数
	numEffects := 5
	if isExtrovert {
		numEffects += 5
	}
	if !isSensing {
		numEffects += 10
	}
	
	for i := 0; i < numEffects; i++ {
		pixelEffects = append(pixelEffects, PixelEffect{
			x:     rand.Float64() * CANVAS_WIDTH,
			y:     rand.Float64() * CANVAS_HEIGHT,
			color: palette["pixel_accent"],
			life:  rand.Float64(),
		})
	}
}

// ─────────────────────────────
// 描画関数

func drawBackground() {
	// MBTIに基づく背景グラデーション
	bgColor := palette["wall_back"]
	for y := 0; y < CANVAS_HEIGHT; y += PIXEL_SIZE {
		t := float64(y) / float64(CANVAS_HEIGHT)
		r := bgColor[0] * (1 + t*0.2)
		g := bgColor[1] * (1 + t*0.2)
		b := bgColor[2] * (1 + t*0.3)
		p.Fill(math.Min(255, r), math.Min(255, g), math.Min(255, b), 255)
		p.Rect(0, float64(y), CANVAS_WIDTH, PIXEL_SIZE)
	}
}

func drawRoom() {
	// 部屋の原点位置
	roomX := float64(CANVAS_WIDTH/2)
	roomY := float64(CANVAS_HEIGHT/2 + 50)
	
	// 壁を先に描画
	drawWalls(roomX, roomY)
	
	// 床を描画
	drawFloor(roomX, roomY)
}

func drawWalls(roomX, roomY float64) {
	// 背面の壁
	wallColor := palette["wall_back"]
	p.Fill(wallColor[0], wallColor[1], wallColor[2], 255)
	
	for x := 0.0; x < ROOM_WIDTH; x += PIXEL_SIZE*2 {
		for y := ROOM_HEIGHT; y > 0; y -= PIXEL_SIZE*2 {
			isoX, isoY := toIsometric(x, float64(y), 0)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY-ROOM_HEIGHT, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
	
	// 左の壁
	wallColor = palette["wall_left"]
	p.Fill(wallColor[0], wallColor[1], wallColor[2], 255)
	
	for z := 0.0; z < ROOM_DEPTH; z += PIXEL_SIZE*2 {
		for y := ROOM_HEIGHT; y > 0; y -= PIXEL_SIZE*2 {
			isoX, isoY := toIsometric(0, float64(y), z)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY-ROOM_HEIGHT, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
	
	// 右の壁（部分的）
	wallColor = palette["wall_right"]
	p.Fill(wallColor[0], wallColor[1], wallColor[2], 255)
	
	for z := 0.0; z < ROOM_DEPTH*0.3; z += PIXEL_SIZE*2 {
		for y := ROOM_HEIGHT; y > 0; y -= PIXEL_SIZE*2 {
			isoX, isoY := toIsometric(ROOM_WIDTH, float64(y), z)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY-ROOM_HEIGHT, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
}

func drawFloor(roomX, roomY float64) {
	tileSize := 20.0
	for i := 0.0; i < ROOM_WIDTH/tileSize; i++ {
		for j := 0.0; j < ROOM_DEPTH/tileSize; j++ {
			colorKey := "floor_light"
			if int(i+j)%2 == 0 {
				colorKey = "floor_dark"
			}
			
			// タイルを描画
			for px := 0.0; px < tileSize; px += PIXEL_SIZE {
				for pz := 0.0; pz < tileSize; pz += PIXEL_SIZE {
					isoX, isoY := toIsometric(i*tileSize+px, 0, j*tileSize+pz)
					color := palette[colorKey]
					p.Fill(color[0], color[1], color[2], 255)
					p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY, PIXEL_SIZE, PIXEL_SIZE)
				}
			}
		}
	}
}

func drawRoomElements() {
	roomX := float64(CANVAS_WIDTH/2)
	roomY := float64(CANVAS_HEIGHT/2 + 50)
	
	// 深度でソート
	sortedElements := make([]RoomElement, len(roomElements))
	copy(sortedElements, roomElements)
	
	for i := 0; i < len(sortedElements); i++ {
		for j := i + 1; j < len(sortedElements); j++ {
			depth1 := sortedElements[i].z + sortedElements[i].depth
			depth2 := sortedElements[j].z + sortedElements[j].depth
			if depth1 > depth2 {
				sortedElements[i], sortedElements[j] = sortedElements[j], sortedElements[i]
			}
		}
	}
	
	// 各要素を描画
	for _, elem := range sortedElements {
		drawPixelElement(roomX, roomY, elem)
	}
}

func drawPixelElement(roomX, roomY float64, elem RoomElement) {
	switch elem.elementType {
	case "desk", "table", "low_table", "tv_stand", "side_table":
		drawPixelFurniture(roomX, roomY, elem, true)
		
	case "chair", "office_chair", "gaming_chair", "luxury_chair":
		drawPixelChair(roomX, roomY, elem)
		
	case "sofa":
		drawPixelSofa(roomX, roomY, elem)
		
	case "monitor", "tv":
		drawPixelScreen(roomX, roomY, elem)
		
	case "bookshelf", "shelf", "drawer", "cabinet", "wine_rack":
		drawPixelStorage(roomX, roomY, elem)
		
	case "plant":
		drawPixelPlant(roomX, roomY, elem)
		
	case "pet", "plushie":
		drawPixelCreature(roomX, roomY, elem)
		
	case "cushion", "floor_cushion":
		drawPixelCushion(roomX, roomY, elem)
		
	case "window":
		drawPixelWindow(roomX, roomY, elem)
		
	case "painting", "photo", "poster", "abstract_art", "expensive_art":
		drawPixelFrame(roomX, roomY, elem)
		
	case "lamp", "floor_lamp":
		drawPixelLamp(roomX, roomY, elem)
		
	case "clock":
		drawPixelClock(roomX, roomY, elem)
		
	case "keyboard", "mouse", "speaker":
		drawPixelTech(roomX, roomY, elem)
		
	case "guitar":
		drawPixelGuitar(roomX, roomY, elem)
		
	case "mirror":
		drawPixelMirror(roomX, roomY, elem)
		
	case "rug":
		drawPixelRug(roomX, roomY, elem)
		
	case "vase", "candle", "trophy", "diamond":
		drawPixelDecoration(roomX, roomY, elem)
		
	case "easel", "canvas_rack":
		drawPixelArtSupply(roomX, roomY, elem)
		
	case "curtain":
		drawPixelCurtain(roomX, roomY, elem)
		
	case "telescope", "fan":
		drawPixelAppliance(roomX, roomY, elem)
		
	default:
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z, elem.width, elem.height, elem.depth, elem.color)
	}
}

func drawPixelFurniture(roomX, roomY float64, elem RoomElement, hasLegs bool) {
	// 天板
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.8, elem.z, 
		elem.width, elem.height*0.2, elem.depth, elem.color)
	
	if hasLegs {
		// 脚
		positions := [][2]float64{
			{elem.x + 3, elem.z + 3},
			{elem.x + elem.width - 6, elem.z + 3},
			{elem.x + 3, elem.z + elem.depth - 6},
			{elem.x + elem.width - 6, elem.z + elem.depth - 6},
		}
		
		for _, pos := range positions {
			drawPixelBox(roomX, roomY, pos[0], elem.y, pos[1], 3, elem.height*0.8, 3, "furniture_sub")
		}
	}
}

func drawPixelChair(roomX, roomY float64, elem RoomElement) {
	// 座面
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.5, elem.z,
		elem.width, elem.height*0.1, elem.depth, elem.color)
	
	// 背もたれ
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.5, elem.z,
		elem.width, elem.height*0.5, elem.depth*0.2, elem.color)
	
	// アームレスト（オフィスチェアの場合）
	if elem.elementType == "office_chair" || elem.elementType == "gaming_chair" {
		drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.6, elem.z,
			elem.width*0.1, elem.height*0.1, elem.depth*0.8, elem.color)
		drawPixelBox(roomX, roomY, elem.x+elem.width*0.9, elem.y+elem.height*0.6, elem.z,
			elem.width*0.1, elem.height*0.1, elem.depth*0.8, elem.color)
	}
	
	// 脚
	positions := [][2]float64{
		{elem.x + 2, elem.z + 2},
		{elem.x + elem.width - 4, elem.z + 2},
		{elem.x + 2, elem.z + elem.depth - 4},
		{elem.x + elem.width - 4, elem.z + elem.depth - 4},
	}
	
	for _, pos := range positions {
		drawPixelBox(roomX, roomY, pos[0], elem.y, pos[1], 2, elem.height*0.5, 2, "furniture_sub")
	}
}

func drawPixelSofa(roomX, roomY float64, elem RoomElement) {
	// ソファ本体
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.6, elem.depth, elem.color)
	
	// 背もたれ
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.6, elem.z,
		elem.width, elem.height*0.4, elem.depth*0.3, elem.color)
	
	// アームレスト
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.3, elem.z,
		elem.width*0.12, elem.height*0.3, elem.depth, elem.color)
	
	drawPixelBox(roomX, roomY, elem.x+elem.width*0.88, elem.y+elem.height*0.3, elem.z,
		elem.width*0.12, elem.height*0.3, elem.depth, elem.color)
}

func drawPixelScreen(roomX, roomY float64, elem RoomElement) {
	// 画面枠
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// スクリーン
	drawPixelBox(roomX, roomY, elem.x+2, elem.y+2, elem.z+1,
		elem.width-4, elem.height-4, 1, "screen")
	
	// スタンド（モニターの場合）
	if elem.elementType == "monitor" {
		drawPixelBox(roomX, roomY, elem.x+elem.width/2-4, elem.y-8, elem.z+elem.depth/2-2,
			8, 8, 4, "furniture_sub")
	}
}

func drawPixelStorage(roomX, roomY float64, elem RoomElement) {
	// 本体
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// 棚板や引き出しの詳細
	if elem.elementType == "bookshelf" || elem.elementType == "shelf" {
		// 棚板
		for i := 1; i < 4; i++ {
			drawPixelBox(roomX, roomY, elem.x+1, elem.y+float64(i)*elem.height/4, elem.z+1,
				elem.width-2, 2, elem.depth-2, "furniture_sub")
		}
		
		// 本
		for shelf := 0; shelf < 3; shelf++ {
			for book := 0; book < int(elem.width/8); book++ {
				if rand.Float64() > 0.3 {
					bookHeight := 8 + rand.Float64()*6
					bookColor := []string{"book", "decoration", "furniture_accent"}[rand.Intn(3)]
					drawPixelBox(roomX, roomY,
						elem.x+3+float64(book)*7,
						elem.y+float64(shelf+1)*elem.height/4+2,
						elem.z+2,
						5, bookHeight, elem.depth-4, bookColor)
				}
			}
		}
	} else if elem.elementType == "drawer" {
		// 引き出しのハンドル
		for i := 0; i < 3; i++ {
			drawPixelBox(roomX, roomY, elem.x+elem.width/2-3, elem.y+float64(i+1)*elem.height/4, elem.z+elem.depth,
				6, 2, 2, "furniture_sub")
		}
	}
}

func drawPixelPlant(roomX, roomY float64, elem RoomElement) {
	// 鉢
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.25, elem.depth, "furniture_sub")
	
	// 幹
	stemX := elem.x + elem.width/2 - 2
	stemZ := elem.z + elem.depth/2 - 2
	drawPixelBox(roomX, roomY, stemX, elem.y+elem.height*0.25, stemZ,
		4, elem.height*0.4, 4, "furniture_sub")
	
	// 葉っぱ
	for i := 0; i < 5; i++ {
		angle := float64(i) * 72 * math.Pi / 180
		leafX := elem.x + elem.width/2 + math.Cos(angle)*10
		leafZ := elem.z + elem.depth/2 + math.Sin(angle)*10
		leafY := elem.y + elem.height*0.5 + rand.Float64()*elem.height*0.3
		
		drawPixelBox(roomX, roomY, leafX-4, leafY, leafZ-4, 8, 6, 8, "plant")
	}
}

func drawPixelCreature(roomX, roomY float64, elem RoomElement) {
	if elem.elementType == "pet" {
		// ペット（猫）
		// 体
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height*0.6, elem.depth, elem.color)
		
		// 頭
		drawPixelBox(roomX, roomY, elem.x-2, elem.y+elem.height*0.5, elem.z+2,
			elem.width*0.6, elem.height*0.4, elem.depth*0.6, elem.color)
		
		// 耳
		drawPixelBox(roomX, roomY, elem.x-1, elem.y+elem.height*0.8, elem.z+3,
			3, 4, 3, elem.color)
		drawPixelBox(roomX, roomY, elem.x+5, elem.y+elem.height*0.8, elem.z+3,
			3, 4, 3, elem.color)
		
		// 尻尾
		drawPixelBox(roomX, roomY, elem.x+elem.width, elem.y+elem.height*0.3, elem.z+elem.depth/2,
			8, 2, 2, elem.color)
	} else {
		// ぬいぐるみ
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height, elem.depth, elem.color)
	}
}

func drawPixelCushion(roomX, roomY float64, elem RoomElement) {
	// 丸みを帯びたクッション
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

func drawPixelWindow(roomX, roomY float64, elem RoomElement) {
	// 窓枠
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, "frame")
	
	// ガラス
	drawPixelBox(roomX, roomY, elem.x+1, elem.y+2, elem.z+2,
		elem.width-2, elem.height-4, elem.depth-4, "window")
	
	// 窓の十字枠
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height/2-1, elem.z,
		elem.width, 2, elem.depth, "frame")
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z+elem.depth/2-1,
		elem.width, elem.height, 2, "frame")
}

func drawPixelFrame(roomX, roomY float64, elem RoomElement) {
	// 額縁
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// 中身
	if elem.elementType == "painting" || elem.elementType == "abstract_art" {
		// 抽象的なアート
		for i := 0; i < 3; i++ {
			for j := 0; j < 3; j++ {
				if rand.Float64() > 0.4 {
					drawPixelBox(roomX, roomY,
						elem.x+2+float64(i)*(elem.width-4)/3,
						elem.y+2+float64(j)*(elem.height-4)/3,
						elem.z+1,
						(elem.width-6)/3, (elem.height-6)/3, 1, "pixel_accent")
				}
			}
		}
	} else if elem.elementType == "photo" {
		// 写真
		drawPixelBox(roomX, roomY, elem.x+2, elem.y+2, elem.z+1,
			elem.width-4, elem.height-4, 1, "paper")
	} else if elem.elementType == "poster" {
		// ポスター
		drawPixelBox(roomX, roomY, elem.x+1, elem.y+1, elem.z+1,
			elem.width-2, elem.height-2, 1, "poster")
	}
}

func drawPixelLamp(roomX, roomY float64, elem RoomElement) {
	// ランプベース
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.15, elem.depth, elem.color)
	
	// ポール
	poleX := elem.x + elem.width/2 - 2
	poleZ := elem.z + elem.depth/2 - 2
	drawPixelBox(roomX, roomY, poleX, elem.y+elem.height*0.15, poleZ,
		4, elem.height*0.6, 4, "furniture_sub")
	
	// シェード
	shadeY := elem.y + elem.height*0.7
	drawPixelBox(roomX, roomY, elem.x-2, shadeY, elem.z-2,
		elem.width+4, elem.height*0.3, elem.depth+4, "light")
}

func drawPixelClock(roomX, roomY float64, elem RoomElement) {
	// 時計本体
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// 文字盤
	drawPixelBox(roomX, roomY, elem.x+2, elem.y+2, elem.z+1,
		elem.width-4, elem.height-4, 1, "paper")
	
	// 針（簡略化）
	drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y+elem.height/2, elem.z+2,
		2, elem.height/3, 1, "furniture_sub")
}

func drawPixelTech(roomX, roomY float64, elem RoomElement) {
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

func drawPixelGuitar(roomX, roomY float64, elem RoomElement) {
	// ボディ
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.4, elem.depth, elem.color)
	
	// ネック
	neckX := elem.x + elem.width/2 - 2
	drawPixelBox(roomX, roomY, neckX, elem.y+elem.height*0.4, elem.z+elem.depth/2-1,
		4, elem.height*0.6, 2, "furniture_sub")
}

func drawPixelMirror(roomX, roomY float64, elem RoomElement) {
	// 枠
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, "frame")
	
	// 鏡面
	drawPixelBox(roomX, roomY, elem.x+2, elem.y+2, elem.z+1,
		elem.width-4, elem.height-4, 1, "mirror")
}

func drawPixelRug(roomX, roomY float64, elem RoomElement) {
	// 薄いラグ
	rugColor := palette[elem.color]
	for x := 0.0; x < elem.width; x += PIXEL_SIZE {
		for z := 0.0; z < elem.depth; z += PIXEL_SIZE {
			// パターンを追加
			if int((x+z)/PIXEL_SIZE)%3 == 0 {
				p.Fill(rugColor[0]*0.9, rugColor[1]*0.9, rugColor[2]*0.9, 255)
			} else {
				p.Fill(rugColor[0], rugColor[1], rugColor[2], 255)
			}
			isoX, isoY := toIsometric(elem.x+x, elem.y, elem.z+z)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
}

func drawPixelDecoration(roomX, roomY float64, elem RoomElement) {
	if elem.elementType == "vase" {
		// 花瓶
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height*0.7, elem.depth, elem.color)
		// 花
		drawPixelBox(roomX, roomY, elem.x+1, elem.y+elem.height*0.7, elem.z+1,
			elem.width-2, elem.height*0.3, elem.depth-2, "pixel_accent")
	} else if elem.elementType == "candle" {
		// キャンドル
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height, elem.depth, elem.color)
		// 炎
		drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y+elem.height, elem.z+elem.depth/2-1,
			2, 3, 2, "glow")
	} else if elem.elementType == "trophy" {
		// トロフィー
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height*0.2, elem.depth, "furniture_sub")
		drawPixelBox(roomX, roomY, elem.x+1, elem.y+elem.height*0.2, elem.z+1,
			elem.width-2, elem.height*0.8, elem.depth-2, elem.color)
	} else if elem.elementType == "diamond" {
		// ダイヤモンド
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height, elem.depth, elem.color)
	}
}

func drawPixelArtSupply(roomX, roomY float64, elem RoomElement) {
	if elem.elementType == "easel" {
		// イーゼルの脚
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			2, elem.height, 2, elem.color)
		drawPixelBox(roomX, roomY, elem.x+elem.width-2, elem.y, elem.z,
			2, elem.height, 2, elem.color)
		drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y, elem.z+elem.depth-2,
			2, elem.height*0.8, 2, elem.color)
		
		// キャンバス
		drawPixelBox(roomX, roomY, elem.x+2, elem.y+elem.height*0.5, elem.z+2,
			elem.width-4, elem.height*0.4, 2, "paper")
	} else {
		// キャンバスラック
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height, elem.depth, elem.color)
	}
}

func drawPixelCurtain(roomX, roomY float64, elem RoomElement) {
	// カーテンの波打ち
	for x := 0.0; x < elem.width; x += PIXEL_SIZE {
		waveOffset := math.Sin(x/10) * 2
		drawPixelBox(roomX, roomY, elem.x+x, elem.y, elem.z+waveOffset,
			PIXEL_SIZE, elem.height, elem.depth, elem.color)
	}
}

func drawPixelAppliance(roomX, roomY float64, elem RoomElement) {
	if elem.elementType == "telescope" {
		// 三脚
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			2, elem.height*0.7, 2, "furniture_sub")
		drawPixelBox(roomX, roomY, elem.x+elem.width-2, elem.y, elem.z,
			2, elem.height*0.7, 2, "furniture_sub")
		drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y, elem.z+elem.depth-2,
			2, elem.height*0.7, 2, "furniture_sub")
		
		// 望遠鏡本体
		drawPixelBox(roomX, roomY, elem.x+1, elem.y+elem.height*0.6, elem.z+1,
			elem.width-2, elem.height*0.4, elem.depth-2, elem.color)
	} else if elem.elementType == "fan" {
		// 扇風機
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
			elem.width, elem.height*0.2, elem.depth, "furniture_sub")
		drawPixelBox(roomX, roomY, elem.x+elem.width/2-2, elem.y+elem.height*0.2, elem.z+elem.depth/2-2,
			4, elem.height*0.6, 4, "furniture_sub")
		drawPixelBox(roomX, roomY, elem.x-2, elem.y+elem.height*0.7, elem.z-2,
			elem.width+4, elem.height*0.3, elem.depth+4, elem.color)
	}
}

func drawPixelBox(roomX, roomY, x, y, z, width, height, depth float64, colorKey string) {
	color := palette[colorKey]
	
	// 上面（最も明るい）
	p.Fill(color[0], color[1], color[2], 255)
	for px := 0.0; px < width; px += PIXEL_SIZE {
		for pz := 0.0; pz < depth; pz += PIXEL_SIZE {
			isoX, isoY := toIsometric(x+px, y+height, z+pz)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY-ROOM_HEIGHT, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// 前面（少し暗い）
	p.Fill(color[0]*0.85, color[1]*0.85, color[2]*0.85, 255)
	for px := 0.0; px < width; px += PIXEL_SIZE {
		for py := 0.0; py < height; py += PIXEL_SIZE {
			isoX, isoY := toIsometric(x+px, y+py, z+depth)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY-ROOM_HEIGHT, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// 右面（最も暗い）
	p.Fill(color[0]*0.7, color[1]*0.7, color[2]*0.7, 255)
	for pz := 0.0; pz < depth; pz += PIXEL_SIZE {
		for py := 0.0; py < height; py += PIXEL_SIZE {
			isoX, isoY := toIsometric(x+width, y+py, z+pz)
			p.Rect(roomX+isoX-ROOM_WIDTH/2, roomY+isoY-ROOM_HEIGHT, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
}

func toIsometric(x, y, z float64) (float64, float64) {
	isoX := (x - z) * 0.866
	isoY := (x + z) * 0.5 - y
	return isoX, isoY
}

func updateAndDrawPixelEffects() {
	// キラキラエフェクトの更新と描画
	for i := range pixelEffects {
		pixelEffects[i].life -= 0.01
		
		if pixelEffects[i].life <= 0 {
			pixelEffects[i] = PixelEffect{
				x:     rand.Float64() * CANVAS_WIDTH,
				y:     rand.Float64() * CANVAS_HEIGHT,
				color: palette["pixel_accent"],
				life:  1.0,
			}
		}
		
		// エフェクトを描画
		alpha := pixelEffects[i].life * 255
		color := pixelEffects[i].color
		p.Fill(color[0], color[1], color[2], alpha)
		
		// キラキラ形状
		p.Rect(pixelEffects[i].x, pixelEffects[i].y, PIXEL_SIZE, PIXEL_SIZE)
		if pixelEffects[i].life > 0.5 {
			p.Rect(pixelEffects[i].x-PIXEL_SIZE, pixelEffects[i].y, PIXEL_SIZE, PIXEL_SIZE)
			p.Rect(pixelEffects[i].x+PIXEL_SIZE, pixelEffects[i].y, PIXEL_SIZE, PIXEL_SIZE)
			p.Rect(pixelEffects[i].x, pixelEffects[i].y-PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
			p.Rect(pixelEffects[i].x, pixelEffects[i].y+PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
}

func drawUI() {
	// UI背景
	p.Fill(255, 255, 255, 240)
	for px := 10.0; px < 190; px += PIXEL_SIZE {
		for py := 10.0; py < 90; py += PIXEL_SIZE {
			p.Rect(px, py, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// UIフレーム
	frameColor := palette["furniture_accent"]
	p.Fill(frameColor[0], frameColor[1], frameColor[2], 255)
	for px := 10.0; px < 190; px += PIXEL_SIZE {
		p.Rect(px, 10, PIXEL_SIZE, PIXEL_SIZE)
		p.Rect(px, 86, PIXEL_SIZE, PIXEL_SIZE)
	}
	for py := 10.0; py < 90; py += PIXEL_SIZE {
		p.Rect(10, py, PIXEL_SIZE, PIXEL_SIZE)
		p.Rect(186, py, PIXEL_SIZE, PIXEL_SIZE)
	}
	
	// テキスト
	p.Fill(60, 60, 80, 255)
	p.TextSize(14)
	p.Text(fmt.Sprintf("Type: %s", mbtiType), 20, 35)
	
	// MBTIアイコン
	y := 45.0
	traits := []struct {
		condition bool
		trueChar  string
		falseChar string
		x         float64
	}{
		{isExtrovert, "E", "I", 20},
		{isSensing, "S", "N", 50},
		{isThinking, "T", "F", 80},
		{isJudging, "J", "P", 110},
	}
	
	for _, trait := range traits {
		char := trait.falseChar
		if trait.condition {
			char = trait.trueChar
		}
		
		// 特性ボックス
		boxColor := palette["pixel_accent"]
		p.Fill(boxColor[0], boxColor[1], boxColor[2], 255)
		for px := 0.0; px < 20; px += PIXEL_SIZE {
			for py := 0.0; py < 12; py += PIXEL_SIZE {
				p.Rect(trait.x+px, y+py, PIXEL_SIZE, PIXEL_SIZE)
			}
		}
		
		// 文字
		p.Fill(255, 255, 255, 255)
		p.TextSize(10)
		p.Text(char, trait.x+6, y+9)
	}
	
	// 財産バー
	p.Fill(60, 60, 80, 255)
	p.TextSize(12)
	p.Text(fmt.Sprintf("Wealth: %d%%", wealthLevel), 20, 70)
	
	// バー背景
	p.Fill(200, 200, 200, 255)
	for px := 90.0; px < 170; px += PIXEL_SIZE {
		for py := 62.0; py < 70; py += PIXEL_SIZE {
			p.Rect(px, py, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// バー本体
	wealthColor := palette["luxury"]
	p.Fill(wealthColor[0], wealthColor[1], wealthColor[2], 255)
	barWidth := float64(wealthLevel) * 0.8
	for px := 90.0; px < 90+barWidth && px < 170; px += PIXEL_SIZE {
		for py := 62.0; py < 70; py += PIXEL_SIZE {
			p.Rect(px, py, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
}