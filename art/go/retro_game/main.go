package main

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/ryomak/p5go"
)

var (
	p          *p5go.Canvas
	gameMode   int
	frameCount int
	pixelSize  = 4

	// Battle scene variables
	playerMonster   BattleMonster
	enemyMonster    BattleMonster
	battleState     string
	selectedAction  int
	battleAnimation BattleAnimation
	particles       []Particle
	shakeOffset     float64
	textAnimation   TextAnimation

	// Background effects
	backgroundGradient []color
	groundTiles        [][]int
)

type BattleMonster struct {
	name       string
	monsterType int
	x, y       float64
	hp, maxHP  int
	attack     int
	defense    int
	animOffset float64
	color      struct{ r, g, b uint8 }
	isPlayer   bool
}

type BattleAnimation struct {
	animType  string
	progress  float64
	targetX   float64
	targetY   float64
	duration  int
	intensity float64
}

type Particle struct {
	x, y      float64
	vx, vy    float64
	life      float64
	color     struct{ r, g, b, a uint8 }
	size      float64
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
	p.CreateCanvas(600, 600)
	p.FrameRate(30)

	initBattleScene()
}

func draw(canvas *p5go.Canvas) {
	p = canvas
	frameCount++

	drawBattleScene()
}

func mousePressed(canvas *p5go.Canvas) {
	p = canvas
	
	// Handle battle menu selection
	if battleState == "menu" {
		selectedAction = (selectedAction + 1) % 4
	} else if battleState == "idle" {
		// Start attack animation
		startAttackAnimation()
	}
}

func initBattleScene() {
	// Initialize monsters
	monsterNames := []string{"Pyrodon", "Aquafly", "Leafox", "Thunderat", "Crystaleon"}
	monsterColors := []struct{ r, g, b uint8 }{
		{255, 100, 50},  // Fire - red/orange
		{50, 150, 255},  // Water - blue
		{100, 255, 100}, // Grass - green
		{255, 255, 50},  // Electric - yellow
		{200, 100, 255}, // Psychic - purple
	}
	
	playerType := rand.Intn(5)
	playerMonster = BattleMonster{
		name:        monsterNames[playerType],
		monsterType: playerType,
		x:           150,
		y:           350,
		hp:          100,
		maxHP:       100,
		attack:      45,
		defense:     40,
		color:       monsterColors[playerType],
		isPlayer:    true,
	}
	
	enemyType := rand.Intn(5)
	enemyMonster = BattleMonster{
		name:        monsterNames[enemyType],
		monsterType: enemyType,
		x:           450,
		y:           200,
		hp:          100,
		maxHP:       100,
		attack:      40,
		defense:     35,
		color:       monsterColors[enemyType],
		isPlayer:    false,
	}
	
	battleState = "idle"
	selectedAction = 0
	particles = make([]Particle, 0)
	
	// Initialize background
	initBackground()
}

func initBackground() {
	// Create gradient colors for sky
	backgroundGradient = make([]color, 10)
	for i := range backgroundGradient {
		t := float64(i) / 9.0
		backgroundGradient[i] = color{
			r: uint8(120 + t*60),
			g: uint8(150 + t*50),
			b: uint8(200 - t*50),
		}
	}
	
	// Create ground pattern
	groundTiles = make([][]int, 10)
	for i := range groundTiles {
		groundTiles[i] = make([]int, 20)
		for j := range groundTiles[i] {
			groundTiles[i][j] = rand.Intn(3)
		}
	}
}

func drawBattleScene() {
	// Draw gradient background
	drawBattleBackground()
	
	// Update animations
	updateAnimations()
	
	// Update and draw particles
	updateParticles()
	
	// Draw ground/platform
	drawBattlePlatform()
	
	// Draw monsters with animation
	drawMonster(playerMonster, true)
	drawMonster(enemyMonster, false)
	
	// Draw battle effects
	if battleAnimation.animType != "" {
		drawBattleEffect()
	}
	
	// Draw UI
	drawBattleUI()
	
	// Draw text animation
	if textAnimation.text != "" {
		drawTextAnimation()
	}
}

func drawBattleBackground() {
	// Animated gradient background
	for i := 0; i < 10; i++ {
		t := float64(i) / 9.0
		offset := math.Sin(float64(frameCount)*0.01 + t*2) * 10
		
		c := backgroundGradient[i]
		p.Fill(c.r, c.g, c.b, 255)
		p.NoStroke()
		p.Rect(0, float64(i*60)+offset, 600, 60)
	}
}

func drawBattlePlatform() {
	// Draw battle ground with pattern
	groundY := 380.0
	
	// Main platform
	p.Fill(80, 60, 40, 255)
	p.NoStroke()
	p.Rect(0, groundY, 600, 220)
	
	// Platform details
	for i := 0; i < 20; i++ {
		for j := 0; j < 10; j++ {
			if groundTiles[j][i] == 1 {
				p.Fill(100, 80, 60, 200)
			} else if groundTiles[j][i] == 2 {
				p.Fill(60, 40, 20, 200)
			} else {
				continue
			}
			p.Rect(float64(i*30), groundY+float64(j*22), 28, 20)
		}
	}
	
	// Player platform
	p.Fill(120, 100, 80, 255)
	p.Ellipse(playerMonster.x, playerMonster.y+40, 120, 40)
	
	// Enemy platform
	p.Fill(100, 80, 60, 255)
	p.Ellipse(enemyMonster.x, enemyMonster.y+40, 100, 35)
}

func drawMonster(monster BattleMonster, isPlayer bool) {
	x := monster.x + shakeOffset
	y := monster.y + monster.animOffset
	
	if monster.hp <= 0 {
		return
	}
	
	// Draw based on monster type with detailed pixel art
	switch monster.monsterType {
	case 0: // Fire type - Dragon-like
		drawFireMonster(x, y, monster, isPlayer)
	case 1: // Water type - Fish-like
		drawWaterMonster(x, y, monster, isPlayer)
	case 2: // Grass type - Plant-like
		drawGrassMonster(x, y, monster, isPlayer)
	case 3: // Electric type - Mouse-like
		drawElectricMonster(x, y, monster, isPlayer)
	case 4: // Psychic type - Floating creature
		drawPsychicMonster(x, y, monster, isPlayer)
	}
}

func drawFireMonster(x, y float64, monster BattleMonster, isPlayer bool) {
	scale := 1.0
	if !isPlayer {
		scale = 0.8
	}
	
	// Body
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.NoStroke()
	p.Ellipse(x, y, 60*scale, 50*scale)
	
	// Belly
	p.Fill(255, 200, 150, 255)
	p.Ellipse(x, y+5*scale, 40*scale, 35*scale)
	
	// Head
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.Ellipse(x, y-25*scale, 45*scale, 40*scale)
	
	// Spikes on back
	for i := -2; i <= 2; i++ {
		spikeX := x + float64(i)*12*scale
		spikeY := y - 15*scale
		p.Triangle(
			spikeX, spikeY,
			spikeX-4*scale, spikeY+10*scale,
			spikeX+4*scale, spikeY+10*scale,
		)
	}
	
	// Eyes
	p.Fill(255, 255, 255, 255)
	p.Ellipse(x-10*scale, y-25*scale, 12*scale, 14*scale)
	p.Ellipse(x+10*scale, y-25*scale, 12*scale, 14*scale)
	
	p.Fill(0, 0, 0, 255)
	p.Ellipse(x-8*scale, y-25*scale, 6*scale, 8*scale)
	p.Ellipse(x+8*scale, y-25*scale, 6*scale, 8*scale)
	
	// Fire breath animation
	if frameCount%30 < 15 {
		for i := 0; i < 3; i++ {
			flameX := x + float64(15+i*5)*scale
			if !isPlayer {
				flameX = x - float64(15+i*5)*scale
			}
			flameY := y - 20*scale + math.Sin(float64(frameCount+i*10)*0.3)*3
			
			p.Fill(255, uint8(200-i*30), 0, uint8(200-i*40))
			p.Ellipse(flameX, flameY, float64(8-i*2)*scale, float64(10-i*2)*scale)
		}
	}
	
	// Tail
	tailWave := math.Sin(float64(frameCount)*0.1) * 5
	for i := 0; i < 4; i++ {
		tailX := x - float64(20+i*8)*scale
		if !isPlayer {
			tailX = x + float64(20+i*8)*scale
		}
		tailY := y + float64(10+i*3)*scale + tailWave*float64(i)/4
		
		p.Fill(monster.color.r-uint8(i*10), monster.color.g-uint8(i*10), monster.color.b, 255)
		p.Ellipse(tailX, tailY, float64(20-i*3)*scale, float64(18-i*3)*scale)
	}
	
	// Flame at tail tip
	flameX := x - 48*scale
	if !isPlayer {
		flameX = x + 48*scale
	}
	p.Fill(255, 150, 0, 200)
	p.Ellipse(flameX, y+20*scale+tailWave, 12*scale, 15*scale)
}

func drawWaterMonster(x, y float64, monster BattleMonster, isPlayer bool) {
	scale := 1.0
	if !isPlayer {
		scale = 0.8
	}
	
	// Swimming animation
	swim := math.Sin(float64(frameCount)*0.15) * 3
	
	// Body
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.NoStroke()
	p.Ellipse(x, y+swim, 55*scale, 45*scale)
	
	// Fins
	finFlap := math.Sin(float64(frameCount)*0.2) * 10
	
	// Side fins
	p.Fill(monster.color.r-30, monster.color.g-30, monster.color.b, 200)
	p.Triangle(
		x-25*scale, y+swim,
		x-40*scale-finFlap*scale, y-5*scale+swim,
		x-40*scale-finFlap*scale, y+15*scale+swim,
	)
	p.Triangle(
		x+25*scale, y+swim,
		x+40*scale+finFlap*scale, y-5*scale+swim,
		x+40*scale+finFlap*scale, y+15*scale+swim,
	)
	
	// Dorsal fin
	p.Triangle(
		x, y-22*scale+swim,
		x-8*scale, y-10*scale+swim,
		x+8*scale, y-10*scale+swim,
	)
	
	// Head
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.Ellipse(x, y-15*scale+swim, 40*scale, 35*scale)
	
	// Eyes
	p.Fill(255, 255, 255, 255)
	p.Ellipse(x-10*scale, y-15*scale+swim, 10*scale, 12*scale)
	p.Ellipse(x+10*scale, y-15*scale+swim, 10*scale, 12*scale)
	
	p.Fill(0, 0, 0, 255)
	p.Ellipse(x-8*scale, y-15*scale+swim, 5*scale, 6*scale)
	p.Ellipse(x+8*scale, y-15*scale+swim, 5*scale, 6*scale)
	
	// Bubbles
	for i := 0; i < 3; i++ {
		bubbleY := y - 30*scale - float64(i*15)*scale - float64(frameCount%60)
		bubbleX := x + math.Sin(float64(frameCount+i*30)*0.05)*10*scale
		
		if bubbleY > y-80*scale {
			p.Fill(200, 220, 255, 150)
			p.Ellipse(bubbleX, bubbleY, float64(5+i)*scale, float64(5+i)*scale)
		}
	}
	
	// Tail
	tailX := x - 30*scale
	if !isPlayer {
		tailX = x + 30*scale
	}
	p.Fill(monster.color.r-20, monster.color.g-20, monster.color.b, 255)
	p.Triangle(
		tailX, y+5*scale+swim,
		tailX-15*scale-finFlap*0.5*scale, y-5*scale+swim,
		tailX-15*scale-finFlap*0.5*scale, y+15*scale+swim,
	)
}

func drawGrassMonster(x, y float64, monster BattleMonster, isPlayer bool) {
	scale := 1.0
	if !isPlayer {
		scale = 0.8
	}
	
	// Bulb body
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.NoStroke()
	p.Ellipse(x, y, 50*scale, 40*scale)
	
	// Spots on body
	p.Fill(monster.color.r-30, monster.color.g-30, monster.color.b-30, 200)
	p.Ellipse(x-10*scale, y, 8*scale, 8*scale)
	p.Ellipse(x+8*scale, y+5*scale, 6*scale, 6*scale)
	p.Ellipse(x, y-8*scale, 7*scale, 7*scale)
	
	// Head
	p.Fill(monster.color.r+20, monster.color.g, monster.color.b+20, 255)
	p.Ellipse(x, y-20*scale, 35*scale, 30*scale)
	
	// Leaves on back - animated
	leafWave := math.Sin(float64(frameCount)*0.08) * 5
	for i := -1; i <= 1; i++ {
		leafX := x + float64(i)*15*scale
		leafY := y - 25*scale
		
		p.Fill(50, 200, 50, 255)
		p.Push()
		p.Translate(leafX, leafY)
		p.Rotate(float64(i)*0.3 + leafWave*0.02)
		
		// Leaf shape
		p.Ellipse(0, -10*scale, 8*scale, 20*scale)
		
		p.Pop()
	}
	
	// Flower on top
	flowerY := y - 40*scale + math.Sin(float64(frameCount)*0.1)*2
	
	// Petals
	for i := 0; i < 5; i++ {
		angle := float64(i) * 2 * math.Pi / 5
		petalX := x + math.Cos(angle)*12*scale
		petalY := flowerY + math.Sin(angle)*12*scale
		
		p.Fill(255, 150, 200, 255)
		p.Ellipse(petalX, petalY, 10*scale, 10*scale)
	}
	
	// Flower center
	p.Fill(255, 200, 50, 255)
	p.Ellipse(x, flowerY, 8*scale, 8*scale)
	
	// Eyes
	p.Fill(255, 255, 255, 255)
	p.Ellipse(x-8*scale, y-20*scale, 10*scale, 12*scale)
	p.Ellipse(x+8*scale, y-20*scale, 10*scale, 12*scale)
	
	p.Fill(0, 0, 0, 255)
	p.Ellipse(x-6*scale, y-20*scale, 4*scale, 5*scale)
	p.Ellipse(x+6*scale, y-20*scale, 4*scale, 5*scale)
	
	// Vines/roots
	for i := -2; i <= 2; i++ {
		if i == 0 {
			continue
		}
		vineX := x + float64(i)*12*scale
		vineY := y + 20*scale
		
		p.Stroke(50, 150, 50, 200)
		p.StrokeWeight(3 * scale)
		p.Line(vineX, vineY, vineX+float64(i)*5*scale, vineY+15*scale)
		p.NoStroke()
	}
}

func drawElectricMonster(x, y float64, monster BattleMonster, isPlayer bool) {
	scale := 1.0
	if !isPlayer {
		scale = 0.8
	}
	
	// Static electricity effect
	staticOffset := math.Sin(float64(frameCount)*0.3) * 2
	
	// Body
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.NoStroke()
	p.Ellipse(x, y+staticOffset, 45*scale, 40*scale)
	
	// Lightning bolt pattern on body
	p.Fill(255, 255, 100, 255)
	p.Push()
	p.Translate(x, y+staticOffset)
	
	// Draw zigzag pattern
	points := [][]float64{
		{0, -15}, {-5, -8}, {3, -5}, {-2, 0}, {5, 3}, {0, 8},
	}
	for i := 0; i < len(points)-1; i++ {
		p.StrokeWeight(3 * scale)
		p.Stroke(255, 255, 150, 255)
		p.Line(
			points[i][0]*scale, points[i][1]*scale,
			points[i+1][0]*scale, points[i+1][1]*scale,
		)
	}
	p.Pop()
	p.NoStroke()
	
	// Head with pointed ears
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.Ellipse(x, y-20*scale+staticOffset, 35*scale, 30*scale)
	
	// Ears
	p.Triangle(
		x-15*scale, y-25*scale+staticOffset,
		x-20*scale, y-40*scale+staticOffset,
		x-10*scale, y-35*scale+staticOffset,
	)
	p.Triangle(
		x+15*scale, y-25*scale+staticOffset,
		x+20*scale, y-40*scale+staticOffset,
		x+10*scale, y-35*scale+staticOffset,
	)
	
	// Ear tips (black)
	p.Fill(0, 0, 0, 255)
	p.Triangle(
		x-17*scale, y-35*scale+staticOffset,
		x-20*scale, y-40*scale+staticOffset,
		x-14*scale, y-37*scale+staticOffset,
	)
	p.Triangle(
		x+17*scale, y-35*scale+staticOffset,
		x+20*scale, y-40*scale+staticOffset,
		x+14*scale, y-37*scale+staticOffset,
	)
	
	// Eyes
	p.Fill(255, 255, 255, 255)
	p.Ellipse(x-8*scale, y-20*scale+staticOffset, 10*scale, 12*scale)
	p.Ellipse(x+8*scale, y-20*scale+staticOffset, 10*scale, 12*scale)
	
	p.Fill(0, 0, 0, 255)
	p.Ellipse(x-6*scale, y-20*scale+staticOffset, 5*scale, 6*scale)
	p.Ellipse(x+6*scale, y-20*scale+staticOffset, 5*scale, 6*scale)
	
	// Cheeks (red electrical pouches)
	p.Fill(255, 100, 100, 255)
	p.Ellipse(x-18*scale, y-15*scale+staticOffset, 8*scale, 8*scale)
	p.Ellipse(x+18*scale, y-15*scale+staticOffset, 8*scale, 8*scale)
	
	// Electric sparks around body
	if frameCount%10 < 5 {
		for i := 0; i < 4; i++ {
			angle := float64(i) * math.Pi / 2 + float64(frameCount)*0.1
			sparkX := x + math.Cos(angle)*35*scale
			sparkY := y + math.Sin(angle)*35*scale + staticOffset
			
			p.Fill(255, 255, 0, 200)
			p.Push()
			p.Translate(sparkX, sparkY)
			p.Rotate(angle)
			
			// Star-like spark
			for j := 0; j < 4; j++ {
				a := float64(j) * math.Pi / 2
				p.Line(0, 0, math.Cos(a)*8*scale, math.Sin(a)*8*scale)
			}
			
			p.Pop()
		}
	}
	
	// Tail (lightning bolt shaped)
	tailX := x - 25*scale
	if !isPlayer {
		tailX = x + 25*scale
	}
	
	p.Fill(monster.color.r-20, monster.color.g-20, monster.color.b-20, 255)
	p.Push()
	p.Translate(tailX, y+10*scale+staticOffset)
	
	// Lightning tail shape
	p.BeginShape()
	p.Vertex(0, 0)
	p.Vertex(-10*scale, -5*scale)
	p.Vertex(-8*scale, 0)
	p.Vertex(-15*scale, 5*scale)
	p.Vertex(-12*scale, 10*scale)
	p.Vertex(-5*scale, 8*scale)
	p.Vertex(0, 15*scale)
	p.EndShape()
	
	p.Pop()
}

func drawPsychicMonster(x, y float64, monster BattleMonster, isPlayer bool) {
	scale := 1.0
	if !isPlayer {
		scale = 0.8
	}
	
	// Floating animation
	float := math.Sin(float64(frameCount)*0.1) * 5
	rotation := math.Sin(float64(frameCount)*0.05) * 0.1
	
	y += float
	
	// Psychic aura
	for i := 3; i > 0; i-- {
		alpha := uint8(50 - i*10)
		size := float64(60+i*10) * scale
		
		p.Fill(200, 150, 255, alpha)
		p.NoStroke()
		p.Ellipse(x, y, size, size)
	}
	
	// Body
	p.Push()
	p.Translate(x, y)
	p.Rotate(rotation)
	
	p.Fill(monster.color.r, monster.color.g, monster.color.b, 255)
	p.Ellipse(0, 0, 45*scale, 50*scale)
	
	// Gem on forehead
	p.Fill(255, 100, 200, 255)
	p.Ellipse(0, -20*scale, 10*scale, 10*scale)
	p.Fill(255, 200, 250, 200)
	p.Ellipse(0, -20*scale, 6*scale, 6*scale)
	
	// Eyes (large and mysterious)
	p.Fill(255, 255, 255, 255)
	p.Ellipse(-10*scale, -5*scale, 14*scale, 16*scale)
	p.Ellipse(10*scale, -5*scale, 14*scale, 16*scale)
	
	// Psychic eyes effect
	eyeGlow := math.Sin(float64(frameCount)*0.2) * 50
	p.Fill(150, 100, 200, uint8(150+eyeGlow))
	p.Ellipse(-10*scale, -5*scale, 8*scale, 10*scale)
	p.Ellipse(10*scale, -5*scale, 8*scale, 10*scale)
	
	p.Fill(0, 0, 0, 255)
	p.Ellipse(-10*scale, -5*scale, 4*scale, 5*scale)
	p.Ellipse(10*scale, -5*scale, 4*scale, 5*scale)
	
	// Tail or tentacles
	for i := -1; i <= 1; i++ {
		tentacleX := float64(i) * 20 * scale
		tentacleY := 25 * scale
		
		wave := math.Sin(float64(frameCount)*0.15+float64(i)) * 5
		
		p.Fill(monster.color.r-30, monster.color.g-30, monster.color.b-30, 200)
		
		for j := 0; j < 3; j++ {
			segX := tentacleX + wave*float64(j)/3
			segY := tentacleY + float64(j)*10*scale
			segSize := (10 - float64(j)*2) * scale
			
			p.Ellipse(segX, segY, segSize, segSize)
		}
	}
	
	p.Pop()
	
	// Psychic particles orbiting
	for i := 0; i < 6; i++ {
		angle := float64(i)*math.Pi/3 + float64(frameCount)*0.05
		orbitRadius := 40 * scale
		particleX := x + math.Cos(angle)*orbitRadius
		particleY := y + math.Sin(angle)*orbitRadius
		
		p.Fill(255, 200, 255, 150)
		p.Ellipse(particleX, particleY, 5*scale, 5*scale)
	}
}

func updateAnimations() {
	// Update monster idle animations
	playerMonster.animOffset = math.Sin(float64(frameCount)*0.1) * 3
	enemyMonster.animOffset = math.Sin(float64(frameCount)*0.1+math.Pi) * 3
	
	// Update battle animation
	if battleAnimation.animType != "" {
		battleAnimation.progress += 1.0 / float64(battleAnimation.duration)
		
		if battleAnimation.animType == "attack" {
			if battleAnimation.progress < 0.5 {
				// Move towards target
				shakeOffset = math.Sin(battleAnimation.progress*math.Pi*4) * 5
			} else {
				// Impact and shake
				shakeOffset = math.Sin(battleAnimation.progress*math.Pi*8) * (1 - battleAnimation.progress) * 10
				
				// Create impact particles
				if int(battleAnimation.progress*float64(battleAnimation.duration))%3 == 0 {
					for i := 0; i < 5; i++ {
						angle := rand.Float64() * math.Pi * 2
						speed := rand.Float64()*5 + 2
						
						particles = append(particles, Particle{
							x:    battleAnimation.targetX,
							y:    battleAnimation.targetY,
							vx:   math.Cos(angle) * speed,
							vy:   math.Sin(angle) * speed,
							life: 1.0,
							color: struct{ r, g, b, a uint8 }{
								r: uint8(rand.Intn(55) + 200),
								g: uint8(rand.Intn(55) + 200),
								b: 100,
								a: 255,
							},
							size:         rand.Float64()*3 + 2,
							particleType: "impact",
						})
					}
				}
			}
		}
		
		if battleAnimation.progress >= 1.0 {
			battleAnimation.animType = ""
			shakeOffset = 0
		}
	}
	
	// Update text animation
	if textAnimation.text != "" {
		textAnimation.progress += 0.02
		
		if textAnimation.fadeOut && textAnimation.progress > 1.0 {
			textAnimation.text = ""
		}
	}
}

func updateParticles() {
	for i := len(particles) - 1; i >= 0; i-- {
		p := &particles[i]
		
		// Update position
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
		angle := float64(i) * 2 * math.Pi / 5 - math.Pi/2
		x1 := math.Cos(angle) * size
		y1 := math.Sin(angle) * size
		
		angle2 := angle + math.Pi/5
		x2 := math.Cos(angle2) * size * 0.5
		y2 := math.Sin(angle2) * size * 0.5
		
		p.Triangle(0, 0, x1, y1, x2, y2)
	}
	
	p.Pop()
}

func drawBattleEffect() {
	if battleAnimation.animType == "attack" {
		// Draw slash effect
		if battleAnimation.progress > 0.3 && battleAnimation.progress < 0.7 {
			alpha := uint8((0.7 - battleAnimation.progress) * 500)
			
			for i := 0; i < 3; i++ {
				offsetX := float64(i-1) * 15
				offsetY := float64(i-1) * 10
				
				p.Stroke(255, 255, 255, alpha-uint8(i*30))
				p.StrokeWeight(float64(5 - i))
				
				p.Line(
					battleAnimation.targetX-30+offsetX,
					battleAnimation.targetY-30+offsetY,
					battleAnimation.targetX+30+offsetX,
					battleAnimation.targetY+30+offsetY,
				)
			}
			p.NoStroke()
		}
	}
}

func drawBattleUI() {
	// Player HP bar
	drawHPBar(80, 500, playerMonster, true)
	
	// Enemy HP bar
	drawHPBar(400, 100, enemyMonster, false)
	
	// Battle menu
	if battleState == "menu" {
		drawBattleMenu()
	}
}

func drawHPBar(x, y float64, monster BattleMonster, isPlayer bool) {
	// Background
	p.Fill(0, 0, 0, 200)
	p.NoStroke()
	p.Rect(x-5, y-5, 160, 70)
	
	// Name
	p.Fill(255, 255, 255, 255)
	p.TextSize(14)
	p.Text(monster.name, x+5, y+15)
	
	// Level indicator
	p.Fill(200, 200, 200, 255)
	p.Text("Lv.25", x+110, y+15)
	
	// HP text
	p.TextSize(10)
	p.Text("HP", x+5, y+35)
	
	// HP bar background
	p.Fill(50, 50, 50, 255)
	p.Rect(x+25, y+25, 120, 12)
	
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
	p.Rect(x+25, y+25, 120*hpPercent, 12)
	
	// HP numbers
	if isPlayer {
		p.Fill(255, 255, 255, 255)
		p.TextSize(10)
		p.Text(fmt.Sprintf("%d/%d", monster.hp, monster.maxHP), x+60, y+50)
	}
	
	// Experience bar for player
	if isPlayer {
		p.Fill(50, 50, 50, 255)
		p.Rect(x+25, y+45, 120, 4)
		
		p.Fill(100, 150, 255, 255)
		p.Rect(x+25, y+45, 80, 4)
	}
}

func drawBattleMenu() {
	// Menu background
	p.Fill(0, 0, 0, 220)
	p.NoStroke()
	p.Rect(300, 450, 280, 130)
	
	// Menu options
	options := []string{"FIGHT", "POKEMON", "BAG", "RUN"}
	positions := [][]float64{
		{330, 480}, {450, 480},
		{330, 530}, {450, 530},
	}
	
	for i, option := range options {
		x := positions[i][0]
		y := positions[i][1]
		
		// Highlight selected option
		if i == selectedAction {
			p.Fill(255, 200, 0, 100)
			p.Rect(x-20, y-20, 100, 35)
			
			// Animated cursor
			cursorX := x - 30 + math.Sin(float64(frameCount)*0.2)*3
			p.Fill(255, 255, 0, 255)
			p.Triangle(
				cursorX, y-5,
				cursorX-8, y-10,
				cursorX-8, y,
			)
		}
		
		p.Fill(255, 255, 255, 255)
		p.TextSize(16)
		p.Text(option, x, y)
	}
	
	// Info text
	p.Fill(200, 200, 200, 255)
	p.TextSize(12)
	p.Text("What will " + playerMonster.name + " do?", 320, 570)
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

func startAttackAnimation() {
	battleAnimation = BattleAnimation{
		animType:  "attack",
		progress:  0,
		targetX:   enemyMonster.x,
		targetY:   enemyMonster.y,
		duration:  60,
		intensity: 1.0,
	}
	
	// Damage calculation
	damage := playerMonster.attack - enemyMonster.defense/2
	if damage < 1 {
		damage = 1
	}
	
	enemyMonster.hp -= damage
	if enemyMonster.hp < 0 {
		enemyMonster.hp = 0
	}
	
	// Show damage text
	textAnimation = TextAnimation{
		text:    fmt.Sprintf("-%d", damage),
		x:       enemyMonster.x - 10,
		y:       enemyMonster.y - 30,
		progress: 0,
		fadeOut: true,
		color:   struct{ r, g, b uint8 }{255, 100, 100},
	}
	
	// Enemy counter attack after delay
	if enemyMonster.hp > 0 {
		// Simplified - in real game this would be scheduled
		battleState = "enemy_turn"
	}
}