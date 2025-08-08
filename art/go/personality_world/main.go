package main

import (
	"math"
	"math/rand"
	"strings"
	
	"github.com/ryomak/p5go"
)

const (
	CANVAS_WIDTH  = 400
	CANVAS_HEIGHT = 400
	PIXEL_SIZE    = 4  // ドットアートスタイル
	ROOM_SIZE     = 140 // 立方体の部屋
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
	hasBackrest  bool // チェア用
	hasArmrests  bool // チェア用
	isRare       bool // レアアイテムかどうか
	rarity       string // "common", "rare", "epic", "legendary"
}

type PixelEffect struct {
	x, y       float64
	size       float64
	color      [3]float64
	life       int
	effectType string
}

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
	initializePersonality()
	initializePalette()
	generateRoom()
}

func draw(canvas *p5go.Canvas) {
	p = canvas
	drawScene()
}

func initializePersonality() {
	// MBTIタイプをランダムに生成
	types := []string{
		"INTJ", "INTP", "ENTJ", "ENTP",
		"INFJ", "INFP", "ENFJ", "ENFP",
		"ISTJ", "ISFJ", "ESTJ", "ESFJ",
		"ISTP", "ISFP", "ESTP", "ESFP",
	}
	mbtiType = types[rand.Intn(len(types))]
	
	// 財産レベルをランダムに生成
	wealthLevel = rand.Intn(101)
	
	// MBTI次元を解析
	isExtrovert = strings.HasPrefix(mbtiType, "E")
	isSensing = strings.Contains(mbtiType, "S")
	isThinking = strings.Contains(mbtiType, "T")
	isJudging = strings.HasSuffix(mbtiType, "J")
}

func initializePalette() {
	// MBTIタイプに基づいてカラーパレットを生成
	baseHue := float64(hashString(mbtiType)) / float64(1<<32) * 360
	
	palette = make(map[string][3]float64)
	
	// 壁・床の色
	palette["wall_back"] = hsvToRGB(baseHue, 0.15, 0.85)
	palette["wall_left"] = hsvToRGB(baseHue, 0.18, 0.75)
	palette["wall_right"] = hsvToRGB(baseHue, 0.20, 0.70)
	palette["floor_light"] = hsvToRGB(baseHue+20, 0.25, 0.90)
	palette["floor_dark"] = hsvToRGB(baseHue+20, 0.30, 0.85)
	
	// 家具の色
	palette["furniture_main"] = hsvToRGB(baseHue+180, 0.35, 0.60)
	palette["furniture_accent"] = hsvToRGB(baseHue+120, 0.40, 0.50)
	palette["furniture_sub"] = hsvToRGB(baseHue+60, 0.25, 0.70)
	
	// その他の要素
	palette["tech"] = hsvToRGB(220, 0.15, 0.30)
	palette["plant"] = hsvToRGB(120, 0.60, 0.50)
	palette["decoration"] = hsvToRGB(baseHue+90, 0.45, 0.65)
}

func generateRoom() {
	roomElements = []RoomElement{}
	
	// MBTIに基づいた部屋レイアウト（シンプル版）
	if isThinking && isJudging {
		generateOrganizedOffice()
	} else if isThinking && !isJudging {
		generateCreativeWorkspace()
	} else if !isThinking && isJudging {
		generateCozyOrganizedLiving()
	} else {
		generateArtisticSpace()
	}
	
	// レアアイテムを生成
	generateRareItems()
}

func generateOrganizedOffice() {
	// ISTJ/ESTJ: 整理されたオフィス
	
	// デスク（裕福度でサイズ変化）
	deskSize := 40.0 + float64(wealthLevel)*0.2
	roomElements = append(roomElements, RoomElement{
		x: 40, y: 0, z: 20,
		width: deskSize, height: 28, depth: 30,
		elementType: "desk",
		color: "furniture_main",
	})
	
	// モニター（裕福ならデュアル）
	if wealthLevel > 60 {
		roomElements = append(roomElements, RoomElement{
			x: 45, y: 28, z: 22,
			width: 25, height: 18, depth: 4,
			elementType: "monitor",
			color: "tech",
		})
		roomElements = append(roomElements, RoomElement{
			x: 72, y: 28, z: 22,
			width: 25, height: 18, depth: 4,
			elementType: "monitor",
			color: "tech",
		})
	} else {
		roomElements = append(roomElements, RoomElement{
			x: 50, y: 28, z: 22,
			width: 30, height: 18, depth: 4,
			elementType: "monitor",
			color: "tech",
		})
	}
	
	// チェア（裕福度でアームレスト追加）
	roomElements = append(roomElements, RoomElement{
		x: 50, y: 0, z: 55,
		width: 25, height: 28, depth: 25,
		elementType: "chair",
		color: "furniture_accent",
		hasBackrest: true,
		hasArmrests: wealthLevel > 50,
	})
	
	// 本棚（Jタイプなので必須）
	roomElements = append(roomElements, RoomElement{
		x: 5, y: 0, z: 30,
		width: 20, height: 50, depth: 15,
		elementType: "shelf",
		color: "furniture_sub",
	})
	
	// 植物（感情的な人は大きめ）
	plantSize := 30.0
	if !isThinking {
		plantSize = 40.0
	}
	roomElements = append(roomElements, RoomElement{
		x: 100, y: 0, z: 25,
		width: 12, height: plantSize, depth: 12,
		elementType: "plant",
		color: "plant",
	})
	
	// 裕福度に応じた追加アイテム
	if wealthLevel > 70 {
		// 高級時計
		roomElements = append(roomElements, RoomElement{
			x: 60, y: 60, z: 2,
			width: 25, height: 25, depth: 3,
			elementType: "clock",
			color: "decoration",
		})
		// 賞状
		roomElements = append(roomElements, RoomElement{
			x: 15, y: 50, z: 32,
			width: 8, height: 15, depth: 5,
			elementType: "trophy",
			color: "decoration",
		})
	} else if wealthLevel > 40 {
		// シンプルな時計
		roomElements = append(roomElements, RoomElement{
			x: 60, y: 60, z: 2,
			width: 20, height: 20, depth: 3,
			elementType: "clock",
			color: "decoration",
		})
	}
}

func generateCreativeWorkspace() {
	// INTP/ENTP: 創造的なワークスペース
	
	// L字デスク（Pタイプなので大きめ）
	roomElements = append(roomElements, RoomElement{
		x: 30, y: 0, z: 20,
		width: 60, height: 26, depth: 35,
		elementType: "desk",
		color: "furniture_main",
	})
	
	// モニター（裕福度で数が変わる）
	if wealthLevel > 70 {
		// トリプルモニター
		for i := 0; i < 3; i++ {
			roomElements = append(roomElements, RoomElement{
				x: 30 + float64(i)*20, y: 26, z: 23,
				width: 18, height: 16, depth: 4,
				elementType: "monitor",
				color: "tech",
			})
		}
	} else if wealthLevel > 40 {
		// デュアルモニター
		roomElements = append(roomElements, RoomElement{
			x: 35, y: 26, z: 23,
			width: 25, height: 18, depth: 4,
			elementType: "monitor",
			color: "tech",
		})
		roomElements = append(roomElements, RoomElement{
			x: 65, y: 26, z: 23,
			width: 25, height: 18, depth: 4,
			elementType: "monitor",
			color: "tech",
		})
	} else {
		// シングルモニター
		roomElements = append(roomElements, RoomElement{
			x: 50, y: 26, z: 23,
			width: 30, height: 18, depth: 4,
			elementType: "monitor",
			color: "tech",
		})
	}
	
	// ゲーミングチェア（Pタイプなので快適重視）
	roomElements = append(roomElements, RoomElement{
		x: 50, y: 0, z: 60,
		width: 28, height: 32, depth: 28,
		elementType: "chair",
		color: "furniture_accent",
		hasBackrest: true,
		hasArmrests: true,
	})
	
	// 創造的なアイテム
	if !isSensing { // Nタイプはより創造的
		// ギター
		roomElements = append(roomElements, RoomElement{
			x: 100, y: 0, z: 30,
			width: 12, height: 45, depth: 8,
			elementType: "guitar",
			color: "decoration",
		})
		
		// 抽象絵画
		roomElements = append(roomElements, RoomElement{
			x: 50, y: 50, z: 2,
			width: 35, height: 30, depth: 2,
			elementType: "painting",
			color: "decoration",
		})
	}
	
	// スピーカー（裕福なら大きい）
	if wealthLevel > 50 {
		roomElements = append(roomElements, RoomElement{
			x: 15, y: 26, z: 25,
			width: 10, height: 15, depth: 10,
			elementType: "speaker",
			color: "tech",
		})
		roomElements = append(roomElements, RoomElement{
			x: 95, y: 26, z: 25,
			width: 10, height: 15, depth: 10,
			elementType: "speaker",
			color: "tech",
		})
	}
	
	// 散らかった本（Pタイプの特徴）
	if !isJudging {
		for i := 0; i < 3; i++ {
			roomElements = append(roomElements, RoomElement{
				x: 70 + float64(i)*8, y: float64(i)*3, z: 70 + float64(i)*5,
				width: 8, height: 3, depth: 6,
				elementType: "book",
				color: "decoration",
			})
		}
	}
}

func generateCozyOrganizedLiving() {
	// L字ソファ
	roomElements = append(roomElements, RoomElement{
		x: 30, y: 0, z: 25,
		width: 60, height: 28, depth: 35,
		elementType: "sofa",
		color: "furniture_main",
	})
	
	// サイドソファ
	roomElements = append(roomElements, RoomElement{
		x: 25, y: 0, z: 60,
		width: 35, height: 28, depth: 30,
		elementType: "sofa",
		color: "furniture_main",
	})
	
	// テーブル
	roomElements = append(roomElements, RoomElement{
		x: 50, y: 0, z: 75,
		width: 35, height: 16, depth: 25,
		elementType: "table",
		color: "furniture_accent",
	})
	
	// テレビ
	roomElements = append(roomElements, RoomElement{
		x: 95, y: 20, z: 20,
		width: 35, height: 22, depth: 5,
		elementType: "tv",
		color: "tech",
	})
	
	// TVスタンド
	roomElements = append(roomElements, RoomElement{
		x: 92, y: 0, z: 18,
		width: 40, height: 20, depth: 10,
		elementType: "tv_stand",
		color: "furniture_sub",
	})
	
	// 植物
	roomElements = append(roomElements, RoomElement{
		x: 10, y: 0, z: 30,
		width: 12, height: 40, depth: 12,
		elementType: "plant",
		color: "plant",
	})
	
	// ランプ
	if wealthLevel > 40 {
		roomElements = append(roomElements, RoomElement{
			x: 110, y: 0, z: 80,
			width: 8, height: 50, depth: 8,
			elementType: "lamp",
			color: "decoration",
		})
	}
}

func generateArtisticSpace() {
	// 低いソファ
	roomElements = append(roomElements, RoomElement{
		x: 25, y: 0, z: 35,
		width: 50, height: 22, depth: 30,
		elementType: "sofa",
		color: "furniture_main",
	})
	
	// アートテーブル
	roomElements = append(roomElements, RoomElement{
		x: 80, y: 0, z: 40,
		width: 35, height: 25, depth: 25,
		elementType: "table",
		color: "furniture_accent",
	})
	
	// イーゼル
	roomElements = append(roomElements, RoomElement{
		x: 95, y: 0, z: 15,
		width: 8, height: 45, depth: 20,
		elementType: "easel",
		color: "decoration",
	})
	
	// 絵画（複数）
	roomElements = append(roomElements, RoomElement{
		x: 30, y: 45, z: 2,
		width: 25, height: 20, depth: 2,
		elementType: "painting",
		color: "decoration",
	})
	
	roomElements = append(roomElements, RoomElement{
		x: 60, y: 50, z: 2,
		width: 30, height: 25, depth: 2,
		elementType: "painting",
		color: "decoration",
	})
	
	// 植物
	roomElements = append(roomElements, RoomElement{
		x: 10, y: 0, z: 70,
		width: 15, height: 45, depth: 15,
		elementType: "plant",
		color: "plant",
	})
	
	// ギター
	if !isJudging {
		roomElements = append(roomElements, RoomElement{
			x: 110, y: 0, z: 60,
			width: 12, height: 40, depth: 8,
			elementType: "guitar",
			color: "decoration",
		})
	}
}

func drawScene() {
	p.Background(240, 240, 245, 255)
	drawRoom()
	drawRoomElements()
	drawMBTIInfo()
}

func drawRoom() {
	roomX := float64(CANVAS_WIDTH/2 + 70)
	roomY := float64(CANVAS_HEIGHT/2 + 70)
	
	drawFloor(roomX, roomY)
	drawWalls(roomX, roomY)
}

func drawWalls(roomX, roomY float64) {
	// 背面の壁
	wallColor := palette["wall_back"]
	p.Fill(wallColor[0], wallColor[1], wallColor[2], 255)
	
	for x := 0.0; x < ROOM_SIZE; x += PIXEL_SIZE*2 {
		for y := ROOM_SIZE; y > 0; y -= PIXEL_SIZE*2 {
			isoX, isoY := toIsometric(x, float64(y), 0)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
	
	// 左の壁
	wallColor = palette["wall_left"]
	p.Fill(wallColor[0], wallColor[1], wallColor[2], 255)
	
	for z := 0.0; z < ROOM_SIZE; z += PIXEL_SIZE*2 {
		for y := ROOM_SIZE; y > 0; y -= PIXEL_SIZE*2 {
			isoX, isoY := toIsometric(0, float64(y), z)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
}

func drawFloor(roomX, roomY float64) {
	tileSize := 20.0
	for i := 0.0; i < ROOM_SIZE/tileSize; i++ {
		for j := 0.0; j < ROOM_SIZE/tileSize; j++ {
			colorKey := "floor_light"
			if int(i+j)%2 == 0 {
				colorKey = "floor_dark"
			}
			
			for px := 0.0; px < tileSize; px += PIXEL_SIZE {
				for pz := 0.0; pz < tileSize; pz += PIXEL_SIZE {
					isoX, isoY := toIsometric(i*tileSize+px, 0, j*tileSize+pz)
					color := palette[colorKey]
					p.Fill(color[0], color[1], color[2], 255)
					p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
				}
			}
		}
	}
}

func drawRoomElements() {
	roomX := float64(CANVAS_WIDTH/2 + 70)
	roomY := float64(CANVAS_HEIGHT/2 + 70)
	
	// 深度ソート
	for i := 0; i < len(roomElements)-1; i++ {
		for j := 0; j < len(roomElements)-i-1; j++ {
			depth1 := roomElements[j].x + roomElements[j].z
			depth2 := roomElements[j+1].x + roomElements[j+1].z
			if depth1 > depth2 {
				roomElements[j], roomElements[j+1] = roomElements[j+1], roomElements[j]
			}
		}
	}
	
	for _, elem := range roomElements {
		drawPixelFurniture(roomX, roomY, elem)
	}
}

func drawPixelFurniture(roomX, roomY float64, elem RoomElement) {
	switch elem.elementType {
	case "desk", "table":
		drawPixelDesk(roomX, roomY, elem)
	case "chair":
		drawPixelChair(roomX, roomY, elem)
	case "sofa":
		drawPixelSofa(roomX, roomY, elem)
	case "monitor":
		drawPixelMonitor(roomX, roomY, elem)
	case "tv":
		drawPixelTV(roomX, roomY, elem)
	case "plant":
		drawPixelPlant(roomX, roomY, elem)
	case "shelf":
		drawPixelShelf(roomX, roomY, elem)
	case "painting":
		drawPixelPainting(roomX, roomY, elem)
	case "easel":
		drawPixelEasel(roomX, roomY, elem)
	case "guitar":
		drawPixelGuitar(roomX, roomY, elem)
	case "tv_stand":
		drawPixelTVStand(roomX, roomY, elem)
	case "speaker":
		drawPixelSpeaker(roomX, roomY, elem)
	case "lamp":
		drawPixelLamp(roomX, roomY, elem)
	case "clock":
		drawPixelClock(roomX, roomY, elem)
	case "trophy":
		drawPixelTrophy(roomX, roomY, elem)
	case "book":
		drawPixelBook(roomX, roomY, elem)
	case "diamond":
		drawPixelDiamond(roomX, roomY, elem)
	case "crystal":
		drawPixelCrystal(roomX, roomY, elem)
	case "goldbar":
		drawPixelGoldBar(roomX, roomY, elem)
	case "artifact":
		drawPixelArtifact(roomX, roomY, elem)
	case "quantum_computer":
		drawPixelQuantumComputer(roomX, roomY, elem)
	case "hologram":
		drawPixelHologram(roomX, roomY, elem)
	case "timemachine":
		drawPixelTimeMachine(roomX, roomY, elem)
	default:
		drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z, 
			elem.width, elem.height, elem.depth, elem.color)
	}
}

func drawPixelBox(roomX, roomY, x, y, z, width, height, depth float64, colorKey string) {
	color := palette[colorKey]
	p.Fill(color[0], color[1], color[2], 255)
	p.NoStroke()
	
	// 前面
	for px := 0.0; px < width; px += PIXEL_SIZE {
		for py := 0.0; py < height; py += PIXEL_SIZE {
			isoX, isoY := toIsometric(x+px, y+py, z+depth)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// 上面
	brightness := 1.15
	p.Fill(color[0]*brightness, color[1]*brightness, color[2]*brightness, 255)
	for px := 0.0; px < width; px += PIXEL_SIZE {
		for pz := 0.0; pz < depth; pz += PIXEL_SIZE {
			isoX, isoY := toIsometric(x+px, y+height, z+pz)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// 右側面
	brightness = 0.85
	p.Fill(color[0]*brightness, color[1]*brightness, color[2]*brightness, 255)
	for pz := 0.0; pz < depth; pz += PIXEL_SIZE {
		for py := 0.0; py < height; py += PIXEL_SIZE {
			isoX, isoY := toIsometric(x+width, y+py, z+pz)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
}

func drawPixelDesk(roomX, roomY float64, elem RoomElement) {
	// 天板
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.8, elem.z,
		elem.width, elem.height*0.2, elem.depth, elem.color)
	
	// 脚
	legPositions := [][2]float64{
		{elem.x + 3, elem.z + 3},
		{elem.x + elem.width - 6, elem.z + 3},
		{elem.x + 3, elem.z + elem.depth - 6},
		{elem.x + elem.width - 6, elem.z + elem.depth - 6},
	}
	
	for _, pos := range legPositions {
		drawPixelBox(roomX, roomY, pos[0], elem.y, pos[1],
			3, elem.height*0.8, 3, "furniture_sub")
	}
}

func drawPixelChair(roomX, roomY float64, elem RoomElement) {
	// 座面
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.5, elem.z,
		elem.width, elem.height*0.1, elem.depth, elem.color)
	
	// 背もたれ
	if elem.hasBackrest {
		drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.5, elem.z,
			elem.width, elem.height*0.5, 3, elem.color)
	}
	
	// 脚
	legPositions := [][2]float64{
		{elem.x + 2, elem.z + 2},
		{elem.x + elem.width - 5, elem.z + 2},
		{elem.x + 2, elem.z + elem.depth - 5},
		{elem.x + elem.width - 5, elem.z + elem.depth - 5},
	}
	
	for _, pos := range legPositions {
		drawPixelBox(roomX, roomY, pos[0], elem.y, pos[1],
			3, elem.height*0.5, 3, "furniture_sub")
	}
}

func drawPixelSofa(roomX, roomY float64, elem RoomElement) {
	// 座面
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.5, elem.depth, elem.color)
	
	// 背もたれ
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.5, elem.z,
		elem.width, elem.height*0.5, elem.depth*0.3, elem.color)
}

func drawPixelMonitor(roomX, roomY float64, elem RoomElement) {
	// 画面
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// スタンド
	drawPixelBox(roomX, roomY, elem.x+elem.width/2-3, elem.y-8, elem.z+elem.depth/2-2,
		6, 8, 4, "furniture_sub")
}

func drawPixelTV(roomX, roomY float64, elem RoomElement) {
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

func drawPixelPlant(roomX, roomY float64, elem RoomElement) {
	// 鉢（テラコッタ風）
	potColor := palette["furniture_sub"]
	p.Fill(potColor[0]*0.8, potColor[1]*0.6, potColor[2]*0.5, 255)
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.25, elem.depth, "furniture_sub")
	
	// 幹
	stemX := elem.x + elem.width/2 - 2
	stemZ := elem.z + elem.depth/2 - 2
	p.Fill(101, 67, 33, 255) // 茶色の幹
	drawPixelBox(roomX, roomY, stemX, elem.y+elem.height*0.25, stemZ,
		4, elem.height*0.35, 4, "furniture_sub")
	
	// 葉っぱ（レイヤーで豊かに）
	leafColor := palette[elem.color]
	for layer := 0; layer < 3; layer++ {
		layerY := elem.y + elem.height*0.5 + float64(layer)*elem.height*0.15
		layerSize := elem.width * (1.2 - float64(layer)*0.2)
		
		// 各レイヤーに複数の葉
		for angle := 0.0; angle < 360; angle += 45 {
			rad := angle * 3.14159 / 180
			leafX := elem.x + elem.width/2 + math.Cos(rad)*layerSize*0.4
			leafZ := elem.z + elem.depth/2 + math.Sin(rad)*layerSize*0.4
			
			// 葉の明度をランダムに
			brightness := 0.8 + rand.Float64()*0.4
			p.Fill(leafColor[0]*brightness, leafColor[1]*brightness, leafColor[2]*brightness, 255)
			
			for px := -3.0; px < 3.0; px += PIXEL_SIZE {
				for pz := -3.0; pz < 3.0; pz += PIXEL_SIZE {
					for py := 0.0; py < 8.0; py += PIXEL_SIZE {
						isoX, isoY := toIsometric(leafX+px, layerY+py, leafZ+pz)
						p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
					}
				}
			}
		}
	}
	
	// 花（裕福度が高ければ）
	if wealthLevel > 60 {
		flowerColors := [][3]float64{
			{255, 182, 193}, // ピンク
			{255, 255, 200}, // 黄色
			{221, 160, 221}, // 紫
		}
		for i := 0; i < 3; i++ {
			flowerColor := flowerColors[rand.Intn(len(flowerColors))]
			flowerX := elem.x + elem.width/2 + rand.Float64()*10 - 5
			flowerY := elem.y + elem.height*0.8 + rand.Float64()*5
			flowerZ := elem.z + elem.depth/2 + rand.Float64()*10 - 5
			
			p.Fill(flowerColor[0], flowerColor[1], flowerColor[2], 255)
			for px := -2.0; px < 2.0; px += PIXEL_SIZE {
				for pz := -2.0; pz < 2.0; pz += PIXEL_SIZE {
					isoX, isoY := toIsometric(flowerX+px, flowerY, flowerZ+pz)
					p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
				}
			}
		}
	}
}

func drawPixelShelf(roomX, roomY float64, elem RoomElement) {
	// 枠
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// 棚板
	for i := 0; i < 3; i++ {
		shelfY := elem.y + float64(i+1)*elem.height/4
		drawPixelBox(roomX, roomY, elem.x, shelfY, elem.z,
			elem.width, 2, elem.depth, elem.color)
	}
}

func drawPixelPainting(roomX, roomY float64, elem RoomElement) {
	// フレーム
	frameColor := palette["furniture_sub"]
	p.Fill(frameColor[0]*0.7, frameColor[1]*0.5, frameColor[2]*0.3, 255)
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth+1, "furniture_sub")
	
	// キャンバス
	p.Fill(250, 250, 245, 255)
	canvasX := elem.x + 2
	canvasY := elem.y + 2
	canvasZ := elem.z + elem.depth
	canvasWidth := elem.width - 4
	canvasHeight := elem.height - 4
	
	for px := 0.0; px < canvasWidth; px += PIXEL_SIZE {
		for py := 0.0; py < canvasHeight; py += PIXEL_SIZE {
			isoX, isoY := toIsometric(canvasX+px, canvasY+py, canvasZ)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// MBTIタイプに基づくアートスタイル
	if isSensing {
		// Sタイプ: 具象的な風景画
		// 山
		mountainColor := [3]float64{100, 120, 140}
		for i := 0; i < 3; i++ {
			mx := canvasX + float64(i)*canvasWidth/3
			my := canvasY + canvasHeight*0.3
			
			for px := 0.0; px < canvasWidth/4; px += PIXEL_SIZE {
				for py := 0.0; py < canvasHeight/3; py += PIXEL_SIZE {
					if px+py < canvasWidth/4 {
						p.Fill(mountainColor[0], mountainColor[1], mountainColor[2], 255)
						isoX, isoY := toIsometric(mx+px, my+py, canvasZ+1)
						p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
					}
				}
			}
		}
		// 太陽
		sunColor := [3]float64{255, 200, 50}
		sunX := canvasX + canvasWidth*0.7
		sunY := canvasY + canvasHeight*0.2
		for px := -6.0; px < 6.0; px += PIXEL_SIZE {
			for py := -6.0; py < 6.0; py += PIXEL_SIZE {
				if px*px+py*py < 36 {
					p.Fill(sunColor[0], sunColor[1], sunColor[2], 255)
					isoX, isoY := toIsometric(sunX+px, sunY+py, canvasZ+1)
					p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
				}
			}
		}
	} else {
		// Nタイプ: 抽象的なアート
		baseHue := float64(hashString(mbtiType)) / float64(1<<32) * 360
		for i := 0; i < 15; i++ {
			shapeX := canvasX + rand.Float64()*(canvasWidth-10)
			shapeY := canvasY + rand.Float64()*(canvasHeight-10)
			shapeSize := 5 + rand.Float64()*15
			
			// ランダムな色
			shapeHue := math.Mod(baseHue+float64(i)*30, 360)
			shapeColor := hsvToRGB(shapeHue, 0.7, 0.8)
			p.Fill(shapeColor[0], shapeColor[1], shapeColor[2], 200)
			
			shapeType := rand.Intn(3)
			switch shapeType {
			case 0: // 四角
				for px := 0.0; px < shapeSize; px += PIXEL_SIZE {
					for py := 0.0; py < shapeSize; py += PIXEL_SIZE {
						isoX, isoY := toIsometric(shapeX+px, shapeY+py, canvasZ+1)
						p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
					}
				}
			case 1: // 三角
				for px := 0.0; px < shapeSize; px += PIXEL_SIZE {
					for py := 0.0; py < shapeSize-px; py += PIXEL_SIZE {
						isoX, isoY := toIsometric(shapeX+px, shapeY+py, canvasZ+1)
						p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
					}
				}
			case 2: // 円
				for px := -shapeSize/2; px < shapeSize/2; px += PIXEL_SIZE {
					for py := -shapeSize/2; py < shapeSize/2; py += PIXEL_SIZE {
						if px*px+py*py < shapeSize*shapeSize/4 {
							isoX, isoY := toIsometric(shapeX+shapeSize/2+px, shapeY+shapeSize/2+py, canvasZ+1)
							p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
						}
					}
				}
			}
		}
	}
}

func drawPixelEasel(roomX, roomY float64, elem RoomElement) {
	// 三脚
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		2, elem.height, 2, elem.color)
	drawPixelBox(roomX, roomY, elem.x+elem.width-2, elem.y, elem.z,
		2, elem.height, 2, elem.color)
	drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y, elem.z+elem.depth-2,
		2, elem.height, 2, elem.color)
}

func drawPixelGuitar(roomX, roomY float64, elem RoomElement) {
	// ボディ（アコースティックギター風）
	bodyColor := palette[elem.color]
	
	// メインボディ
	p.Fill(bodyColor[0]*0.9, bodyColor[1]*0.7, bodyColor[2]*0.5, 255)
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.15, elem.z,
		elem.width, elem.height*0.45, elem.depth, elem.color)
	
	// サウンドホール
	holeX := elem.x + elem.width/2 - 3
	holeY := elem.y + elem.height*0.35
	holeZ := elem.z + elem.depth - 1
	p.Fill(20, 20, 20, 255)
	for px := 0.0; px < 6.0; px += PIXEL_SIZE {
		for py := 0.0; py < 6.0; py += PIXEL_SIZE {
			isoX, isoY := toIsometric(holeX+px, holeY+py, holeZ)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
		}
	}
	
	// ネック
	p.Fill(bodyColor[0]*0.8, bodyColor[1]*0.6, bodyColor[2]*0.4, 255)
	drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y+elem.height*0.6, elem.z+elem.depth/2-1,
		2, elem.height*0.35, 2, elem.color)
	
	// ヘッド
	headX := elem.x + elem.width/2 - 4
	headY := elem.y + elem.height*0.9
	headZ := elem.z + elem.depth/2 - 3
	p.Fill(50, 30, 20, 255)
	drawPixelBox(roomX, roomY, headX, headY, headZ,
		8, elem.height*0.1, 6, "furniture_sub")
	
	// ペグ（糸巻き）
	for i := 0; i < 6; i++ {
		pegX := headX + float64(i%3)*3
		pegY := headY + 2
		pegZ := headZ + float64(i/3)*4
		p.Fill(200, 200, 200, 255)
		for px := 0.0; px < 2.0; px += PIXEL_SIZE {
			for pz := 0.0; pz < 2.0; pz += PIXEL_SIZE {
				isoX, isoY := toIsometric(pegX+px, pegY, pegZ+pz)
				p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
			}
		}
	}
	
	// 弦（6本）
	p.Stroke(150, 150, 150, 255)
	p.StrokeWeight(1)
	for i := 0; i < 6; i++ {
		stringX := elem.x + elem.width/2 - 3 + float64(i)
		x1, y1 := toIsometric(stringX, elem.y+elem.height*0.2, elem.z+elem.depth-1)
		x2, y2 := toIsometric(stringX, elem.y+elem.height*0.9, elem.z+elem.depth-1)
		p.Line(roomX+x1-ROOM_SIZE/2, roomY+y1-ROOM_SIZE/2,
			roomX+x2-ROOM_SIZE/2, roomY+y2-ROOM_SIZE/2)
	}
	p.NoStroke()
}

func drawPixelTVStand(roomX, roomY float64, elem RoomElement) {
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

func drawPixelSpeaker(roomX, roomY float64, elem RoomElement) {
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

func drawPixelLamp(roomX, roomY float64, elem RoomElement) {
	// ベース
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.1, elem.depth, "furniture_sub")
	
	// ポール
	drawPixelBox(roomX, roomY, elem.x+elem.width/2-1, elem.y+elem.height*0.1, elem.z+elem.depth/2-1,
		2, elem.height*0.7, 2, "furniture_sub")
	
	// シェード
	drawPixelBox(roomX, roomY, elem.x, elem.y+elem.height*0.8, elem.z,
		elem.width, elem.height*0.2, elem.depth, elem.color)
}

func drawPixelClock(roomX, roomY float64, elem RoomElement) {
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

func drawPixelTrophy(roomX, roomY float64, elem RoomElement) {
	// ベース
	p.Fill(50, 50, 50, 255)
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.2, elem.depth, "furniture_sub")
	
	// トロフィー本体（金色）
	p.Fill(255, 215, 0, 255)
	drawPixelBox(roomX, roomY, elem.x+1, elem.y+elem.height*0.2, elem.z+1,
		elem.width-2, elem.height*0.8, elem.depth-2, "decoration")
}

func drawPixelBook(roomX, roomY float64, elem RoomElement) {
	// 本の色をランダムに
	bookColors := [][3]float64{
		{150, 50, 50},   // 赤
		{50, 100, 150},  // 青
		{50, 120, 50},   // 緑
		{120, 100, 80},  // 茶
	}
	bookColor := bookColors[rand.Intn(len(bookColors))]
	p.Fill(bookColor[0], bookColor[1], bookColor[2], 255)
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
}

// レアアイテム生成関数
func generateRareItems() {
	// レアリティの確率を計算
	rareChance := float64(wealthLevel) / 100.0 * 0.3 // 最大0.3
	epicChance := float64(wealthLevel) / 100.0 * 0.1 // 最大0.1
	legendaryChance := float64(wealthLevel) / 100.0 * 0.05 // 最大0.05
	
	// MBTIタイプによるボーナス
	if !isSensing { // Nタイプはレアアイテムが出やすい
		rareChance *= 1.5
		epicChance *= 1.3
		legendaryChance *= 1.2
	}
	
	if !isJudging { // Pタイプは意外な発見が多い
		rareChance *= 1.3
		epicChance *= 1.5
		legendaryChance *= 1.8
	}
	
	// レジェンダリーアイテムのチェック
	if rand.Float64() < legendaryChance {
		addLegendaryItem()
	} else if rand.Float64() < epicChance {
		addEpicItem()
	} else if rand.Float64() < rareChance {
		addRareItem()
	}
}

func addLegendaryItem() {
	legendaryItems := []string{"timemachine", "quantum_computer"}
	item := legendaryItems[rand.Intn(len(legendaryItems))]
	
	// 空いてるスペースを探して配置
	x := 20.0 + rand.Float64()*(ROOM_SIZE-60)
	z := 20.0 + rand.Float64()*(ROOM_SIZE-60)
	
	roomElements = append(roomElements, RoomElement{
		x: x, y: 0, z: z,
		width: 25, height: 40, depth: 20,
		elementType: item,
		color: "decoration",
		isRare: true,
		rarity: "legendary",
	})
}

func addEpicItem() {
	epicItems := []string{"hologram", "crystal", "artifact"}
	item := epicItems[rand.Intn(len(epicItems))]
	
	x := 25.0 + rand.Float64()*(ROOM_SIZE-70)
	z := 25.0 + rand.Float64()*(ROOM_SIZE-70)
	
	size := 15.0 + rand.Float64()*10
	roomElements = append(roomElements, RoomElement{
		x: x, y: 0, z: z,
		width: size, height: size*1.5, depth: size,
		elementType: item,
		color: "decoration",
		isRare: true,
		rarity: "epic",
	})
}

func addRareItem() {
	rareItems := []string{"diamond", "goldbar"}
	item := rareItems[rand.Intn(len(rareItems))]
	
	x := 30.0 + rand.Float64()*(ROOM_SIZE-80)
	z := 30.0 + rand.Float64()*(ROOM_SIZE-80)
	
	size := 8.0 + rand.Float64()*6
	roomElements = append(roomElements, RoomElement{
		x: x, y: 15, z: z, // 高い位置に配置
		width: size, height: size, depth: size,
		elementType: item,
		color: "decoration",
		isRare: true,
		rarity: "rare",
	})
}

// レアアイテム描画関数
func drawPixelDiamond(roomX, roomY float64, elem RoomElement) {
	// キラキラしたダイヤモンド
	diamondColors := [][3]float64{
		{255, 255, 255}, // 白
		{200, 220, 255}, // 青白
		{255, 240, 245}, // ピンク白
	}
	
	for i, color := range diamondColors {
		offset := float64(i) * 2
		p.Fill(color[0], color[1], color[2], 180+i*25)
		
		// ダイヤモンドの形（ピラミッド）
		for px := offset; px < elem.width-offset; px += PIXEL_SIZE {
			for pz := offset; pz < elem.depth-offset; pz += PIXEL_SIZE {
				heightRatio := 1.0 - math.Max(math.Abs(px-elem.width/2), math.Abs(pz-elem.depth/2))/(elem.width/2)
				if heightRatio > 0 {
					py := elem.height * heightRatio
					isoX, isoY := toIsometric(elem.x+px, elem.y+py, elem.z+pz)
					p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE, PIXEL_SIZE)
				}
			}
		}
	}
}

func drawPixelCrystal(roomX, roomY float64, elem RoomElement) {
	// 紫のクリスタル
	crystalColor := [3]float64{147, 0, 211}
	p.Fill(crystalColor[0], crystalColor[1], crystalColor[2], 200)
	
	// クリスタルの形（六角柱）
	for py := 0.0; py < elem.height; py += PIXEL_SIZE {
		for angle := 0.0; angle < 360; angle += 60 {
			rad := angle * math.Pi / 180
			radius := elem.width/2 * (1.0 - py/elem.height*0.3)
			px := radius * math.Cos(rad)
			pz := radius * math.Sin(rad)
			
			// 光の反射効果
			brightness := 0.8 + 0.4*math.Sin(py/5+angle/30)
			p.Fill(crystalColor[0]*brightness, crystalColor[1]*brightness, crystalColor[2]*brightness, 200)
			
			isoX, isoY := toIsometric(elem.x+elem.width/2+px, elem.y+py, elem.z+elem.depth/2+pz)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
}

func drawPixelGoldBar(roomX, roomY float64, elem RoomElement) {
	// 金のインゴット
	goldColor := [3]float64{255, 215, 0}
	p.Fill(goldColor[0], goldColor[1], goldColor[2], 255)
	
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// 光沢効果
	p.Fill(255, 255, 200, 150)
	for i := 0; i < 3; i++ {
		offsetX := elem.x + float64(i)*elem.width/3 + 2
		offsetY := elem.y + elem.height - 2
		offsetZ := elem.z + 2
		
		isoX, isoY := toIsometric(offsetX, offsetY, offsetZ)
		p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*2, PIXEL_SIZE)
	}
}

func drawPixelArtifact(roomX, roomY float64, elem RoomElement) {
	// 古代の遗物（グラデーション効果）
	baseHue := float64(hashString(mbtiType+"artifact")) / float64(1<<32) * 360
	
	for layer := 0; layer < 5; layer++ {
		layerHue := math.Mod(baseHue+float64(layer)*30, 360)
		layerColor := hsvToRGB(layerHue, 0.8, 0.9)
		p.Fill(layerColor[0], layerColor[1], layerColor[2], 200-layer*20)
		
		layerSize := elem.width * (1.0 - float64(layer)*0.15)
		layerHeight := elem.height * (1.0 - float64(layer)*0.1)
		offset := (elem.width - layerSize) / 2
		
		drawPixelBox(roomX, roomY, elem.x+offset, elem.y+float64(layer)*3, elem.z+offset,
			layerSize, layerHeight/5, layerSize, elem.color)
	}
}

func drawPixelQuantumComputer(roomX, roomY float64, elem RoomElement) {
	// 量子コンピューター（SF風）
	baseColor := [3]float64{0, 50, 100}
	p.Fill(baseColor[0], baseColor[1], baseColor[2], 255)
	
	// メインユニット
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.8, elem.depth, elem.color)
	
	// 量子コア（光る球体）
	coreColors := [][3]float64{
		{0, 255, 255},   // シアン
		{255, 0, 255},   // マゼンタ
		{255, 255, 0},   // 黄色
	}
	
	for i, coreColor := range coreColors {
		p.Fill(coreColor[0], coreColor[1], coreColor[2], 150)
		coreX := elem.x + elem.width/2
		coreY := elem.y + elem.height*0.9
		coreZ := elem.z + elem.depth/2
		orbRadius := 8.0 + float64(i)*2
		
		// 回転する球体
		for angle := 0.0; angle < 360; angle += 30 {
			rad := angle * math.Pi / 180
			orbX := coreX + orbRadius*math.Cos(rad)
			orbZ := coreZ + orbRadius*math.Sin(rad)
			
			isoX, isoY := toIsometric(orbX, coreY, orbZ)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*3, PIXEL_SIZE*3)
		}
	}
}

func drawPixelHologram(roomX, roomY float64, elem RoomElement) {
	// ホログラム投影機
	baseColor := [3]float64{80, 80, 80}
	p.Fill(baseColor[0], baseColor[1], baseColor[2], 255)
	
	// ベース
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height*0.3, elem.depth, elem.color)
	
	// ホログラム投影（上空に光る影）
	holoColors := [][3]float64{
		{0, 255, 150},   // 緑
		{100, 200, 255}, // 青
		{255, 150, 255}, // ピンク
	}
	
	for i := 0; i < 20; i++ {
		holoColor := holoColors[i%len(holoColors)]
		p.Fill(holoColor[0], holoColor[1], holoColor[2], 100+i*5)
		
		holoX := elem.x + elem.width/2 + rand.Float64()*20 - 10
		holoY := elem.y + elem.height*0.3 + float64(i)*3
		holoZ := elem.z + elem.depth/2 + rand.Float64()*20 - 10
		
		isoX, isoY := toIsometric(holoX, holoY, holoZ)
		p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*2, PIXEL_SIZE*2)
	}
}

func drawPixelTimeMachine(roomX, roomY float64, elem RoomElement) {
	// タイムマシン（最レア）
	timeColor := [3]float64{120, 0, 120}
	p.Fill(timeColor[0], timeColor[1], timeColor[2], 255)
	
	// メインユニット
	drawPixelBox(roomX, roomY, elem.x, elem.y, elem.z,
		elem.width, elem.height, elem.depth, elem.color)
	
	// 時空の歪みエフェクト
	for ring := 0; ring < 5; ring++ {
		ringColor := hsvToRGB(280+float64(ring)*20, 0.8, 0.9)
		p.Fill(ringColor[0], ringColor[1], ringColor[2], 150-ring*20)
		
		radius := 15.0 + float64(ring)*8
		ringY := elem.y + elem.height + float64(ring)*5
		
		for angle := 0.0; angle < 360; angle += 20 {
			rad := angle * math.Pi / 180
			ringX := elem.x + elem.width/2 + radius*math.Cos(rad)
			ringZ := elem.z + elem.depth/2 + radius*math.Sin(rad)
			
			isoX, isoY := toIsometric(ringX, ringY, ringZ)
			p.Rect(roomX+isoX-ROOM_SIZE/2, roomY+isoY-ROOM_SIZE/2, PIXEL_SIZE*2, PIXEL_SIZE*2)
		}
	}
}

func toIsometric(x, y, z float64) (float64, float64) {
	isoX := (x - z) * 0.866
	isoY := (x + z) * 0.5 - y
	return isoX, isoY
}

func hsvToRGB(h, s, v float64) [3]float64 {
	h = math.Mod(h, 360)
	c := v * s
	x := c * (1 - math.Abs(math.Mod(h/60, 2)-1))
	m := v - c
	
	var r, g, b float64
	switch {
	case h < 60:
		r, g, b = c, x, 0
	case h < 120:
		r, g, b = x, c, 0
	case h < 180:
		r, g, b = 0, c, x
	case h < 240:
		r, g, b = 0, x, c
	case h < 300:
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

func hashString(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

func drawMBTIInfo() {
	// MBTIタイプ表示
	p.TextSize(18)
	p.Fill(50, 50, 50, 255)
	p.Text(mbtiType, 10, 25)
	
	// 財産レベル表示
	p.TextSize(14)
	wealthText := ""
	if wealthLevel > 70 {
		wealthText = "Wealthy"
	} else if wealthLevel > 40 {
		wealthText = "Middle"
	} else {
		wealthText = "Simple"
	}
	p.Text(wealthText, 10, 45)
}