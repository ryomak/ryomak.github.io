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
	pixelSize  = 4

	// Space shooter variables
	stars     []Star
	spaceShip SpaceShip
	lasers    []Laser
	invaders  []Invader
	score     int

	// Dungeon variables
	hero     Hero
	monsters []Monster
	gems     []Gem
	dungeon  [][]int
	gridSize = 20
)

type Star struct {
	x, y  float64
	speed float64
	size  float64
}

type SpaceShip struct {
	x, y float64
}

type Laser struct {
	x, y   float64
	active bool
}

type Invader struct {
	x, y    float64
	active  bool
	invType int
}

type Hero struct {
	x, y int
	hp   int
}

type Monster struct {
	x, y   int
	mType  int
	active bool
}

type Gem struct {
	x, y      int
	collected bool
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

	rand.Seed(time.Now().UnixNano())
	gameMode = 0

	initSpaceGame()
	initDungeonGame()
}

func draw(canvas *p5go.Canvas) {
	p = canvas
	frameCount++

	// Switch between game modes every 300 frames
	if frameCount%300 == 0 {
		gameMode = (gameMode + 1) % 3
	}

	switch gameMode {
	case 0:
		drawSpaceShooter()
	case 1:
		drawDungeon()
	case 2:
		drawRacing()
	}
}

func mousePressed(canvas *p5go.Canvas) {
	p = canvas
	gameMode = (gameMode + 1) % 3
}

// Space Shooter Game
func initSpaceGame() {
	stars = make([]Star, 30)
	for i := range stars {
		stars[i] = Star{
			x:     rand.Float64() * 600,
			y:     rand.Float64() * 600,
			speed: rand.Float64()*2 + 0.5,
			size:  rand.Float64()*2 + 1,
		}
	}

	spaceShip = SpaceShip{x: 300, y: 500}
	lasers = make([]Laser, 0)
	invaders = make([]Invader, 0)

	// Create invaders
	for i := 0; i < 5; i++ {
		for j := 0; j < 3; j++ {
			invaders = append(invaders, Invader{
				x:       float64(100 + i*80),
				y:       float64(50 + j*50),
				active:  true,
				invType: j,
			})
		}
	}
}

func drawSpaceShooter() {
	// Space background
	p.Background(10, 5, 20)

	// Draw stars
	for i := range stars {
		stars[i].y += stars[i].speed
		if stars[i].y > 600 {
			stars[i].y = 0
			stars[i].x = rand.Float64() * 600
		}

		brightness := uint8(stars[i].size * 100)
		p.Fill(brightness, brightness, brightness+50, 255)
		p.NoStroke()
		p.Rect(stars[i].x, stars[i].y, stars[i].size*float64(pixelSize), stars[i].size*float64(pixelSize))
	}

	// Move spaceship
	spaceShip.x = 300 + math.Sin(float64(frameCount)*0.05)*150

	// Draw spaceship
	p.Fill(0, 255, 200, 255)
	p.NoStroke()
	// Body
	p.Rect(spaceShip.x-10, spaceShip.y, 20, 30)
	// Wings
	p.Triangle(spaceShip.x-20, spaceShip.y+20, spaceShip.x-10, spaceShip.y, spaceShip.x-10, spaceShip.y+20)
	p.Triangle(spaceShip.x+20, spaceShip.y+20, spaceShip.x+10, spaceShip.y, spaceShip.x+10, spaceShip.y+20)
	// Cockpit
	p.Fill(100, 150, 200, 200)
	p.Rect(spaceShip.x-6, spaceShip.y+5, 12, 8)

	// Auto shoot
	if frameCount%15 == 0 {
		lasers = append(lasers, Laser{x: spaceShip.x, y: spaceShip.y, active: true})
	}

	// Update and draw lasers
	p.Fill(255, 255, 0, 255)
	for i := range lasers {
		if !lasers[i].active {
			continue
		}
		lasers[i].y -= 8
		p.Rect(lasers[i].x-2, lasers[i].y, 4, 12)

		if lasers[i].y < 0 {
			lasers[i].active = false
		}

		// Check collision with invaders
		for j := range invaders {
			if invaders[j].active &&
				math.Abs(lasers[i].x-invaders[j].x) < 20 &&
				math.Abs(lasers[i].y-invaders[j].y) < 20 {
				invaders[j].active = false
				lasers[i].active = false
				score += 100
				drawExplosion(invaders[j].x, invaders[j].y)
			}
		}
	}

	// Update and draw invaders
	for i := range invaders {
		if !invaders[i].active {
			continue
		}

		// Movement pattern
		invaders[i].x += math.Sin(float64(frameCount)*0.02+float64(i)) * 2
		invaders[i].y += 0.3

		// Draw based on type
		switch invaders[i].invType {
		case 0:
			p.Fill(255, 100, 100, 255)
			drawPixelInvader1(invaders[i].x, invaders[i].y)
		case 1:
			p.Fill(100, 255, 100, 255)
			drawPixelInvader2(invaders[i].x, invaders[i].y)
		case 2:
			p.Fill(100, 100, 255, 255)
			drawPixelInvader3(invaders[i].x, invaders[i].y)
		}

		// Respawn at top
		if invaders[i].y > 600 {
			invaders[i].y = -50
			invaders[i].x = rand.Float64()*500 + 50
			invaders[i].active = true
		}
	}

	// Draw score
	p.Fill(255, 255, 255, 255)
	p.TextSize(16)
	p.Text(fmt.Sprintf("SCORE: %d", score), 10, 30)
}

func drawPixelInvader1(x, y float64) {
	// Classic space invader shape
	p.Rect(x-8, y-8, 16, 4)
	p.Rect(x-12, y-4, 24, 4)
	p.Rect(x-16, y, 32, 4)
	p.Rect(x-12, y+4, 8, 4)
	p.Rect(x+4, y+4, 8, 4)

	// Eyes
	p.Fill(255, 255, 255, 255)
	p.Rect(x-8, y-4, 4, 4)
	p.Rect(x+4, y-4, 4, 4)
}

func drawPixelInvader2(x, y float64) {
	// UFO shape
	p.Ellipse(x, y, 24, 12)
	p.Rect(x-8, y-8, 16, 8)

	// Lights
	if frameCount%20 < 10 {
		p.Fill(255, 255, 0, 200)
		p.Ellipse(x-8, y, 4, 4)
		p.Ellipse(x, y, 4, 4)
		p.Ellipse(x+8, y, 4, 4)
	}
}

func drawPixelInvader3(x, y float64) {
	// Octopus shape

	// Body
	p.Rect(x-6, y-6, 12, 12)

	// Tentacles
	for i := 0; i < 4; i++ {
		tentX := x + float64(i-2)*6
		tentY := y + 6 + math.Sin(float64(frameCount)*0.1+float64(i))*3
		p.Rect(tentX, tentY, 3, 8)
	}
}

func drawExplosion(x, y float64) {
	for i := 0; i < 8; i++ {
		angle := float64(i) * math.Pi / 4
		dist := 10.0
		px := x + math.Cos(angle)*dist
		py := y + math.Sin(angle)*dist

		p.Fill(255, uint8(200-i*20), 0, 200)
		p.Rect(px-2, py-2, 4, 4)
	}
}

// Dungeon Game
func initDungeonGame() {
	gridSize = 20
	dungeon = make([][]int, gridSize)
	for i := range dungeon {
		dungeon[i] = make([]int, gridSize)
		for j := range dungeon[i] {
			if i == 0 || i == gridSize-1 || j == 0 || j == gridSize-1 {
				dungeon[i][j] = 1 // Wall
			} else if rand.Float64() < 0.1 {
				dungeon[i][j] = 1 // Random walls
			}
		}
	}

	hero = Hero{x: 10, y: 10, hp: 5}

	monsters = make([]Monster, 0)
	for i := 0; i < 5; i++ {
		monsters = append(monsters, Monster{
			x:      rand.Intn(gridSize-2) + 1,
			y:      rand.Intn(gridSize-2) + 1,
			mType:  rand.Intn(3),
			active: true,
		})
	}

	gems = make([]Gem, 0)
	for i := 0; i < 3; i++ {
		gems = append(gems, Gem{
			x: rand.Intn(gridSize-2) + 1,
			y: rand.Intn(gridSize-2) + 1,
		})
	}
}

func drawDungeon() {
	p.Background(20, 15, 30)

	cellSize := 30.0

	// Draw dungeon
	for i := 0; i < gridSize; i++ {
		for j := 0; j < gridSize; j++ {
			x := float64(j) * cellSize
			y := float64(i) * cellSize

			if dungeon[i][j] == 1 {
				// Wall
				p.Fill(60, 50, 70, 255)
				p.NoStroke()
				p.Rect(x, y, cellSize, cellSize)

				// Brick pattern
				p.Stroke(40, 35, 50, 255)
				p.StrokeWeight(1)
				if (i+j)%2 == 0 {
					p.Line(x+cellSize/2, y, x+cellSize/2, y+cellSize)
				}
			} else {
				// Floor
				p.Fill(30, 25, 35, 255)
				p.NoStroke()
				p.Rect(x, y, cellSize, cellSize)
			}
		}
	}

	// Move hero automatically
	if frameCount%20 == 0 {
		direction := rand.Intn(4)
		newX, newY := hero.x, hero.y

		switch direction {
		case 0:
			newY--
		case 1:
			newY++
		case 2:
			newX--
		case 3:
			newX++
		}

		if newX >= 0 && newX < gridSize && newY >= 0 && newY < gridSize {
			if dungeon[newY][newX] == 0 {
				hero.x = newX
				hero.y = newY
			}
		}
	}

	// Draw gems
	for i := range gems {
		if gems[i].collected {
			continue
		}

		x := float64(gems[i].x)*cellSize + cellSize/2
		y := float64(gems[i].y)*cellSize + cellSize/2

		// Gem sparkle
		sparkle := math.Sin(float64(frameCount)*0.1) * 50
		p.Fill(255, 200+uint8(sparkle), 0, 255)
		p.NoStroke()

		// Diamond shape
		p.Triangle(x, y-8, x-6, y, x+6, y)
		p.Triangle(x, y+8, x-6, y, x+6, y)

		// Check collection
		if hero.x == gems[i].x && hero.y == gems[i].y {
			gems[i].collected = true
			score += 50
		}
	}

	// Draw monsters
	for i := range monsters {
		if !monsters[i].active {
			continue
		}

		// Move monsters
		if frameCount%30 == 0 {
			direction := rand.Intn(4)
			newX, newY := monsters[i].x, monsters[i].y

			switch direction {
			case 0:
				newY--
			case 1:
				newY++
			case 2:
				newX--
			case 3:
				newX++
			}

			if newX >= 0 && newX < gridSize && newY >= 0 && newY < gridSize {
				if dungeon[newY][newX] == 0 {
					monsters[i].x = newX
					monsters[i].y = newY
				}
			}
		}

		x := float64(monsters[i].x)*cellSize + cellSize/2
		y := float64(monsters[i].y)*cellSize + cellSize/2

		// Draw based on type
		switch monsters[i].mType {
		case 0: // Slime
			p.Fill(100, 255, 100, 200)
			bounce := math.Sin(float64(frameCount)*0.15) * 2
			p.Ellipse(x, y+bounce, 20, 15)

			// Eyes
			p.Fill(0, 0, 0, 255)
			p.Rect(x-5, y-2+bounce, 3, 3)
			p.Rect(x+2, y-2+bounce, 3, 3)

		case 1: // Ghost
			p.Fill(200, 200, 255, 150)
			float := math.Sin(float64(frameCount)*0.1) * 3
			p.Ellipse(x, y+float, 18, 20)

			// Wavy bottom
			for j := 0; j < 3; j++ {
				p.Ellipse(x+float64(j-1)*6, y+10+float, 6, 8)
			}

			// Eyes
			p.Fill(255, 0, 0, 255)
			p.Ellipse(x-4, y-2+float, 3, 3)
			p.Ellipse(x+4, y-2+float, 3, 3)

		case 2: // Bat
			p.Fill(100, 50, 150, 255)
			wingFlap := math.Sin(float64(frameCount)*0.3) * 5

			// Body
			p.Ellipse(x, y, 10, 8)

			// Wings
			p.Triangle(x-5, y, x-15-wingFlap, y-5, x-15-wingFlap, y+5)
			p.Triangle(x+5, y, x+15+wingFlap, y-5, x+15+wingFlap, y+5)
		}

		// Check collision with hero
		if monsters[i].x == hero.x && monsters[i].y == hero.y {
			monsters[i].active = false
			drawExplosion(x, y)
		}
	}

	// Draw hero
	x := float64(hero.x)*cellSize + cellSize/2
	y := float64(hero.y)*cellSize + cellSize/2

	// Hero sprite
	p.Fill(100, 150, 255, 255)
	p.NoStroke()
	p.Rect(x-6, y-6, 12, 12)

	// Sword
	p.Fill(200, 200, 200, 255)
	swordAngle := float64(frameCount) * 0.1
	swordX := x + math.Cos(swordAngle)*10
	swordY := y + math.Sin(swordAngle)*10
	p.Rect(swordX-1, swordY-8, 2, 16)

	// UI
	p.Fill(255, 255, 255, 255)
	p.TextSize(14)
	p.Text(fmt.Sprintf("HP: %d  GEMS: %d", hero.hp, score), 10, 580)
}

// Racing Game
func drawRacing() {
	// Sky gradient
	for i := 0; i < 100; i++ {
		p.Fill(uint8(10+i/2), uint8(5+i/3), uint8(30+i), 255)
		p.NoStroke()
		p.Rect(0, float64(i*6), 600, 6)
	}

	// Road
	roadWidth := 300.0
	roadX := 150.0

	p.Fill(40, 40, 45, 255)
	p.Rect(roadX, 0, roadWidth, 600)

	// Road lines
	p.Stroke(255, 255, 100, 200)
	p.StrokeWeight(2)
	offset := float64(frameCount * 5 % 60)
	for y := -60.0; y < 600; y += 60 {
		p.Line(roadX+100, y+offset, roadX+100, y+offset+30)
		p.Line(roadX+200, y+offset, roadX+200, y+offset+30)
	}

	// Side buildings
	for i := 0; i < 10; i++ {
		buildingY := float64(i*60) - offset

		// Left buildings
		p.Fill(20, 20, 30, 255)
		p.NoStroke()
		p.Rect(20, buildingY, 80, 50)

		// Windows
		if frameCount%40 < 30 {
			p.Fill(255, 200, 100, 150)
			for w := 0; w < 3; w++ {
				for h := 0; h < 2; h++ {
					p.Rect(30+float64(w)*20, buildingY+10+float64(h)*20, 10, 10)
				}
			}
		}

		// Right buildings
		p.Fill(30, 20, 40, 255)
		p.Rect(500, buildingY+20, 80, 50)

		// Windows
		if frameCount%50 < 35 {
			p.Fill(100, 200, 255, 150)
			for w := 0; w < 3; w++ {
				for h := 0; h < 2; h++ {
					p.Rect(510+float64(w)*20, buildingY+30+float64(h)*20, 10, 10)
				}
			}
		}
	}

	// Car position
	carX := 300.0 + math.Sin(float64(frameCount)*0.05)*70
	carY := 450.0

	// Draw car
	p.Fill(255, 50, 50, 255)
	p.NoStroke()

	// Car body
	p.Rect(carX-15, carY-10, 30, 40)

	// Windshield
	p.Fill(100, 150, 200, 200)
	p.Rect(carX-10, carY-5, 20, 12)

	// Wheels
	p.Fill(30, 30, 30, 255)
	p.Rect(carX-18, carY, 5, 10)
	p.Rect(carX+13, carY, 5, 10)
	p.Rect(carX-18, carY+20, 5, 10)
	p.Rect(carX+13, carY+20, 5, 10)

	// Headlights
	if frameCount%10 < 5 {
		p.Fill(255, 255, 200, 200)
		p.Ellipse(carX-10, carY-12, 5, 5)
		p.Ellipse(carX+10, carY-12, 5, 5)
	}

	// Exhaust
	for i := 0; i < 3; i++ {
		alpha := uint8(150 - i*40)
		p.Fill(150, 150, 150, alpha)
		p.Ellipse(carX, carY+35+float64(i)*5, float64(5+i*2), float64(5+i*2))
	}

	// Speed lines
	p.Stroke(255, 255, 255, 100)
	p.StrokeWeight(1)
	for i := 0; i < 5; i++ {
		lineY := rand.Float64()*200 + 300
		p.Line(0, lineY, 600, lineY)
	}

	// UI
	p.Fill(0, 0, 0, 180)
	p.NoStroke()
	p.Rect(10, 10, 150, 60)

	p.Fill(255, 255, 255, 255)
	p.TextSize(14)
	speed := int(math.Abs(math.Sin(float64(frameCount)*0.02)) * 200)
	p.Text(fmt.Sprintf("SPEED: %d km/h", speed), 20, 35)
	p.Text(fmt.Sprintf("SCORE: %d", score), 20, 55)
}
