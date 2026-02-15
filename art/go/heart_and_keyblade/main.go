package main

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

func setup(p *p5go.Canvas) {
	p.CreateCanvas(400, 400)
	p.FrameRate(30)
}

func draw(p *p5go.Canvas) {
	p.Background("#0A0A2E")

	(&keyblade{x: 200, y: 224, angle: math.Pi / 5}).draw(p)
	(&keyblade{x: 200, y: 224, angle: -math.Pi / 5}).draw(p)

	(&heart{x: 200, y: 176, size: 44, color: "#1E6FD9"}).draw(p)

	(&crown{x: 200, y: 128, size: 64, color: "#FFD700"}).draw(p)
}

// ==================== heart ====================

type heart struct {
	x, y  float64
	size  float64
	color string
}

func (h *heart) draw(p *p5go.Canvas) {
	h.drawBody(p)
	h.drawScrolls(p)
}

func (h *heart) drawBody(p *p5go.Canvas) {
	p.Push()
	p.Translate(h.x, h.y)
	p.NoStroke()

	p.Fill("#0D3B8C")
	h.drawShape(p, h.size*1.08)

	p.Fill(h.color)
	h.drawShape(p, h.size)

	p.Fill("#3A8FFF")
	h.drawShape(p, h.size*0.6)

	p.Fill("#6BB3FF")
	h.drawShape(p, h.size*0.25)

	p.Pop()
}

func (h *heart) drawShape(p *p5go.Canvas, size float64) {
	w := size * 0.55
	ht := size * 0.5

	p.BeginShape()
	p.Vertex(0, ht*1.4)
	p.BezierVertex(w*0.3, ht*0.9, w*1.15, ht*0.2, w*1.0, -ht*0.2)
	p.BezierVertex(w*0.85, -ht*0.7, w*0.2, -ht*0.85, 0, -ht*0.5)
	p.BezierVertex(-w*0.2, -ht*0.85, -w*0.85, -ht*0.7, -w*1.0, -ht*0.2)
	p.BezierVertex(-w*1.15, ht*0.2, -w*0.3, ht*0.9, 0, ht*1.4)
	p.EndShape(p5go.CLOSE)
}

func (h *heart) drawScrolls(p *p5go.Canvas) {
	p.Push()
	p.Translate(h.x, h.y)

	for _, isLeft := range []bool{true, false} {
		p.NoFill()
		p.StrokeCap(p5go.ROUND)

		p.Stroke("#0D3B8C")
		p.StrokeWeight(h.size * 0.14)
		h.drawScroll(p, isLeft)

		p.Stroke(h.color)
		p.StrokeWeight(h.size * 0.09)
		h.drawScroll(p, isLeft)
	}

	p.Pop()
}

func (h *heart) drawScroll(p *p5go.Canvas, isLeft bool) {
	s := h.size

	var centerX, startAngle, angleDir float64
	if isLeft {
		centerX = -s * 0.55
		startAngle = 1.25
		angleDir = 1.0
	} else {
		centerX = s * 0.55
		startAngle = math.Pi - 1.25
		angleDir = -1.0
	}

	centerY := -s * 0.55
	initialR := s * 0.29
	decay := 0.18

	p.BeginShape()
	for t := 0.0; t <= math.Pi*3.0; t += 0.05 {
		r := initialR * math.Exp(-decay*t)
		angle := startAngle + angleDir*t
		x := centerX + r*math.Cos(angle)
		y := centerY + r*math.Sin(angle)
		p.Vertex(x, y)
	}
	p.EndShape()
}

// ==================== crown ====================

type crown struct {
	x, y  float64
	size  float64
	color string
}

func (c *crown) draw(p *p5go.Canvas) {
	p.Push()
	p.Translate(c.x, c.y)

	halfW := c.size * 0.55
	baseH := c.size * 0.3
	spikeH := c.size * 0.55

	p.Fill(c.color)
	p.NoStroke()
	p.BeginShape()
	p.Vertex(-halfW, 0)
	p.Vertex(-halfW*0.7, -baseH)
	p.Vertex(-halfW*0.5, -baseH-spikeH*0.65)
	p.Vertex(-halfW*0.2, -baseH*0.7)
	p.Vertex(0, -baseH-spikeH)
	p.Vertex(halfW*0.2, -baseH*0.7)
	p.Vertex(halfW*0.5, -baseH-spikeH*0.65)
	p.Vertex(halfW*0.7, -baseH)
	p.Vertex(halfW, 0)
	p.EndShape(p5go.CLOSE)

	p.Pop()
}

// ==================== keyblade ====================

type keyblade struct {
	x, y  float64
	angle float64
}

func (k *keyblade) draw(p *p5go.Canvas) {
	p.Push()
	p.Translate(k.x, k.y)
	p.Rotate(k.angle)

	halfLen := 96.0
	shaftW := 8.0

	p.Fill("#A8A8A8")
	p.Stroke("#808080")
	p.StrokeWeight(1)
	p.Rect(-shaftW/2, -halfLen, shaftW, halfLen*2)

	p.Fill("#D0D0D0")
	p.NoStroke()
	p.Rect(-1.6, -halfLen, 3.2, halfLen*2)

	k.drawTeeth(p, 0, halfLen)
	k.drawGuard(p, 0, -halfLen)
	k.drawChain(p, 0, -halfLen-6)

	p.Pop()
}

func (k *keyblade) drawTeeth(p *p5go.Canvas, cx, cy float64) {
	p.Push()
	p.Translate(cx, cy)

	p.Fill("#A8A8A8")
	p.Stroke("#808080")
	p.StrokeWeight(1)

	barW := 35.0
	barH := 6.4
	p.Rect(-barW/2, 0, barW, barH)

	prongW := 7.2
	prongH := 22.4
	gap := 3.2

	p.Rect(-barW/2, barH, prongW, prongH)
	p.Rect(-barW/2+prongW+gap, barH, prongW, prongH*0.65)
	p.Rect(barW/2-2*prongW-gap, barH, prongW, prongH*0.65)
	p.Rect(barW/2-prongW, barH, prongW, prongH)

	p.Fill("#D0D0D0")
	p.NoStroke()
	p.Rect(-barW/2+1.6, 1.6, barW-3.2, barH-3.2)

	p.Pop()
}

func (k *keyblade) drawGuard(p *p5go.Canvas, cx, cy float64) {
	p.Push()
	p.Translate(cx, cy)

	wingW := 14.4
	wingH := 25.6

	p.Fill("#FFD700")
	p.Stroke("#DAA520")
	p.StrokeWeight(1)

	p.Rect(-wingW-9.6, -wingH/2, wingW, wingH)
	p.Rect(9.6, -wingH/2, wingW, wingH)

	p.Rect(-wingW-12, -wingH/2-4.8, wingW+4.8, 6.4)
	p.Rect(7.2, -wingH/2-4.8, wingW+4.8, 6.4)

	p.Fill("#FF3333")
	p.NoStroke()
	p.Circle(0, 0, 6.4)
	p.Fill("#FF7777")
	p.Circle(-0.8, -0.8, 2.4)

	p.Pop()
}

func (k *keyblade) drawChain(p *p5go.Canvas, cx, cy float64) {
	p.Push()
	p.Translate(cx, cy)

	p.NoFill()
	p.Stroke("#B0B0B0")
	p.StrokeWeight(1.2)
	for i := 0.0; i < 14.4; i += 4.8 {
		p.Ellipse(0, -i-2.4, 3.2, 4.8)
	}

	my := -19.2
	p.Fill("#FFD700")
	p.NoStroke()
	p.Circle(0, my, 8.8)
	p.Circle(-4.4, my-4.8, 5.6)
	p.Circle(4.4, my-4.8, 5.6)

	p.Pop()
}
