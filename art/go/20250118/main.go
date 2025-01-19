package main

import (
	"fmt"
	"math/rand"
	"sort"
	"time"

	"github.com/ryomak/p5go"
)

const (
	cellSize    = 20
	canvasWidth = 300
	canvasHeight = 300
)

var (
	columnCount   int
	rowCount      int
	currentCells  [][]int
	nextCells     [][]int
	shapeColors   map[string][3]uint8 // 形状ごとの色を管理するマップ
)

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
		p5go.MousePressed(mousePressed),
	)
	select {}
}

func setup(p *p5go.Canvas) {
	p.FrameRate(10)
	p.CreateCanvas(canvasWidth, canvasHeight)

	columnCount = canvasWidth / cellSize
	rowCount = canvasHeight / cellSize

	// 配列を初期化
	currentCells = make2DArray(columnCount, rowCount)
	nextCells = make2DArray(columnCount, rowCount)

	shapeColors = make(map[string][3]uint8)

	// ボードをランダム化
	randomizeBoard()
}

// 2次元配列を作成する関数
func make2DArray(cols, rows int) [][]int {
	arr := make([][]int, cols)
	for i := range arr {
		arr[i] = make([]int, rows)
	}
	return arr
}

// ボードをランダム化（初期密度を制御）
func randomizeBoard() {
	rand.Seed(time.Now().UnixNano())
	for column := 0; column < columnCount; column++ {
		for row := 0; row < rowCount; row++ {
			// 初期密度を25%に設定
			if rand.Float64() < 0.25 {
				currentCells[column][row] = 1
			} else {
				currentCells[column][row] = 0
			}
		}
	}
}

func draw(p *p5go.Canvas) {
	p.Background(255)

	// 領域の ID と形状キーを割り当て
	regions, shapeKeys := assignRegions()

	// グリッドを描画
	for column := 0; column < columnCount; column++ {
		for row := 0; row < rowCount; row++ {
			cell := currentCells[column][row]
			if cell == 1 {
				shapeKey := shapeKeys[regions[column][row]]
				color := getColorForShape(shapeKey)
				p.Fill(color[0], color[1], color[2], 255)
			} else {
				// 死んだセルは薄いグレー
				p.Fill(220, 220, 220, 255)
			}
			p.Rect(float64(column*cellSize), float64(row*cellSize), float64(cellSize), float64(cellSize))
		}
	}

	// 次世代を生成
	generate()
}

func mousePressed(p *p5go.Canvas) {
	randomizeBoard()
}

// 次世代を生成
func generate() {
	for column := 0; column < columnCount; column++ {
		for row := 0; row < rowCount; row++ {
			// 周囲の生存セルを数える
			neighbours := countNeighbours(column, row)

			// ライフゲームのルールを適用
			if currentCells[column][row] == 1 { // 現在生存中のセル
				if neighbours < 2 || neighbours > 3 {
					nextCells[column][row] = 0 // 過疎または過密で死滅
				} else {
					nextCells[column][row] = 1 // 生存を維持
				}
			} else { // 現在死んでいるセル
				if neighbours == 3 {
					nextCells[column][row] = 1 // 誕生
				} else {
					nextCells[column][row] = 0 // 死のまま維持
				}
			}
		}
	}

	// 配列をスワップ
	currentCells, nextCells = nextCells, currentCells
}

// 周囲の生存セルを数える
func countNeighbours(column, row int) int {
	neighbours := 0
	for x := -1; x <= 1; x++ {
		for y := -1; y <= 1; y++ {
			if x == 0 && y == 0 {
				continue // 自分自身はカウントしない
			}
			col := (column + x + columnCount) % columnCount
			r := (row + y + rowCount) % rowCount
			neighbours += currentCells[col][r]
		}
	}
	return neighbours
}

// 領域を割り当てる
func assignRegions() ([][]int, map[int]string) {
	regionID := 0
	regions := make2DArray(columnCount, rowCount)
	shapeKeys := make(map[int]string)

	visited := make2DArray(columnCount, rowCount)

	// Flood Fill を使って領域を識別
	for column := 0; column < columnCount; column++ {
		for row := 0; row < rowCount; row++ {
			if currentCells[column][row] == 1 && regions[column][row] == 0 {
				regionID++
				shape := []string{}
				floodFill(column, row, regionID, regions, visited, &shape)
				shapeKeys[regionID] = calculateShapeKey(shape)
			}
		}
	}
	return regions, shapeKeys
}

// Flood Fill アルゴリズムで領域を塗りつぶし、形状を記録
func floodFill(column, row, regionID int, regions, visited [][]int, shape *[]string) {
	if column < 0 || column >= columnCount || row < 0 || row >= rowCount {
		return
	}
	if visited[column][row] == 1 || currentCells[column][row] == 0 {
		return
	}

	visited[column][row] = 1
	regions[column][row] = regionID

	// 形状の相対位置を記録
	*shape = append(*shape, fmt.Sprintf("%d,%d", column, row))

	// 周囲8方向に対して再帰的に処理
	directions := [][2]int{
		{-1, -1}, {0, -1}, {1, -1},
		{-1, 0}, {1, 0},
		{-1, 1}, {0, 1}, {1, 1},
	}
	for _, dir := range directions {
		floodFill(column+dir[0], row+dir[1], regionID, regions, visited, shape)
	}
}

// 形状キーを計算
func calculateShapeKey(shape []string) string {
	sort.Strings(shape) // 形状を一意にするためソート
	return fmt.Sprintf("%v", shape)
}

// 形状ごとの色を取得
func getColorForShape(shapeKey string) [3]uint8 {
	if color, exists := shapeColors[shapeKey]; exists {
		return color
	}
	newColor := randomColor()
	shapeColors[shapeKey] = newColor
	return newColor
}

// ランダムな色を生成
func randomColor() [3]uint8 {
	return [3]uint8{
		uint8(rand.Intn(200) + 50), // R: 明るい色
		uint8(rand.Intn(200) + 50), // G
		uint8(rand.Intn(200) + 50), // B
	}
}
