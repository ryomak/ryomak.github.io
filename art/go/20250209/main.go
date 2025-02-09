package main

import (
	"math/rand"
	"time"

	"github.com/ryomak/p5go"
)

const (
	CANVAS_WIDTH        = 400
	CANVAS_HEIGHT       = 400
	BASE_Y              = CANVAS_HEIGHT * 1
	BUILDING_BASE_WIDTH = 80
	STAR_COUNT          = 50
	SPRITE_SCALE        = 5 // 建物スプライトは16×16で拡大
	TREE_SCALE          = 3 // 木は8×8ドットを小さめに表示
	MOON_SCALE          = 4 // 月は8×8ドット、適度な大きさに表示
	TREE_COUNT          = 4
)

// パレット（0=透明）
// 1: 壁色（建物と共通）
// 2: 窓色
// 3: 屋根色
// 6: 月用の色
var palette = map[int][3]int{
	1: {70, 70, 90},              // 壁
	2: {255, 220, 100},           // 窓
	3: generateRandomRoofColor(), // 屋根
	6: {250, 250, 200},           // 月
}

// 屋根色のランダム生成関数
func generateRandomRoofColor() [3]int {
	rand.Seed(time.Now().UnixNano())

	// 値をランダムに生成
	r := rand.Intn(141) + 50 // 50～190の範囲
	g := rand.Intn(141) + 50
	b := rand.Intn(141) + 50

	// 条件を満たすまで再生成
	for !isValidColor(r, g, b) {
		r = rand.Intn(141) + 50
		g = rand.Intn(141) + 50
		b = rand.Intn(141) + 50
	}

	return [3]int{r, g, b}
}

// 条件チェック関数
func isValidColor(r, g, b int) bool {
	// 120以上の値の個数をカウント
	countAbove120 := 0
	if r >= 120 {
		countAbove120++
	}
	if g >= 120 {
		countAbove120++
	}
	if b >= 120 {
		countAbove120++
	}

	// 条件: 1つまたは2つは120以上、3つとも120以上は不可
	return countAbove120 >= 1 && countAbove120 <= 2
}

// ─────────────────────────────
// 【建物スプライト】（16×16ドット）

// 高層ビル（屋根は1行のみのフラットな屋根）
var highBuildingSprite1 = [][]int{
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0}, // 屋根行
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
}

// 商業ビル（屋根は1行のみ）
var commercialBuildingSprite = [][]int{
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0}, // 屋根行
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0},
	{1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0},
	{1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0},
	{1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0},
	{1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0},
	{1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0},
}

// 三角屋根の建物（屋根は三角形）
var triangleBuildingSprite = [][]int{
	{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 0, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0},
	{0, 0, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0},
	{0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0},
	{3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0},
	{1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0, 0, 0},
	{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0},
}

// タワー（屋根なし・シンプルな縦長パターン）
var towerSprite = [][]int{
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
	{0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 0},
}

// ─────────────────────────────
// 【小さい家スプライト】（新規：8×?ドット）
// 手前レイヤー用：大きすぎる建物は排除し、小さい家のみ表示する
// 上部（屋根）はキー3、下部（壁・窓）はキー1,2 を使用
var smallHouseSprite = [][]int{
	{3, 3, 3, 3, 3, 3, 3, 3},
	{1, 1, 1, 1, 1, 1, 1, 1},
	{1, 2, 1, 2, 1, 2, 1, 1},
	{1, 1, 1, 1, 1, 1, 1, 1},
	{1, 2, 1, 2, 1, 2, 1, 1},
	{1, 1, 1, 1, 1, 1, 1, 1},
}

// ─────────────────────────────
// 【木のスプライト】（新規：8×8ドット、建物と同じパレットを使用）
// 上部（ canopy ）は屋根色（キー3）、下部（ trunk ）は壁色（キー1）
var treeSprite = [][]int{
	{0, 0, 0, 1, 1, 0, 0, 0},
	{0, 0, 1, 1, 1, 1, 0, 0},
	{0, 1, 1, 1, 1, 1, 1, 0},
	{0, 1, 1, 1, 1, 1, 1, 0},
	{0, 1, 1, 1, 1, 1, 1, 0},
	{0, 0, 0, 1, 1, 0, 0, 0},
	{0, 0, 0, 1, 1, 0, 0, 0},
	{0, 0, 0, 1, 1, 0, 0, 0},
}

// ─────────────────────────────
// 【月のスプライト】（8×8ドット）
// キー6を使用
// 満月
var moonFullSprite = [][]int{
	{0, 0, 6, 6, 6, 6, 0, 0},
	{0, 6, 6, 6, 6, 6, 6, 0},
	{6, 6, 6, 6, 6, 6, 6, 6},
	{6, 6, 6, 6, 6, 6, 6, 6},
	{6, 6, 6, 6, 6, 6, 6, 6},
	{6, 6, 6, 6, 6, 6, 6, 6},
	{0, 6, 6, 6, 6, 6, 6, 0},
	{0, 0, 6, 6, 6, 6, 0, 0},
}

// 半月（左側のみ表示）
var moonHalfSprite = [][]int{
	{0, 0, 6, 6, 0, 0, 0, 0},
	{0, 6, 6, 6, 0, 0, 0, 0},
	{6, 6, 6, 6, 0, 0, 0, 0},
	{6, 6, 6, 6, 0, 0, 0, 0},
	{6, 6, 6, 6, 0, 0, 0, 0},
	{6, 6, 6, 6, 0, 0, 0, 0},
	{0, 6, 6, 6, 0, 0, 0, 0},
	{0, 0, 6, 6, 0, 0, 0, 0},
}

// 三日月
var moonCrescentSprite = [][]int{
	{0, 0, 6, 6, 6, 6, 0, 0},
	{0, 0, 0, 6, 6, 6, 6, 0},
	{0, 0, 0, 0, 6, 6, 6, 6},
	{0, 0, 0, 0, 6, 6, 6, 6},
	{0, 0, 0, 6, 6, 6, 6, 6},
	{6, 6, 6, 6, 6, 6, 6, 6},
	{0, 6, 6, 6, 6, 6, 6, 0},
	{0, 0, 6, 6, 6, 6, 0, 0},
}

// ─────────────────────────────
// 描画用関数

// drawSprite: 指定位置にスプライトを描画（layer毎にシェーディング適用）
// layer: 0 = 奥（または背景）、1 = 中間、2 = 手前
func drawSprite(c *p5go.Canvas, sprite [][]int, x, y, scale float64, layer int) {
	layerShading := [3]float64{1.0, 0.8, 0.6}
	shading := layerShading[layer]
	for i := 0; i < len(sprite); i++ {
		for j := 0; j < len(sprite[i]); j++ {
			pixel := sprite[i][j]
			if pixel != 0 {
				if color, exists := palette[pixel]; exists {
					c.Fill(float64(color[0])*shading, float64(color[1])*shading, float64(color[2])*shading)
					c.Rect(x+float64(j)*scale, y+float64(i)*scale, scale, scale)
				}
			}
		}
	}
}

// drawNightSky: 夜空と星を描画
func drawNightSky(c *p5go.Canvas) {
	c.Background(30, 30, 40)
	for i := 0; i < STAR_COUNT; i++ {
		x := rand.Float64() * CANVAS_WIDTH
		y := rand.Float64() * (CANVAS_HEIGHT / 2)
		starSize := rand.Float64()*2 + 1
		brightness := 180 + rand.Intn(75)
		c.Fill(float64(brightness), float64(brightness), float64(brightness))
		c.Ellipse(x, y, starSize, starSize)
	}
}

// generateCityscape: レイヤー毎に建物群を描画
func generateCityscape(c *p5go.Canvas) {
	layers := 3
	// 建物スプライト（木は別扱い）
	sprites := [][][]int{
		highBuildingSprite1,
		commercialBuildingSprite,
		triangleBuildingSprite,
		towerSprite,
	}
	for layer := layers - 1; layer >= 0; layer-- {
		buildingCount := CANVAS_WIDTH / BUILDING_BASE_WIDTH
		for i := 0; i < buildingCount; i++ {
			x := float64(i)*BUILDING_BASE_WIDTH + float64(rand.Intn(20)-10)
			y := BASE_Y - float64(layer*30)
			scale := float64(SPRITE_SCALE)
			// 16ドット高さのスプライトを、下端が y に合うように描画
			selectedSprite := sprites[rand.Intn(len(sprites))]
			drawSprite(c, selectedSprite, x, y-16*scale, scale, layer)
		}
	}
}

// generateTrees: 地面に小さな木を描画（手前レイヤー）
// ここでは木スプライト（8×8）を TREE_SCALE で描画し、下端を地面（BASE_Y）に合わせます。
func generateTrees(c *p5go.Canvas) {
	for i := 0; i < TREE_COUNT; i++ {
		x := rand.Float64() * CANVAS_WIDTH
		y := BASE_Y - float64(len(treeSprite))*TREE_SCALE
		drawSprite(c, treeSprite, x, y, TREE_SCALE, 2)
	}
}

// generateMoon: 上空に月をドット絵で表示（3種類のうちランダムに選択）
func generateMoon(c *p5go.Canvas) {
	moonSprites := [][][]int{
		moonFullSprite,
		moonHalfSprite,
		moonCrescentSprite,
	}
	selectedMoon := moonSprites[rand.Intn(len(moonSprites))]
	moonWidth := len(selectedMoon[0])
	moonHeight := len(selectedMoon)
	// x はキャンバス右端に収まるように、y は上半分に配置
	x := rand.Float64() * (CANVAS_WIDTH - float64(moonWidth)*MOON_SCALE)
	y := rand.Float64() * ((CANVAS_HEIGHT / 2) - float64(moonHeight)*MOON_SCALE)
	drawSprite(c, selectedMoon, x, y, MOON_SCALE, 0)
}

// ─────────────────────────────
// main
func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(func(c *p5go.Canvas) {
			c.CreateCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
			c.NoStroke()
		}),
		p5go.Draw(func(c *p5go.Canvas) {
			c.NoLoop()
			drawNightSky(c)
			generateMoon(c)
			generateCityscape(c)
			generateTrees(c)
		}),
	)
	select {}
}
