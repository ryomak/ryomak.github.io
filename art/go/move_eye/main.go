package main

import (
	"fmt"
    "math"
    "math/rand"

	"github.com/ryomak/p5go"
)

func main() {
	p5go.Run("#canvas-detail",
		p5go.Setup(setup),
		p5go.Draw(draw),
	)
	select {}
}

var faces []*face

func setup(p *p5go.Canvas) {
    canvas := 300
	p.CreateCanvas(canvas, canvas)
	p.ColorMode(p5go.HSB)
	width := 100
	for x := 0; x < canvas; x += width {
		for y := 0; y < canvas; y += width {
			color := fmt.Sprintf("hsb(%d, 100%%, 100%%)", rand.Intn(360))

			f := &face{
				width:  float64(width),
				height: float64(width),
				color:  color,
				x:      float64(x),
				y:      float64(y),
			}
			faces = append(faces, f)
		}
	}
}

func draw(p *p5go.Canvas) {
	for _, f := range faces {
		f.draw(p)
	}
}

type face struct {
	width  float64
	height float64
	color  string

	x, y float64
}

// eye は目を描画する
func (f *face) eye(p *p5go.Canvas, x, y float64) {
	angle := p.Atan2(p.MouseY()-y, p.MouseX()-x)
	p.NoStroke()

	p.Push()
	p.Translate(x, y)
	p.Fill("white")                             // 白目
	p.Ellipse(0, 0, 0.25*f.width, 0.25*f.width) // 白目部分を描画

	p.Rotate(angle)
	p.Fill(f.color)                                            // 黒目
	p.Ellipse(0.0625*f.width, 0, 0.125*f.width, 0.125*f.width) // 黒目部分を描画
	p.Pop()
}

// mouth は口を描画する
func (f *face) mouth(p *p5go.Canvas) {
	distance := math.Hypot(p.MouseX()-f.x-f.width/2, p.MouseY()-f.y-f.height/2)

	// 距離を 0 から 200 の範囲に補正し、滑らかな変化をつける
	clampedDistance := math.Min(math.Max(distance, 0), 200)
	ratio := 1 - clampedDistance/200 // 0 に近いほど楕円、1 に近いほど三日月

	p.Push()
	p.NoStroke()
	p.Translate(f.x+f.width/2, f.y+0.75*f.height)

	p.Fill("white")
	startAngle := 0.0
	endAngle := math.Pi
	p.Arc(0, 0, 0.5*f.width, 0.25*f.height*ratio, startAngle, endAngle)
	p.Pop()
}

func (f *face) draw(p *p5go.Canvas) {
	p.Fill(f.color)
	p.Rect(f.x, f.y, f.width, f.height)

	// left eye
	f.eye(p, 0.375*f.width+f.x, 0.5*f.height+f.y)

	// right eye
	f.eye(p, 0.625*f.width+f.x, 0.5*f.height+f.y)

	f.mouth(p)
}

