package main

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/ryomak/p5go"
)

var (
	p          *p5go.Canvas
	gameMode   int
	frameCount int
	pixelSize  = 4 // ドット絵のピクセルサイズ

	// 捕獲シーン変数
	wildMonster     Monster
	captureState    string // "encounter", "throwing", "shaking", "success", "failed", "gameover"
	selectedAction  int
	pokeball        Pokeball
	particles       []Particle
	shakeOffset     float64
	textAnimation   TextAnimation
	captureAttempts int
	selectedBall    int // 選択中のボールタイプ
	maxAttempts     = 3 // 最大試行回数

	// 背景変数
	backgroundPixels [][]int
	grassPixels      [][]int
	backgroundType   int // 0: 草原, 1: 森, 2: 山, 3: 海辺, 4: 洞窟, 5: 火山, 6: 雪原, 7: 砂漠
	animatedObjects  []AnimatedObject
	weatherParticles []WeatherParticle
	weatherType      int // 0: なし, 1: 雨, 2: 雪, 3: 落ち葉, 4: 砂嵐
)

type Monster struct {
	name        string
	monsterType int
	x, y        float64
	hp, maxHP   int
	animOffset  float64
	color       struct{ r, g, b uint8 }
	catchRate   float64 // 0.0 から 1.0
	level       int
	rarity      int     // 1-5 stars
	hasHat      bool    // レア度の表示用
	isShiny     bool    // 色違い
	accessory   string  // "none", "crown", "scarf", "glasses", "bowtie", "cape"
	size        string  // "XS", "S", "M", "L", "XL"
	sizeValue   float64 // 0.5 to 1.5 for actual size multiplier
}

type Pokeball struct {
	x, y       float64
	vx, vy     float64
	rotation   float64
	state      string // "待機", "投げる", "開く", "揺れる", "捕獲"
	shakeCount int
	shakeTimer int
	trailX     []float64
	trailY     []float64
	ballType   int // 0: モンスターボール, 1: スーパーボール, 2: ハイパーボール, 3: マスターボール
}

type AnimatedObject struct {
	x, y      float64
	animType  string
	animFrame int
	speed     float64
}

type WeatherParticle struct {
	x, y   float64
	vx, vy float64
	life   float64
	size   float64
}

type Particle struct {
	x, y         float64
	vx, vy       float64
	life         float64
	color        struct{ r, g, b, a uint8 }
	size         float64
	particleType string
}

type TextAnimation struct {
	text     string
	x, y     float64
	progress float64
	fadeOut  bool
	color    struct{ r, g, b uint8 }
}

type color struct {
	r, g, b uint8
}

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
		p5go.MousePressed(mousePressed),
	)
	select {}
}

func setup(canvas *p5go.Canvas) {
	p = canvas
	p.CreateCanvas(400, 400)
	p.FrameRate(60) // 60FPSでアニメーションを滑らかに

	initBattleScene()
}

func draw(canvas *p5go.Canvas) {
	p = canvas
	frameCount++

	drawBattleScene()
}

func mousePressed(canvas *p5go.Canvas) {
	p = canvas

	if captureState == "encounter" || captureState == "failed" {
		// ランダムにボールを選択して投げる
		throwPokeball()
	} else if captureState == "gameover" {
		// ゲームオーバー時はリセット
		initBattleScene()
	}
}

func initBattleScene() {
	// ポケモン風の名前
	monsterNames := []string{"ヒトカゲ", "ゼニガメ", "フシギダネ", "ピカチュウ", "ミュウツー"}
	monsterColors := []struct{ r, g, b uint8 }{
		{255, 100, 50},  // ほのお - 赤/オレンジ
		{50, 150, 255},  // みず - 青
		{100, 255, 100}, // くさ - 緑
		{255, 255, 50},  // でんき - 黄色
		{200, 100, 255}, // エスパー - 紫
	}
	catchRates := []float64{0.3, 0.4, 0.5, 0.35, 0.25}

	monsterType := rand.Intn(5)

	// レアリティを決定（1-5星）
	rarityRoll := rand.Float64()
	rarity := 1
	if rarityRoll < 0.02 {
		rarity = 5 // ★★★★★ (2%)
	} else if rarityRoll < 0.08 {
		rarity = 4 // ★★★★ (6%)
	} else if rarityRoll < 0.20 {
		rarity = 3 // ★★★ (12%)
	} else if rarityRoll < 0.45 {
		rarity = 2 // ★★ (25%)
	} else {
		rarity = 1 // ★ (55%)
	}

	// レベルを決定
	level := rand.Intn(50) + 1 + rarity*10 // レア度が高いほどレベルも高い

	// 色違い判定 (1/100の確率)
	isShiny := rand.Float64() < 0.01

	// サイズを決定
	sizeRoll := rand.Float64()
	var size string
	var sizeValue float64
	if sizeRoll < 0.05 {
		size = "XS"
		sizeValue = 0.5 + rand.Float64()*0.2 // 0.5-0.7
	} else if sizeRoll < 0.20 {
		size = "S"
		sizeValue = 0.7 + rand.Float64()*0.2 // 0.7-0.9
	} else if sizeRoll < 0.60 {
		size = "M"
		sizeValue = 0.9 + rand.Float64()*0.2 // 0.9-1.1
	} else if sizeRoll < 0.85 {
		size = "L"
		sizeValue = 1.1 + rand.Float64()*0.2 // 1.1-1.3
	} else {
		size = "XL"
		sizeValue = 1.3 + rand.Float64()*0.2 // 1.3-1.5
	}

	// 帽子判定 (レア度3以上で確率)
	hasHat := rarity >= 3 || (rarity == 2 && rand.Float64() < 0.3)

	// アクセサリー決定
	accessory := "none"
	accessories := []string{"none", "crown", "scarf", "glasses", "bowtie", "cape"}
	// レア度が高いほど良いアクセサリー
	if rarity == 5 {
		accessory = "crown" // ★5は必ず王冠
	} else if rarity == 4 {
		accessory = accessories[rand.Intn(2)+4] // cape or bowtie
	} else if rarity == 3 {
		if rand.Float64() < 0.7 {
			accessory = accessories[rand.Intn(2)+2] // glasses or scarf
		}
	} else if rarity == 2 {
		if rand.Float64() < 0.3 {
			accessory = "scarf"
		}
	}

	// 色を決定（色違いの場合は変更）
	monsterColor := monsterColors[monsterType]
	if isShiny {
		// 色違いは特別な色に
		switch monsterType {
		case 0: // 火タイプは青色に
			monsterColor = struct{ r, g, b uint8 }{50, 100, 255}
		case 1: // 水タイプは赤色に
			monsterColor = struct{ r, g, b uint8 }{255, 50, 50}
		case 2: // 草タイプは金色に
			monsterColor = struct{ r, g, b uint8 }{255, 215, 0}
		case 3: // 電気タイプは黒色に
			monsterColor = struct{ r, g, b uint8 }{50, 50, 50}
		case 4: // エスパータイプは白色に
			monsterColor = struct{ r, g, b uint8 }{255, 255, 255}
		}
	}

	// サイズによる捕獲率調整（大きいほど捕まえにくい）
	sizeCatchModifier := 2.0 - sizeValue // XS(1.5～1.3) to XL(0.7～0.5)

	wildMonster = Monster{
		name:        monsterNames[monsterType],
		monsterType: monsterType,
		x:           200,
		y:           150,
		hp:          100,
		maxHP:       100,
		color:       monsterColor,
		catchRate:   (catchRates[monsterType] - float64(rarity-1)*0.15) * sizeCatchModifier, // レア度とサイズが捕獲率に影響
		level:       level,
		rarity:      rarity,
		hasHat:      hasHat,
		isShiny:     isShiny,
		accessory:   accessory,
		size:        size,
		sizeValue:   sizeValue,
	}

	// モンスターボール初期化
	pokeball = Pokeball{
		x:     200,
		y:     350,
		state: "idle",
	}

	captureState = "encounter"
	captureAttempts = 0
	selectedAction = 0
	selectedBall = 0
	particles = make([]Particle, 0)

	// 背景初期化
	initBackground()
}

func initBackground() {
	// ランダムに背景タイプを選択
	backgroundType = rand.Intn(8)

	// ピクセルアート背景作成 (400x400キャンバス用100x100グリッド)
	backgroundPixels = make([][]int, 100)
	grassPixels = make([][]int, 100)

	for i := range backgroundPixels {
		backgroundPixels[i] = make([]int, 100)
		grassPixels[i] = make([]int, 100)
	}

	// 背景タイプに応じて生成
	switch backgroundType {
	case 0: // 草原
		generateGrassland()
	case 1: // 森
		generateForest()
	case 2: // 山
		generateMountain()
	case 3: // 海辺
		generateBeach()
	case 4: // 洞窟
		generateCave()
	case 5: // 火山
		generateVolcano()
	case 6: // 雪原
		generateSnowfield()
	case 7: // 砂漠
		generateDesert()
	}

	// 天候エフェクトを設定
	switch backgroundType {
	case 1: // 森は落ち葉
		weatherType = 3
	case 4: // 洞窟は何もなし
		weatherType = 0
	case 6: // 雪原は雪
		weatherType = 2
	case 7: // 砂漠は砂嵐
		weatherType = 4
	default:
		// その他はランダム
		if rand.Float64() < 0.3 {
			weatherType = rand.Intn(3) + 1
		} else {
			weatherType = 0
		}
	}

	// 天候パーティクル初期化
	weatherParticles = make([]WeatherParticle, 0)
	if weatherType > 0 {
		for i := 0; i < 50; i++ {
			weatherParticles = append(weatherParticles, WeatherParticle{
				x:    rand.Float64() * 400,
				y:    rand.Float64() * 400,
				vx:   rand.Float64()*2 - 1,
				vy:   rand.Float64()*2 + 1,
				life: 1.0,
				size: rand.Float64()*3 + 1,
			})
		}
	}
}

func generateGrassland() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 50 {
				// 空
				if i < 20 {
					backgroundPixels[i][j] = 1 // 薄い青
				} else if i < 35 {
					backgroundPixels[i][j] = 2 // 中間の青
				} else {
					backgroundPixels[i][j] = 3 // 濃い青
				}
				// 雲
				if i > 10 && i < 30 && ((j+i)%20 < 3) {
					backgroundPixels[i][j] = 4
				}
			} else {
				// 地面
				backgroundPixels[i][j] = 5
				// 草
				if rand.Float64() < 0.3 {
					grassPixels[i][j] = 1
				} else if rand.Float64() < 0.1 {
					grassPixels[i][j] = 2 // 花
				}
			}
		}
	}
}

func generateForest() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 40 {
				// 暗い空
				backgroundPixels[i][j] = 6 // 暗い緑
			} else {
				// 森の地面
				backgroundPixels[i][j] = 7
				// 木
				if rand.Float64() < 0.2 && i < 70 {
					grassPixels[i][j] = 3 // 木
				}
			}
		}
	}
}

func generateMountain() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 30 {
				// 空
				backgroundPixels[i][j] = 1
			} else if i < 60 {
				// 山
				if abs(j-50) < (60 - i) {
					backgroundPixels[i][j] = 8 // 岩
				} else {
					backgroundPixels[i][j] = 3
				}
			} else {
				// 地面
				backgroundPixels[i][j] = 8
			}
		}
	}
}

func generateBeach() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 40 {
				// 空
				backgroundPixels[i][j] = 1
			} else if i < 70 {
				// 海
				if (i+j)%5 < 2 {
					backgroundPixels[i][j] = 9 // 波
				} else {
					backgroundPixels[i][j] = 10 // 海
				}
			} else {
				// 砂浜
				backgroundPixels[i][j] = 11
			}
		}
	}
}

func generateCave() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			// 洞窟内部
			if rand.Float64() < 0.1 {
				backgroundPixels[i][j] = 12 // 暗い部分
			} else {
				backgroundPixels[i][j] = 13 // 岩壁
			}
			// 鍾乳石
			if i < 20 && rand.Float64() < 0.05 {
				grassPixels[i][j] = 4
			}
		}
	}
}

func generateVolcano() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 30 {
				// 赤い空
				backgroundPixels[i][j] = 14
			} else if i < 60 {
				// 火山
				if rand.Float64() < 0.1 {
					backgroundPixels[i][j] = 15 // 溶岩
				} else {
					backgroundPixels[i][j] = 16 // 火山岩
				}
			} else {
				// 焼けた地面
				backgroundPixels[i][j] = 16
			}
		}
	}
}

func generateSnowfield() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 40 {
				// 白い空
				backgroundPixels[i][j] = 17
			} else {
				// 雪の地面
				backgroundPixels[i][j] = 18
				// 雪だるまや氷
				if rand.Float64() < 0.05 {
					grassPixels[i][j] = 5
				}
			}
		}
	}
}

func generateDesert() {
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			if i < 40 {
				// 黄色い空
				backgroundPixels[i][j] = 19
			} else {
				// 砂
				if (i+j)%7 < 2 {
					backgroundPixels[i][j] = 20 // 砂の模様
				} else {
					backgroundPixels[i][j] = 21 // 砂
				}
				// サボテン
				if rand.Float64() < 0.02 && i < 80 {
					grassPixels[i][j] = 6
				}
			}
		}
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func drawBattleScene() {
	// ピクセルアート背景を描画
	drawPixelBackground()

	// 天候エフェクトを描画
	drawWeatherEffects()

	// アニメーションを更新
	updateAnimations()

	// パーティクルを更新して描画
	updateParticles()

	// 野生のモンスターを描画
	if captureState != "shaking" {
		// 揺れ中は非表示、成功時とその他は表示
		drawMonster(wildMonster)
	}

	// モンスターボールを描画
	drawPokeball()

	// UIを描画
	drawCaptureUI()

	// テキストアニメーションを描画
	if textAnimation.text != "" {
		drawTextAnimation()
	}
}

func drawPixelBackground() {
	// 背景ピクセルを描画
	for i := 0; i < 100; i++ {
		for j := 0; j < 100; j++ {
			pixel := backgroundPixels[i][j]
			x := float64(j * pixelSize)
			y := float64(i * pixelSize)

			switch pixel {
			case 1: // 薄い青空
				p.Fill(150, 200, 255, 255)
			case 2: // 中間の青空
				p.Fill(120, 180, 240, 255)
			case 3: // 濃い青空
				p.Fill(100, 160, 220, 255)
			case 4: // 雲
				p.Fill(255, 255, 255, 200)
			case 5: // 地面（草原）
				p.Fill(120, 180, 80, 255)
			case 6: // 暗い緑（森の空）
				p.Fill(40, 80, 60, 255)
			case 7: // 森の地面
				p.Fill(60, 100, 40, 255)
			case 8: // 岩（山）
				p.Fill(120, 120, 140, 255)
			case 9: // 波
				p.Fill(100, 200, 255, 255)
			case 10: // 海
				p.Fill(50, 150, 220, 255)
			case 11: // 砂浜
				p.Fill(255, 230, 150, 255)
			case 12: // 洞窟暗い部分
				p.Fill(30, 30, 40, 255)
			case 13: // 洞窟岩壁
				p.Fill(80, 70, 90, 255)
			case 14: // 赤い空（火山）
				p.Fill(200, 80, 60, 255)
			case 15: // 溶岩
				p.Fill(255, 100, 0, 255)
			case 16: // 火山岩
				p.Fill(60, 40, 30, 255)
			case 17: // 白い空（雪原）
				p.Fill(230, 240, 255, 255)
			case 18: // 雪
				p.Fill(255, 255, 255, 255)
			case 19: // 黄色い空（砂漠）
				p.Fill(255, 220, 150, 255)
			case 20: // 砂の模様
				p.Fill(230, 200, 100, 255)
			case 21: // 砂
				p.Fill(255, 220, 130, 255)
			}

			p.NoStroke()
			p.Rect(x, y, float64(pixelSize), float64(pixelSize))

			// 草やオブジェクトを上に描画
			grass := grassPixels[i][j]
			switch grass {
			case 1: // 草
				p.Fill(80, 150, 60, 255)
				p.Rect(x, y-float64(pixelSize), float64(pixelSize), float64(pixelSize))
			case 2: // 花
				p.Fill(255, 100, 150, 255)
				p.Rect(x, y-float64(pixelSize), float64(pixelSize), float64(pixelSize))
			case 3: // 木（森）
				p.Fill(40, 120, 40, 255)
				p.Rect(x, y-float64(pixelSize)*2, float64(pixelSize), float64(pixelSize)*3)
			case 4: // 鍾乳石
				p.Fill(150, 150, 180, 255)
				p.Rect(x, y, float64(pixelSize), float64(pixelSize)*2)
			case 5: // 雪だるま/氷
				p.Fill(200, 220, 255, 255)
				p.Ellipse(x+float64(pixelSize)/2, y, float64(pixelSize), float64(pixelSize))
			case 6: // サボテン
				p.Fill(50, 150, 50, 255)
				p.Rect(x, y-float64(pixelSize)*2, float64(pixelSize), float64(pixelSize)*3)
				p.Rect(x-float64(pixelSize), y-float64(pixelSize), float64(pixelSize), float64(pixelSize))
			}
		}
	}

	// パス/バトルエリアをパターンで描画
	for i := 60; i < 80; i++ {
		for j := 30; j < 70; j++ {
			// チェッカーパターン
			if (i+j)%2 == 0 {
				p.Fill(200, 180, 140, 255)
			} else {
				p.Fill(180, 160, 120, 255)
			}
			p.NoStroke()
			p.Rect(float64(j*pixelSize), float64(i*pixelSize), float64(pixelSize), float64(pixelSize))
		}
	}
}

func drawPokeball() {
	if pokeball.state == "idle" || pokeball.state == "" {
		return
	}

	ps := float64(pixelSize)
	x := pokeball.x
	y := pokeball.y

	// Pokeball pixel art (7x7)
	ballPixels := [][]int{
		{0, 2, 2, 2, 2, 2, 0},
		{2, 1, 1, 1, 1, 1, 2},
		{2, 1, 1, 1, 1, 1, 2},
		{2, 2, 2, 3, 2, 2, 2},
		{2, 4, 4, 3, 4, 4, 2},
		{2, 4, 4, 4, 4, 4, 2},
		{0, 2, 2, 2, 2, 2, 0},
	}

	// 投げたら回転を適用
	if pokeball.state == "thrown" {
		pokeball.rotation += 0.8 // さらに高速回転
	}

	p.Push()
	p.Translate(x, y)

	if pokeball.state == "shaking" {
		// 揺れアニメーション（高速化）
		shakeAngle := math.Sin(float64(pokeball.shakeTimer)*1.2) * 0.5
		p.Rotate(shakeAngle)
	} else if pokeball.state == "thrown" {
		p.Rotate(pokeball.rotation)
	}

	for row, pixels := range ballPixels {
		for col, pixel := range pixels {
			if pixel == 0 {
				continue
			}

			px := float64(col-3) * ps
			py := float64(row-3) * ps

			switch pixel {
			case 1: // Top half - ボールタイプによって色を変更
				switch pokeball.ballType {
				case 0: // モンスターボール（赤）
					p.Fill(255, 50, 50, 255)
				case 1: // スーパーボール（青）
					p.Fill(50, 100, 255, 255)
				case 2: // ハイパーボール（黄色）
					p.Fill(255, 200, 0, 255)
				case 3: // マスターボール（紫）
					p.Fill(150, 50, 255, 255)
				}
			case 2: // Black outline
				p.Fill(0, 0, 0, 255)
			case 3: // Button
				if pokeball.ballType == 3 {
					p.Fill(255, 0, 255, 255) // マスターボールはピンクのボタン
				} else {
					p.Fill(255, 255, 255, 255)
				}
			case 4: // Bottom half
				if pokeball.ballType == 3 {
					p.Fill(255, 255, 255, 255) // マスターボールは白
				} else {
					p.Fill(240, 240, 240, 255)
				}
			}

			p.NoStroke()
			p.Rect(px, py, ps, ps)
		}
	}

	p.Pop()
}

func drawMonster(monster Monster) {
	x := monster.x + shakeOffset
	y := monster.y + monster.animOffset

	// Draw based on monster type with detailed pixel art
	switch monster.monsterType {
	case 0: // Fire type - Dragon-like
		drawFireMonster(x, y, monster)
	case 1: // Water type - Fish-like
		drawWaterMonster(x, y, monster)
	case 2: // Grass type - Plant-like
		drawGrassMonster(x, y, monster)
	case 3: // Electric type - Mouse-like
		drawElectricMonster(x, y, monster)
	case 4: // Psychic type - Floating creature
		drawPsychicMonster(x, y, monster)
	}

	// アクセサリーを描画
	drawAccessories(x, y, monster)
}

func drawFireMonster(x, y float64, monster Monster) {
	scale := 1.2 * monster.sizeValue // サイズを適用
	ps := float64(pixelSize) * scale

	// ヒトカゲ風ピクセルアート（より詳細に）
	charmanderPixels := [][]int{
		{0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0},
		{0, 0, 0, 2, 1, 1, 1, 1, 2, 0, 0, 0},
		{0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0},
		{0, 2, 1, 1, 3, 1, 1, 3, 1, 1, 2, 0},
		{0, 2, 1, 1, 7, 1, 1, 7, 1, 1, 2, 0},
		{2, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 2},
		{2, 1, 1, 1, 4, 4, 4, 4, 1, 1, 1, 2},
		{2, 1, 1, 4, 4, 4, 4, 4, 4, 1, 1, 2},
		{2, 1, 1, 1, 4, 4, 4, 4, 1, 1, 1, 2},
		{0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0},
		{0, 0, 2, 5, 5, 0, 0, 5, 5, 2, 0, 0},
		{0, 0, 5, 5, 5, 0, 0, 5, 5, 5, 0, 0},
		{0, 0, 0, 6, 6, 6, 6, 6, 6, 0, 0, 0},
		{0, 0, 6, 6, 6, 9, 9, 6, 6, 6, 0, 0},
	}

	// カラーマッピング: 0=透明, 1=メインカラー, 2=ダークシェード, 3=目白, 4=腹, 5=足, 6=尻尾の炎, 7=目黒, 8=鼻, 9=炎コア
	for row, pixels := range charmanderPixels {
		for col, pixel := range pixels {
			if pixel == 0 {
				continue
			}

			px := x + float64(col-6)*ps
			py := y + float64(row-7)*ps

			switch pixel {
			case 1: // メインボディ
				p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
			case 2: // ダークアウトライン
				p.Fill(monster.color.r*3/4, monster.color.g*3/4, monster.color.b*3/4, 255)
			case 3: // 目白
				p.Fill(255, 255, 255, 255)
			case 4: // 腹（クリーム色）
				p.Fill(255, 230, 180, 255)
			case 5: // 足
				p.Fill(monster.color.r*4/5, monster.color.g*4/5, monster.color.b*4/5, 255)
			case 6: // 尻尾の炎
				if frameCount%10 < 5 {
					p.Fill(255, 100, 0, 255)
				} else {
					p.Fill(255, 200, 0, 255)
				}
			case 7: // 目黒
				p.Fill(0, 0, 0, 255)
			case 8: // 鼻
				p.Fill(50, 50, 50, 255)
			case 9: // 炎コア
				if frameCount%8 < 4 {
					p.Fill(255, 255, 150, 255)
				} else {
					p.Fill(255, 220, 100, 255)
				}
			}

			p.NoStroke()
			p.Rect(px, py, ps, ps)
		}
	}

	// 炎のアニメーション
	for i := 0; i < 5; i++ {
		flameOffset := math.Sin(float64(frameCount+i*15)*0.15) * ps * 0.5
		flameHeight := math.Sin(float64(frameCount+i*20)*0.2) * ps * 0.3
		fx := x + float64(i-2)*ps*0.3 + flameOffset
		fy := y + 4*ps - float64(i)*ps*0.5 + flameHeight

		alpha := uint8(200 - i*30)
		if frameCount%15 < 7 {
			p.Fill(255, uint8(200-i*30), 0, alpha)
		} else {
			p.Fill(255, uint8(150-i*20), 50, alpha)
		}
		p.NoStroke()
		p.Ellipse(fx, fy, ps*0.8, ps*1.2)
	}
}

func drawWaterMonster(x, y float64, monster Monster) {
	scale := 1.2 * monster.sizeValue // サイズを適用

	ps := float64(pixelSize) * scale
	swim := math.Sin(float64(frameCount)*0.15) * ps * 0.3

	// ゼニガメ風ピクセルアート
	turtlePixels := [][]int{
		{0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0},
		{0, 0, 0, 5, 6, 6, 6, 6, 5, 0, 0, 0},
		{0, 0, 5, 6, 6, 6, 6, 6, 6, 5, 0, 0},
		{0, 5, 6, 6, 6, 6, 6, 6, 6, 6, 5, 0},
		{0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0},
		{2, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 2},
		{2, 1, 1, 7, 1, 1, 1, 1, 7, 1, 1, 2},
		{2, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 2},
		{2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2},
		{0, 2, 4, 1, 1, 1, 1, 1, 1, 4, 2, 0},
		{0, 0, 4, 4, 0, 2, 2, 0, 4, 4, 0, 0},
		{0, 0, 0, 0, 0, 9, 9, 0, 0, 0, 0, 0},
	}

	for row, pixels := range turtlePixels {
		for col, pixel := range pixels {
			if pixel == 0 {
				continue
			}

			px := x + float64(col-6)*ps
			py := y + float64(row-6)*ps + swim

			switch pixel {
			case 1: // Main body
				p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
			case 2: // Dark outline
				p.Fill(monster.color.r*3/4, monster.color.g*3/4, monster.color.b*3/4, 255)
			case 3: // Eyes white
				p.Fill(255, 255, 255, 255)
			case 4: // Fins/hands
				p.Fill(monster.color.r-30, monster.color.g-30, monster.color.b+30, 200)
			case 5: // Shell edge
				p.Fill(100, 80, 60, 255)
			case 6: // Shell
				if (row+col)%2 == 0 {
					p.Fill(120, 100, 80, 255)
				} else {
					p.Fill(140, 120, 100, 255)
				}
			case 7: // Eye pupil
				p.Fill(0, 0, 0, 255)
			case 8: // Nose
				p.Fill(50, 50, 100, 255)
			case 9: // Tail
				waveOffset := math.Sin(float64(frameCount)*0.2+float64(col)*0.5) * ps * 0.2
				py += waveOffset
				p.Fill(monster.color.r*4/5, monster.color.g*4/5, monster.color.b*4/5, 255)
			}

			p.NoStroke()
			p.Rect(px, py, ps, ps)
		}
	}

	// 波紋エフェクト
	if frameCount%30 < 15 {
		for i := 0; i < 3; i++ {
			ringRadius := float64(i+1)*15 + float64(frameCount%30)
			alpha := uint8(100 - i*30 - frameCount%30*2)
			p.Stroke(100, 150, 255, alpha)
			p.StrokeWeight(2)
			p.NoFill()
			p.Ellipse(x, y+ps*2, ringRadius, ringRadius/2)
		}
		p.NoStroke()
	}

	// Bubbles
	for i := 0; i < 2; i++ {
		bubbleY := y - float64(4+i*2)*ps - float64(frameCount%40)*0.5
		if bubbleY > y-8*ps {
			p.Fill(200, 220, 255, 150)
			p.Rect(x+float64(i-1)*ps*2, bubbleY, ps*0.6, ps*0.6)
		}
	}
}

func drawGrassMonster(x, y float64, monster Monster) {
	scale := 1.2 * monster.sizeValue // サイズを適用

	ps := float64(pixelSize) * scale

	// フシギダネ風ピクセルアート
	bulbasaurPixels := [][]int{
		{0, 0, 0, 5, 5, 5, 5, 5, 5, 0, 0, 0},
		{0, 0, 5, 6, 5, 5, 5, 5, 6, 5, 0, 0},
		{0, 5, 6, 6, 5, 5, 5, 5, 6, 6, 5, 0},
		{0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0},
		{0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0},
		{2, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 2},
		{2, 1, 1, 7, 1, 8, 8, 1, 7, 1, 1, 2},
		{2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2},
		{2, 9, 1, 1, 1, 1, 1, 1, 1, 1, 9, 2},
		{0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0},
		{0, 0, 2, 4, 4, 0, 0, 4, 4, 2, 0, 0},
		{0, 0, 4, 4, 4, 0, 0, 4, 4, 4, 0, 0},
	}

	for row, pixels := range bulbasaurPixels {
		for col, pixel := range pixels {
			if pixel == 0 {
				continue
			}

			px := x + float64(col-6)*ps
			py := y + float64(row-6)*ps

			switch pixel {
			case 1: // Main body
				p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
			case 2: // Dark outline
				p.Fill(monster.color.r*3/4, monster.color.g*3/4, monster.color.b*3/4, 255)
			case 3: // Eyes white
				p.Fill(255, 255, 255, 255)
			case 4: // Roots/feet
				p.Fill(monster.color.r*4/5, monster.color.g*4/5, monster.color.b*4/5, 255)
			case 5: // Bulb leaves
				p.Fill(50, 150, 50, 255)
			case 6: // Bulb flower
				if frameCount%60 < 30 {
					p.Fill(255, 150, 200, 255)
				} else {
					p.Fill(255, 200, 150, 255)
				}
			case 7: // Eye pupil
				p.Fill(0, 0, 0, 255)
			case 8: // Nose
				p.Fill(50, 100, 50, 255)
			case 9: // Spots
				p.Fill(monster.color.r/2, monster.color.g, monster.color.b/2, 255)
			}

			p.NoStroke()
			p.Rect(px, py, ps, ps)
		}
	}

	// 花びらエフェクト
	for i := 0; i < 3; i++ {
		petalOffset := math.Sin(float64(frameCount+i*40)*0.1) * ps * 2
		petalY := y - float64(5+i)*ps + petalOffset
		petalX := x + float64(i-1)*ps*3

		if frameCount%60 < 30 {
			p.Fill(255, 150, 200, 150)
		} else {
			p.Fill(255, 200, 150, 150)
		}
		p.NoStroke()
		p.Ellipse(petalX, petalY, ps, ps*1.5)
	}
}

func drawElectricMonster(x, y float64, monster Monster) {
	scale := 1.0 * monster.sizeValue // サイズを適用

	ps := float64(pixelSize) * scale
	staticOffset := math.Sin(float64(frameCount)*0.3) * ps * 0.2

	// Draw pixel art electric mouse
	mousePixels := [][]int{
		{0, 2, 0, 0, 0, 0, 0, 2, 0},
		{2, 2, 0, 0, 0, 0, 0, 2, 2},
		{0, 2, 1, 1, 1, 1, 1, 2, 0},
		{2, 1, 3, 1, 1, 1, 3, 1, 2},
		{2, 5, 1, 1, 1, 1, 1, 5, 2},
		{2, 1, 1, 1, 4, 1, 1, 1, 2},
		{0, 2, 1, 1, 1, 1, 1, 2, 0},
		{0, 0, 2, 1, 1, 1, 2, 0, 0},
		{0, 0, 2, 2, 0, 2, 2, 0, 0},
	}

	for row, pixels := range mousePixels {
		for col, pixel := range pixels {
			if pixel == 0 {
				continue
			}

			px := x + float64(col-4)*ps
			py := y + float64(row-4)*ps + staticOffset

			switch pixel {
			case 1: // Main body
				p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
			case 2: // Dark outline/ears
				p.Fill(0, 0, 0, 255)
			case 3: // Eyes
				p.Fill(255, 255, 255, 255)
			case 4: // Lightning bolt
				p.Fill(255, 255, 150, 255)
			case 5: // Cheeks
				p.Fill(255, 100, 100, 255)
			}

			p.NoStroke()
			p.Rect(px, py, ps, ps)
		}
	}

	// Eye pupils
	p.Fill(0, 0, 0, 255)
	p.Rect(x-2*ps, y-ps+staticOffset, ps*0.5, ps*0.5)
	p.Rect(x+1.5*ps, y-ps+staticOffset, ps*0.5, ps*0.5)

	// Electric sparks
	if frameCount%10 < 5 {
		for i := 0; i < 3; i++ {
			angle := float64(i) * 2 * math.Pi / 3
			sparkX := x + math.Cos(angle)*5*ps
			sparkY := y + math.Sin(angle)*5*ps

			p.Fill(255, 255, 0, 200)
			p.Rect(sparkX, sparkY, ps*0.4, ps*0.4)
		}
	}
}

func drawPsychicMonster(x, y float64, monster Monster) {
	scale := 1.0 * monster.sizeValue // サイズを適用

	ps := float64(pixelSize) * scale
	float := math.Sin(float64(frameCount)*0.1) * ps * 0.5

	// Draw pixel art psychic creature
	psychicPixels := [][]int{
		{0, 0, 5, 5, 5, 5, 5, 0, 0},
		{0, 0, 2, 2, 2, 2, 2, 0, 0},
		{0, 2, 1, 1, 1, 1, 1, 2, 0},
		{2, 1, 3, 1, 4, 1, 3, 1, 2},
		{2, 1, 1, 1, 1, 1, 1, 1, 2},
		{2, 1, 1, 1, 1, 1, 1, 1, 2},
		{0, 2, 1, 1, 1, 1, 1, 2, 0},
		{0, 0, 2, 6, 6, 6, 2, 0, 0},
		{0, 0, 6, 0, 0, 0, 6, 0, 0},
	}

	// Psychic aura
	for i := 2; i > 0; i-- {
		alpha := uint8(30 * (3 - i))
		p.Fill(200, 150, 255, alpha)
		p.NoStroke()
		p.Rect(x-float64(i+3)*ps, y-float64(i+3)*ps+float, float64(2*i+7)*ps, float64(2*i+7)*ps)
	}

	for row, pixels := range psychicPixels {
		for col, pixel := range pixels {
			if pixel == 0 {
				continue
			}

			px := x + float64(col-4)*ps
			py := y + float64(row-4)*ps + float

			switch pixel {
			case 1: // Main body
				p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
			case 2: // Dark outline
				p.Fill(monster.color.r/2, monster.color.g/2, monster.color.b/2, 255)
			case 3: // Eyes
				p.Fill(255, 255, 255, 255)
			case 4: // Gem
				p.Fill(255, 100, 200, 255)
			case 5: // Crown/horns
				p.Fill(255, 200, 100, 255)
			case 6: // Tentacles
				p.Fill(monster.color.r-30, monster.color.g-30, monster.color.b-30, 200)
			}

			p.NoStroke()
			p.Rect(px, py, ps, ps)
		}
	}

	// Eye pupils with glow
	eyeGlow := math.Sin(float64(frameCount)*0.2)*127 + 128
	p.Fill(150, 100, 200, uint8(eyeGlow))
	p.Rect(x-2*ps, y-ps+float, ps*0.7, ps*0.7)
	p.Rect(x+1.3*ps, y-ps+float, ps*0.7, ps*0.7)

	// Orbiting particles
	for i := 0; i < 4; i++ {
		angle := float64(i)*math.Pi/2 + float64(frameCount)*0.05
		particleX := x + math.Cos(angle)*6*ps
		particleY := y + math.Sin(angle)*6*ps

		p.Fill(255, 200, 255, 150)
		p.Rect(particleX, particleY, ps*0.5, ps*0.5)
	}
}

func updateAnimations() {
	// モンスターの待機アニメーション更新
	wildMonster.animOffset = math.Sin(float64(frameCount)*0.3) * 3 // 高速化

	// モンスターボールのアニメーション更新
	if pokeball.state == "thrown" {
		// 軌跡を追加
		pokeball.trailX = append(pokeball.trailX, pokeball.x)
		pokeball.trailY = append(pokeball.trailY, pokeball.y)
		if len(pokeball.trailX) > 10 {
			pokeball.trailX = pokeball.trailX[1:]
			pokeball.trailY = pokeball.trailY[1:]
		}

		// モンスターに向かって移動（大幅に高速化）
		pokeball.x += pokeball.vx * 3
		pokeball.y += pokeball.vy * 3
		pokeball.vy += 0.8 // 重力

		// モンスターにヒットしたかチェック
		dist := math.Sqrt(math.Pow(pokeball.x-wildMonster.x, 2) + math.Pow(pokeball.y-wildMonster.y, 2))
		if dist < 30 {
			pokeball.state = "shaking"
			pokeball.shakeCount = 0
			pokeball.shakeTimer = 0
			captureState = "shaking"

			// モンスターを隠す（ボールに吸い込まれる演出）
			// リッチな吸い込みエフェクト
			for wave := 0; wave < 3; wave++ {
				for i := 0; i < 30; i++ {
					angle := float64(i) * math.Pi * 2 / 30
					radius := float64(wave+1) * 20

					particles = append(particles, Particle{
						x:    wildMonster.x + math.Cos(angle)*radius,
						y:    wildMonster.y + math.Sin(angle)*radius,
						vx:   -math.Cos(angle) * 6,
						vy:   -math.Sin(angle) * 6,
						life: 1.0 + float64(wave)*0.2,
						color: struct{ r, g, b, a uint8 }{
							r: uint8(255 - wave*50),
							g: uint8(100 + wave*30),
							b: uint8(100 + wave*50),
							a: uint8(250 - wave*30),
						},
						size:         rand.Float64()*4 + 3,
						particleType: "capture",
					})
				}
			}

			// スピードラインエフェクト
			for i := 0; i < 15; i++ {
				angle := rand.Float64() * math.Pi * 2
				speed := rand.Float64()*10 + 5

				particles = append(particles, Particle{
					x:    wildMonster.x,
					y:    wildMonster.y,
					vx:   math.Cos(angle) * speed,
					vy:   math.Sin(angle) * speed,
					life: 0.5,
					color: struct{ r, g, b, a uint8 }{
						r: 255,
						g: 255,
						b: 255,
						a: 200,
					},
					size:         1,
					particleType: "line",
				})
			}
		}
	} else if pokeball.state == "shaking" {
		pokeball.shakeTimer++

		// 3回揺れる（さらに高速）
		if pokeball.shakeTimer%5 == 0 { // 10から5に変更で2倍速
			pokeball.shakeCount++

			if pokeball.shakeCount >= 3 {
				// 捕獲成功判定（ボールタイプによって補正）
				catchBonus := 1.0
				switch pokeball.ballType {
				case 1: // スーパーボール
					catchBonus = 1.5
				case 2: // ハイパーボール
					catchBonus = 2.0
				case 3: // マスターボール
					catchBonus = 100.0 // 必ず捕まえる
				}

				if rand.Float64() < wildMonster.catchRate*catchBonus {
					// 成功！画面全体で祝福！
					captureState = "success"
					pokeball.state = "captured"

					// ボールをモンスターの横に配置
					pokeball.x = wildMonster.x - 50
					pokeball.y = wildMonster.y + 20

					// レア度に応じたエフェクト
					particleCount := 80 + wildMonster.rarity*50

					// リング状のエフェクト（レア度に応じて）
					for ring := 0; ring < wildMonster.rarity+2; ring++ {
						for i := 0; i < 36; i++ {
							angle := float64(i) * math.Pi * 2 / 36
							radius := float64(ring+1) * 25
							particles = append(particles, Particle{
								x:    pokeball.x + math.Cos(angle)*radius,
								y:    pokeball.y + math.Sin(angle)*radius,
								vx:   math.Cos(angle) * 4,
								vy:   math.Sin(angle) * 4,
								life: 2.0 + float64(ring)*0.2,
								color: struct{ r, g, b, a uint8 }{
									r: uint8(255),
									g: uint8(215 - ring*20),
									b: uint8(0 + ring*40),
									a: uint8(255 - ring*20),
								},
								size:         float64(8-ring) + rand.Float64()*4,
								particleType: "star",
							})
						}
					}

					// 爆発エフェクト
					for i := 0; i < 50; i++ {
						angle := rand.Float64() * math.Pi * 2
						speed := rand.Float64()*15 + 5

						particles = append(particles, Particle{
							x:    pokeball.x,
							y:    pokeball.y,
							vx:   math.Cos(angle) * speed,
							vy:   math.Sin(angle) * speed,
							life: 1.5,
							color: struct{ r, g, b, a uint8 }{
								r: uint8(rand.Intn(56) + 200),
								g: uint8(rand.Intn(56) + 200),
								b: uint8(rand.Intn(100) + 155),
								a: 255,
							},
							size:         rand.Float64()*6 + 2,
							particleType: "circle",
						})
					}

					// 画面全体に大量の祝福パーティクル
					for i := 0; i < particleCount; i++ {
						angle := rand.Float64() * math.Pi * 2
						speed := rand.Float64()*8 + 2

						// 画面の色々な場所から
						startX := rand.Float64() * 400
						startY := 400.0 // 下から打ち上げ

						particles = append(particles, Particle{
							x:    startX,
							y:    startY,
							vx:   math.Cos(angle) * speed * 0.3,
							vy:   -speed - rand.Float64()*5, // 上に打ち上げ
							life: 2.0,
							color: struct{ r, g, b, a uint8 }{
								r: uint8(rand.Intn(100) + 155),
								g: uint8(rand.Intn(100) + 155),
								b: uint8(rand.Intn(100) + 155),
								a: 255,
							},
							size:         rand.Float64()*8 + 4,
							particleType: "star",
						})
					}
				} else {
					// 失敗時の処理
					// ボールから逃げ出すエフェクト
					for i := 0; i < 20; i++ {
						angle := rand.Float64() * math.Pi * 2
						speed := rand.Float64()*5 + 3

						particles = append(particles, Particle{
							x:    pokeball.x,
							y:    pokeball.y,
							vx:   math.Cos(angle) * speed,
							vy:   math.Sin(angle) * speed,
							life: 0.8,
							color: struct{ r, g, b, a uint8 }{
								r: 255,
								g: 100,
								b: 100,
								a: 200,
							},
							size:         rand.Float64()*3 + 2,
							particleType: "escape",
						})
					}

					if captureAttempts >= maxAttempts {
						// 3回失敗したらゲームオーバー（逃げられた）
						captureState = "gameover"
						pokeball.state = "idle"
						// ここで停止（自動で次のボールを投げない）
					} else {
						// まだ試行回数が残っている場合は自動で次のボールを投げる
						captureState = "failed"
						pokeball.state = "idle"

						// 自動で次のボールを投げる
						go func() {
							time.Sleep(800 * time.Millisecond) // 少し間を置く
							if captureState == "failed" && captureAttempts < maxAttempts {
								// 自動で次のボールを投げる
								throwPokeball()
							}
						}()
					}
				}
			}
		}
	}

	// テキストアニメーション更新
	if textAnimation.text != "" {
		textAnimation.progress += 0.08 // 大幅に高速化

		if textAnimation.fadeOut && textAnimation.progress > 1.0 {
			textAnimation.text = ""
		}
	}
}

func updateParticles() {
	for i := len(particles) - 1; i >= 0; i-- {
		p := &particles[i]

		// 位置を更新
		p.x += p.vx
		p.y += p.vy

		// Apply gravity for some particles
		if p.particleType == "impact" {
			p.vy += 0.3
		}

		// Fade out
		p.life -= 0.02

		// Remove dead particles
		if p.life <= 0 {
			particles = append(particles[:i], particles[i+1:]...)
		}
	}

	// Draw particles
	for _, particle := range particles {
		alpha := uint8(particle.life * float64(particle.color.a))
		p.Fill(particle.color.r, particle.color.g, particle.color.b, alpha)
		p.NoStroke()

		if particle.particleType == "star" {
			// Draw star shape
			drawStar(particle.x, particle.y, particle.size)
		} else {
			// Draw circle
			p.Ellipse(particle.x, particle.y, particle.size, particle.size)
		}
	}
}

func drawStar(x, y, size float64) {
	p.Push()
	p.Translate(x, y)

	for i := 0; i < 5; i++ {
		angle := float64(i)*2*math.Pi/5 - math.Pi/2
		x1 := math.Cos(angle) * size
		y1 := math.Sin(angle) * size

		angle2 := angle + math.Pi/5
		x2 := math.Cos(angle2) * size * 0.5
		y2 := math.Sin(angle2) * size * 0.5

		p.Triangle(0, 0, x1, y1, x2, y2)
	}

	p.Pop()
}

func drawAccessories(x, y float64, monster Monster) {
	ps := float64(pixelSize)

	// 帽子の描画
	if monster.hasHat {
		// 赤い帽子
		hatPixels := [][]int{
			{0, 0, 2, 2, 2, 2, 2, 0, 0},
			{0, 2, 1, 1, 1, 1, 1, 2, 0},
			{2, 1, 1, 3, 1, 3, 1, 1, 2},
			{2, 2, 2, 2, 2, 2, 2, 2, 2},
		}

		for row, pixels := range hatPixels {
			for col, pixel := range pixels {
				if pixel == 0 {
					continue
				}

				px := x + float64(col-4)*ps
				py := y + float64(row-10)*ps - 5

				switch pixel {
				case 1: // 帽子メイン
					p.Fill(255, 50, 50, 255)
				case 2: // 帽子の縁
					p.Fill(180, 30, 30, 255)
				case 3: // 飾り
					p.Fill(255, 255, 0, 255)
				}

				p.NoStroke()
				p.Rect(px, py, ps, ps)
			}
		}
	}

	// その他のアクセサリー
	switch monster.accessory {
	case "crown":
		// 王冠
		crownPixels := [][]int{
			{0, 3, 0, 3, 0, 3, 0},
			{0, 1, 1, 1, 1, 1, 0},
			{1, 1, 2, 1, 2, 1, 1},
			{1, 1, 1, 1, 1, 1, 1},
		}

		for row, pixels := range crownPixels {
			for col, pixel := range pixels {
				if pixel == 0 {
					continue
				}

				px := x + float64(col-3)*ps
				py := y + float64(row-10)*ps - 8

				switch pixel {
				case 1: // 王冠ベース
					p.Fill(255, 215, 0, 255)
				case 2: // 宝石
					p.Fill(255, 50, 200, 255)
				case 3: // トップ
					p.Fill(255, 255, 100, 255)
				}

				p.NoStroke()
				p.Rect(px, py, ps, ps)
			}
		}

	case "scarf":
		// マフラー
		scarfColor := struct{ r, g, b uint8 }{255, 100, 100}
		if monster.rarity >= 2 {
			scarfColor = struct{ r, g, b uint8 }{150, 100, 255} // レアは紫
		}

		// 首回り
		p.Fill(scarfColor.r, scarfColor.g, scarfColor.b, 255)
		p.NoStroke()
		p.Rect(x-3*ps, y+2*ps, 6*ps, ps)

		// なびく部分
		wave := math.Sin(float64(frameCount)*0.1) * ps
		p.Rect(x+3*ps, y+2*ps, 2*ps, 3*ps)
		p.Rect(x+4*ps+wave, y+3*ps, ps, 2*ps)

	case "glasses":
		// メガネ
		p.Fill(0, 0, 0, 255)
		p.NoStroke()
		// フレーム
		p.Rect(x-3*ps, y-ps, 2*ps, 2*ps)
		p.Rect(x+ps, y-ps, 2*ps, 2*ps)
		p.Rect(x-ps, y-0.5*ps, 2*ps, ps*0.5)
		// レンズ
		p.Fill(200, 200, 255, 100)
		p.Rect(x-2.5*ps, y-0.5*ps, ps, ps)
		p.Rect(x+1.5*ps, y-0.5*ps, ps, ps)

	case "bowtie":
		// 蝶ネクタイ
		p.Fill(50, 50, 200, 255)
		p.NoStroke()
		// 左側
		p.Triangle(x-ps, y+3*ps, x-3*ps, y+2*ps, x-3*ps, y+4*ps)
		// 右側
		p.Triangle(x+ps, y+3*ps, x+3*ps, y+2*ps, x+3*ps, y+4*ps)
		// 中央
		p.Fill(255, 255, 0, 255)
		p.Rect(x-ps, y+2.5*ps, 2*ps, ps)

	case "cape":
		// マント
		capeColor := struct{ r, g, b uint8 }{100, 50, 150}
		if monster.rarity == 3 {
			// レジェンドは金色のマント
			capeColor = struct{ r, g, b uint8 }{200, 150, 0}
		}

		flow := math.Sin(float64(frameCount)*0.08) * ps * 0.5

		p.Fill(capeColor.r, capeColor.g, capeColor.b, 200)
		p.NoStroke()

		// マントの形
		for i := 0; i < 5; i++ {
			width := float64(5-i) * ps
			p.Rect(x-width/2, y+float64(i)*ps+flow, width, ps)
		}
	}

	// 色違いの場合は特別なオーラエフェクト
	if monster.isShiny {
		if frameCount%20 < 10 {
			// キラキラエフェクト
			for i := 0; i < 3; i++ {
				angle := float64(frameCount)*0.1 + float64(i)*2*math.Pi/3
				sparkX := x + math.Cos(angle)*8*ps
				sparkY := y + math.Sin(angle)*8*ps

				p.Fill(255, 255, 100, 150)
				p.NoStroke()
				drawStar(sparkX, sparkY, ps)
			}
		}
	}
}

func drawCaptureUI() {
	// テキストボックスの背景を描画
	p.Fill(255, 255, 255, 255)
	p.NoStroke()
	p.Rect(10, 300, 380, 90)
	p.Fill(0, 0, 100, 255)
	p.Rect(15, 305, 370, 80)

	// ステータステキストを描画
	p.Fill(255, 255, 255, 255)
	p.TextSize(14)

	if captureState == "encounter" {
		shinyMark := ""
		if wildMonster.isShiny {
			shinyMark = "✨"
		}
		p.Text(fmt.Sprintf("やせいの %s%s があらわれた！", shinyMark, wildMonster.name), 30, 330)
		p.TextSize(10)
		p.Text("クリックで ボールを なげる！（ランダム）", 30, 350)
	} else if captureState == "failed" {
		p.Text(fmt.Sprintf("%s は ボールから でてしまった！", wildMonster.name), 30, 330)
		p.TextSize(12)
		p.Text(fmt.Sprintf("のこり %d かい", maxAttempts-captureAttempts), 30, 350)
		p.TextSize(10)
		p.Text("クリックで もういちど ボールを なげる！", 30, 370)
	} else if captureState == "throwing" {
		ballNames := []string{"モンスター", "スーパー", "ハイパー", "マスター"}
		p.Text(fmt.Sprintf("いけっ！ %sボール！", ballNames[pokeball.ballType]), 30, 340)
	} else if captureState == "shaking" {
		shakeText := ""
		for i := 0; i < pokeball.shakeCount; i++ {
			shakeText += "・"
		}
		p.Text(shakeText, 30, 340)
	} else if captureState == "success" {
		// 成功時の表示（捕獲後に詳細情報を表示）
		shinyText := ""
		if wildMonster.isShiny {
			shinyText = "✨色違い✨ "
		}

		// 星でレア度を表示（色付き）
		stars := ""
		for i := 0; i < wildMonster.rarity; i++ {
			stars += "⭐"
		}

		p.Text(fmt.Sprintf("%s%s を つかまえた！", shinyText, wildMonster.name), 30, 330)
		p.Text(fmt.Sprintf("Lv.%d サイズ:%s %s", wildMonster.level, wildMonster.size, stars), 30, 350)
		if wildMonster.accessory != "none" {
			p.TextSize(123)
			p.Text(fmt.Sprintf("アクセサリー: %s", wildMonster.accessory), 30, 350)
		}
	} else if captureState == "gameover" {
		// ゲームオーバー時の表示
		p.Text(fmt.Sprintf("%s は にげだした！", wildMonster.name), 30, 330)
		p.TextSize(12)
		p.Text("つかまえられなかった...", 30, 350)
		p.Text("クリックで もういちど", 30, 370)
	}

	// 残り試行回数を描画
	p.Fill(255, 255, 255, 255)
	p.TextSize(10)
	p.Text(fmt.Sprintf("のこり: %d/%d", maxAttempts-captureAttempts, maxAttempts), 300, 320)
}

func throwPokeball() {
	if captureState != "encounter" && captureState != "failed" {
		return
	}

	captureState = "throwing"
	captureAttempts++

	// ランダムにボールタイプを選択（運試し）
	ballRoll := rand.Float64()
	if ballRoll < 0.05 {
		pokeball.ballType = 3 // マスターボール (5%)
	} else if ballRoll < 0.20 {
		pokeball.ballType = 2 // ハイパーボール (15%)
	} else if ballRoll < 0.50 {
		pokeball.ballType = 1 // スーパーボール (30%)
	} else {
		pokeball.ballType = 0 // モンスターボール (50%)
	}

	// 投げる軌道を計算
	pokeball.state = "thrown"
	pokeball.x = 200
	pokeball.y = 350

	dx := wildMonster.x - pokeball.x
	dy := wildMonster.y - pokeball.y - 50 // 少し高めを狙う

	// 初期速度を計算（高速化）
	pokeball.vx = dx / 10   // 大幅に高速化
	pokeball.vy = dy/10 - 7 // 上向きの弧を追加
	pokeball.rotation = 0
}

func drawHPBar_old(x, y float64, monster Monster, isPlayer bool) {
	// Background
	p.Fill(0, 0, 0, 200)
	p.NoStroke()
	p.Rect(x-5, y-5, 110, 50)

	// Name
	p.Fill(255, 255, 255, 255)
	p.TextSize(10)
	p.Text(monster.name, x, y+8)

	// HP bar background
	p.Fill(50, 50, 50, 255)
	p.Rect(x, y+12, 100, 8)

	// HP bar fill
	hpPercent := float64(monster.hp) / float64(monster.maxHP)
	hpColor := struct{ r, g, b uint8 }{100, 255, 100}

	if hpPercent < 0.5 {
		hpColor = struct{ r, g, b uint8 }{255, 200, 0}
	}
	if hpPercent < 0.25 {
		hpColor = struct{ r, g, b uint8 }{255, 100, 100}
	}

	p.Fill(hpColor.r, hpColor.g, hpColor.b, 255)
	p.Rect(x, y+12, 100*hpPercent, 8)

	// HP numbers
	p.Fill(255, 255, 255, 255)
	p.TextSize(8)
	p.Text(fmt.Sprintf("%d/%d", monster.hp, monster.maxHP), x+35, y+30)
}

func drawTextAnimation() {
	y := textAnimation.y

	if !textAnimation.fadeOut {
		y -= textAnimation.progress * 20
	}

	alpha := uint8(255)
	if textAnimation.fadeOut {
		alpha = uint8(255 * (1 - textAnimation.progress))
	}

	// Text shadow
	p.Fill(0, 0, 0, alpha/2)
	p.TextSize(20)
	p.Text(textAnimation.text, textAnimation.x+2, y+2)

	// Main text
	p.Fill(textAnimation.color.r, textAnimation.color.g, textAnimation.color.b, alpha)
	p.Text(textAnimation.text, textAnimation.x, y)
}

func drawMiniPokeball(x, y float64) {
	// Draw small pokeball icon
	p.Fill(255, 50, 50, 255)
	p.NoStroke()
	p.Ellipse(x, y, 8, 8)
	p.Fill(240, 240, 240, 255)
	p.Arc(x, y, 8, 8, 0, math.Pi)
	p.Fill(0, 0, 0, 255)
	p.Rect(x-4, y-1, 8, 2)
	p.Fill(255, 255, 255, 255)
	p.Ellipse(x, y, 3, 3)
}

func drawAnimatedObjects() {
	for i := range animatedObjects {
		obj := &animatedObjects[i]

		// 位置を更新
		obj.x += obj.speed
		if obj.x > 410 {
			obj.x = -10
		}

		// Draw based on type
		if obj.animType == "butterfly" {
			// Animated butterfly
			wingFlap := math.Sin(float64(frameCount)*0.3+float64(i)) * 10
			p.Fill(255, 200, 100, 200)
			p.NoStroke()
			p.Ellipse(obj.x-wingFlap, obj.y, 6, 4)
			p.Ellipse(obj.x+wingFlap, obj.y, 6, 4)
			p.Fill(100, 50, 0, 255)
			p.Ellipse(obj.x, obj.y, 3, 6)
		}
	}
}

func drawWeatherEffects() {
	if weatherType == 0 {
		return
	}

	// Update and draw weather particles
	for i := range weatherParticles {
		particle := &weatherParticles[i]

		// 位置を更新
		particle.x += particle.vx
		particle.y += particle.vy

		// Wrap around screen
		if particle.y > 400 {
			particle.y = 0
			particle.x = rand.Float64() * 400
		}
		if particle.x < 0 {
			particle.x = 400
		} else if particle.x > 400 {
			particle.x = 0
		}

		// Draw particle
		switch weatherType {
		case 1: // Rain
			p.Stroke(100, 150, 200, 150)
			p.StrokeWeight(1)
			p.Line(particle.x, particle.y, particle.x-particle.vx*2, particle.y-particle.vy*2)
			p.NoStroke()
		case 2: // Snow
			p.Fill(255, 255, 255, 200)
			p.NoStroke()
			p.Ellipse(particle.x, particle.y, particle.size, particle.size)
		case 3: // Leaves
			leafAngle := float64(frameCount)*0.05 + particle.x
			p.Fill(150, 100, 50, 150)
			p.Push()
			p.Translate(particle.x, particle.y)
			p.Rotate(leafAngle)
			p.Ellipse(0, 0, particle.size*2, particle.size)
			p.Pop()
		case 4: // Sandstorm
			p.Fill(255, 220, 130, 100)
			p.NoStroke()
			p.Ellipse(particle.x, particle.y, particle.size*2, particle.size*2)
		}
	}

	// 天候に応じた全体エフェクト
	if weatherType == 4 {
		// 砂嵐の場合は画面全体に薄い砂のエフェクト
		p.Fill(255, 220, 100, 30)
		p.NoStroke()
		p.Rect(0, 0, 400, 400)
	}
}
