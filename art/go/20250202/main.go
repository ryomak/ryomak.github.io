package main

import (
	"math"
	"syscall/js"

	"github.com/ryomak/p5go"
)

var (
	video                      js.Value // Webカメラ映像のグローバル変数
	prevPixels                 js.Value // 前フレームのピクセルデータ
	pointerX, pointerY         float64  // 重み付き平均から得た動体の位置
	smoothX, smoothY           float64  // EMA による滑らかな位置
	prevPointerX, prevPointerY float64  // 前フレームの滑らか位置（波発生用）
	waves                      []Wave   // 発生中の波エフェクト
)

const (
	cellSize          = 30    // セル単位のサイズ（ピクセル）
	threshold         = 100.0 // 差分とみなす閾値
	movementThreshold = 100.0 // 前フレームとの位置差がこれを超えたら波を発生
	smoothingFactor   = 0.3   // EMA の係数（0～1、値が大きいほど素早く追従）
)

// Wave は波エフェクトを表します
type Wave struct {
	x, y      float64 // 発生位置
	radius    float64 // 現在の半径
	alpha     float64 // 描画時の透明度（0～255）
	maxRadius float64 // 最大半径（例: 200）
}

func setup(c *p5go.Canvas) {
	// キャンバスサイズ 500x400
	c.CreateCanvas(500, 400)

	// Webカメラ映像の取得
	video = c.CreateCapture("VIDEO")
	video.Call("hide") // video要素自体は非表示

	// FPS を 7 に設定
	c.FrameRate(7)
}

func draw(c *p5go.Canvas) {
	// video のピクセルデータ更新
	video.Call("loadPixels")
	curPixels := video.Get("pixels")
	c.Background(0)

	width := int(c.Width())
	height := int(c.Height())

	var sumWeight, sumX, sumY float64

	// 前フレームとの差分から動いている部分の重み付き平均位置を算出
	if !prevPixels.IsUndefined() {
		for y := 0; y < height; y += cellSize {
			for x := 0; x < width; x += cellSize {
				index := (y*width + x) * 4
				rDiff := math.Abs(curPixels.Index(index).Float() - prevPixels.Index(index).Float())
				gDiff := math.Abs(curPixels.Index(index+1).Float() - prevPixels.Index(index+1).Float())
				bDiff := math.Abs(curPixels.Index(index+2).Float() - prevPixels.Index(index+2).Float())
				diff := rDiff + gDiff + bDiff

				if diff > threshold {
					sumX += float64(x) * diff
					sumY += float64(y) * diff
					sumWeight += diff
				}
			}
		}
	}

	// もし動いている部分があれば、重み付き平均位置を算出
	if sumWeight > 0 {
		pointerX = sumX / sumWeight
		pointerY = sumY / sumWeight

		// 初回の場合は EMA の初期値として設定
		if smoothX == 0 && smoothY == 0 {
			smoothX = pointerX
			smoothY = pointerY
		} else {
			// EMA を用いて滑らかに更新
			smoothX = (1-smoothingFactor)*smoothX + smoothingFactor*pointerX
			smoothY = (1-smoothingFactor)*smoothY + smoothingFactor*pointerY
		}
	} // 動きがなければ前回値を維持

	// 前フレームとの位置差があれば、波エフェクトを発生させる
	dx := smoothX - prevPointerX
	dy := smoothY - prevPointerY
	dist := math.Sqrt(dx*dx + dy*dy)
	if dist > movementThreshold {
		newWave := Wave{
			x:         smoothX,
			y:         smoothY,
			radius:    10,
			alpha:     255,
			maxRadius: 200,
		}
		waves = append(waves, newWave)
	}
	// 更新前の滑らかな位置を保存
	prevPointerX = smoothX
	prevPointerY = smoothY

	// 現在のピクセルデータを次回用に保存
	prevPixels = curPixels

	// 波エフェクトの更新＆描画
	newWaves := []Wave{}
	for _, wave := range waves {
		wave.radius += 10 // 拡大速度
		wave.alpha -= 25  // 消失速度
		if wave.alpha > 0 && wave.radius < wave.maxRadius {
			newWaves = append(newWaves, wave)
		}
		c.NoFill()
		c.Stroke(255, 0, 0, wave.alpha)
		c.Ellipse(wave.x, wave.y, wave.radius, wave.radius)
	}
	waves = newWaves

	// 滑らかに更新された動体の位置に小さな青い円を描画（ポインタ）
	c.NoStroke()
	c.Fill(0, 0, 255)
	c.Ellipse(smoothX, smoothY, 20, 20)
}

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
	)
	select {}
}
