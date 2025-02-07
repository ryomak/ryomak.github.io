package main

import (
	"math"
	"math/rand"

	"github.com/ryomak/p5go"
)

const (
	canvasWidth  = 400
	canvasHeight = 400
	frameRate    = 30

	maxCells  = 30   // 細胞の最大数
	minRadius = 5    // 細胞がこれ以下になったらリセットする
	maxSize   = 50.0 // 成長フェーズの上限サイズ。これ以上になると縮小フェーズに移行

	// 個体ごとのパラメータの設定範囲
	divisionThresholdMin = 2.0 // 分裂閾値の下限（秒）
	divisionThresholdMax = 4.0 // 分裂閾値の上限（秒）
	growthRateMin        = 2.0 // 成長速度の下限
	growthRateMax        = 3.0 // 成長速度の上限
	shrinkRateMin        = 2.0 // 縮小速度の下限
	shrinkRateMax        = 3.0 // 縮小速度の上限
	speedFactorMin       = 2.0 // 移動速度係数の下限
	speedFactorMax       = 4.0 // 移動速度係数の上限

	// 細胞間相互作用のパラメータ
	repulsionConstant  = 0.5 // 近すぎる場合の反発力
	attractionConstant = 0.5 // わずかな引力（重力的な効果として強めに設定）
)

// Cell は細胞の状態を表します。
type Cell struct {
	x, y              float64  // 位置（中心）
	r                 float64  // 半径
	age               float64  // 経過時間（秒）
	divisionThreshold float64  // 分裂までの時間（秒）
	vx, vy            float64  // 速度
	color             [3]uint8 // 細胞の色
	isShrinking       bool     // false: 成長フェーズ, true: 縮小フェーズ

	growthRate  float64 // 個体ごとの成長速度
	shrinkRate  float64 // 個体ごとの縮小速度
	speedFactor float64 // 個体ごとの移動速度係数
}

// mutateColor は、与えられた色に±20のランダムな変動を加えた色を返します。
func mutateColor(c [3]uint8) [3]uint8 {
	delta := 20
	r := int(c[0]) + rand.Intn(delta*2+1) - delta
	g := int(c[1]) + rand.Intn(delta*2+1) - delta
	b := int(c[2]) + rand.Intn(delta*2+1) - delta
	if r < 0 {
		r = 0
	} else if r > 255 {
		r = 255
	}
	if g < 0 {
		g = 0
	} else if g > 255 {
		g = 255
	}
	if b < 0 {
		b = 0
	} else if b > 255 {
		b = 255
	}
	return [3]uint8{uint8(r), uint8(g), uint8(b)}
}

// Update は、dt秒分だけセルの状態を更新します。
// 分裂・縮小・成長・移動などを処理し、必要ならシミュレーション全体に新たな細胞を追加します。
func (c *Cell) Update(dt float64, sim *Simulation) {
	// 年齢更新
	c.age += dt

	// 成長フェーズか縮小フェーズかで、半径の更新方法を切り替え
	if !c.isShrinking {
		c.r += c.growthRate * dt
	} else {
		c.r -= c.shrinkRate * dt
	}

	// 位置更新（速度に個体ごとの speedFactor をかける）
	c.x += c.vx * dt * c.speedFactor
	c.y += c.vy * dt * c.speedFactor

	// 画面端で反射
	if c.x < c.r {
		c.x = c.r
		c.vx = -c.vx
	} else if c.x > canvasWidth-c.r {
		c.x = canvasWidth - c.r
		c.vx = -c.vx
	}
	if c.y < c.r {
		c.y = c.r
		c.vy = -c.vy
	} else if c.y > canvasHeight-c.r {
		c.y = canvasHeight - c.r
		c.vy = -c.vy
	}

	// 成長フェーズ中で、最大サイズに達したら縮小フェーズへ
	if !c.isShrinking && c.r >= maxSize {
		c.isShrinking = true
	}

	// 分裂イベント：年齢が閾値を超え、かつ全体細胞数が maxCells 未満なら分裂
	if c.age >= c.divisionThreshold && len(sim.cells) < maxCells {
		// 分裂時、元の細胞はリセット（半径70%に縮小、年齢リセット、成長フェーズに戻す）
		c.age = 0
		c.r *= 0.7
		c.divisionThreshold = randomInRange(divisionThresholdMin, divisionThresholdMax)
		c.isShrinking = false

		// 新たな細胞を元の細胞の近傍に生成
		newCell := Cell{
			x:                 c.x + (rand.Float64()*2-1)*c.r,
			y:                 c.y + (rand.Float64()*2-1)*c.r,
			r:                 c.r,
			age:               0,
			divisionThreshold: randomInRange(divisionThresholdMin, divisionThresholdMax),
			vx:                (rand.Float64()*2 - 1) * 40,
			vy:                (rand.Float64()*2 - 1) * 40,
			color:             mutateColor(c.color),
			isShrinking:       false,
			growthRate:        randomInRange(growthRateMin, growthRateMax),
			shrinkRate:        randomInRange(shrinkRateMin, shrinkRateMax),
			speedFactor:       randomInRange(speedFactorMin, speedFactorMax),
		}
		sim.cells = append(sim.cells, newCell)
	}

	// もし縮小フェーズ中で半径が minRadius 以下になったら、リセットして再び成長フェーズに戻す
	if c.isShrinking && c.r < minRadius {
		c.r = 20
		c.age = 0
		c.isShrinking = false
		c.divisionThreshold = randomInRange(divisionThresholdMin, divisionThresholdMax)
		c.vx = (rand.Float64()*2 - 1) * 40
		c.vy = (rand.Float64()*2 - 1) * 40
		c.growthRate = randomInRange(growthRateMin, growthRateMax)
		c.shrinkRate = randomInRange(shrinkRateMin, shrinkRateMax)
		c.speedFactor = randomInRange(speedFactorMin, speedFactorMax)
		// 色はそのまま
	}
}

// Simulation はシミュレーション全体の状態を管理します。
type Simulation struct {
	cells []Cell
}

// NewSimulation は、中央に1個の初期細胞を配置して Simulation を生成します。
func NewSimulation() *Simulation {
	sim := &Simulation{
		cells: make([]Cell, 0),
	}
	initialCell := Cell{
		x:                 canvasWidth / 2,
		y:                 canvasHeight / 2,
		r:                 20,
		age:               0,
		divisionThreshold: randomInRange(divisionThresholdMin, divisionThresholdMax),
		vx:                (rand.Float64()*2 - 1) * 40,
		vy:                (rand.Float64()*2 - 1) * 40,
		color:             [3]uint8{uint8(rand.Intn(256)), uint8(rand.Intn(256)), uint8(rand.Intn(256))},
		isShrinking:       false,
		growthRate:        randomInRange(growthRateMin, growthRateMax),
		shrinkRate:        randomInRange(shrinkRateMin, shrinkRateMax),
		speedFactor:       randomInRange(speedFactorMin, speedFactorMax),
	}
	sim.cells = append(sim.cells, initialCell)
	return sim
}

// Update は、dt秒分だけシミュレーション全体の状態を更新します。
// まず、細胞間の相互作用（反発・引力）を計算し、各細胞の速度に反映した後、各細胞の Update を呼び出します。
func (sim *Simulation) Update(dt float64) {
	n := len(sim.cells)
	// 1. 細胞間相互作用の力計算
	type force struct {
		fx, fy float64
	}
	forces := make([]force, n)
	for i := 0; i < n; i++ {
		forces[i] = force{0, 0}
	}
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			dx := sim.cells[i].x - sim.cells[j].x
			dy := sim.cells[i].y - sim.cells[j].y
			d := math.Hypot(dx, dy)
			if d < 0.001 {
				continue
			}
			desired := sim.cells[i].r + sim.cells[j].r
			if d < desired { // 重なっているなら反発
				overlap := (desired - d)
				f := overlap * repulsionConstant
				fx := (dx / d) * f
				fy := (dy / d) * f
				forces[i].fx += fx
				forces[i].fy += fy
				forces[j].fx -= fx
				forces[j].fy -= fy
			} else if d < desired*2 { // わずかに離れているなら引力
				f := (d - desired) * attractionConstant
				fx := (dx / d) * f
				fy := (dy / d) * f
				forces[i].fx -= fx
				forces[i].fy -= fy
				forces[j].fx += fx
				forces[j].fy += fy
			}
		}
	}
	for i := 0; i < n; i++ {
		sim.cells[i].vx += forces[i].fx * dt
		sim.cells[i].vy += forces[i].fy * dt
	}

	// 2. 各細胞の Update を呼び出す
	for i := 0; i < n; i++ {
		sim.cells[i].Update(dt, sim)
	}
}

// Draw は、各細胞をキャンバスに描画します。
func (sim *Simulation) Draw(p *p5go.Canvas) {
	for _, cell := range sim.cells {
		p.Fill(float64(cell.color[0]), float64(cell.color[1]), float64(cell.color[2]), 200)
		p.NoStroke()
		p.Ellipse(cell.x, cell.y, cell.r*2, cell.r*2)
	}
}

// randomInRange は、min以上max未満のランダムな値を返します。
func randomInRange(min, max float64) float64 {
	return min + rand.Float64()*(max-min)
}

func main() {
	sim := NewSimulation()
	p5go.Run("#canvas-detail",
		p5go.Setup(func(p *p5go.Canvas) {
			p.CreateCanvas(canvasWidth, canvasHeight)
			p.FrameRate(frameRate)
		}),
		p5go.Draw(func(p *p5go.Canvas) {
			dt := 1.0 / float64(frameRate)
			sim.Update(dt)
			p.Background(0)
			sim.Draw(p)
		}),
	)
	select {}
}
