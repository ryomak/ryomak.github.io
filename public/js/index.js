
console.log(
"  _ __   __  __      ___     ___ ___       __    \\ \\ \\/\\     \n"  +
"/\\`'__\\/\\ \\/\\ \\    / __`\\ /' __` __`\\   /'__`\\    \\ \\ , <     \n"  +
"\\ \\ \\/ \\ \\ \\_\\ \\  /\\ \\L\\ \\/\\ \\/\\ \\/\\ \\ /\\ \\L\\.\\_   \\ \\ \\\\`\\   \n"  +
" \\ \\_\\  \\/`____ \\ \\ \\____/\\ \\_\\ \\_\\ \\_\\\\ \\__/.\\_\\   \\ \\_\\ \\_\\ \n"  +
"  \\/_/   `/___/> \\ \\/___/  \\/_/\\/_/\\/_/ \\/__/\\/_/    \\/_/\\/_/ \n"  +
"            /\\___/                                            \n"  +
"            \\/__/"  
);

console.log("  _,,_,*^____      _____``*g*\"*, \n" +
" / __/ /'     ^.  /      \\ ^@q   f \n" +
"[  @f | @))    |  | @))   l  0 _/ \n" +
" \\`/   \\~____ / __ \\_____/    \\   \n"+
"  |           _l__l_           I  \n"+
"  }          [______]           I \n"+
"  ]            | | |            | \n"+
"  ]             ~ ~             | \n"+
"  |                            |  \n"+
"   |                           |  \n");




// 起動コード
window.addEventListener('DOMContentLoaded', () => {
  new Main();
});

/**
 * @author Yasunobu Ikeda
 */
class Main {

  constructor() {
    // ウェーブ風グラフィック用のステージを作成
    this.stageCalcInside = new createjs.Stage('canvas');
    this.stageCalcInside.autoClear = false;

    // ウェーブ風グラフィックを作成
    const waveShape = new WaveShape();
    this.stageCalcInside.addChild(waveShape);

    // Tickerを作成
    createjs.Ticker.timingMode = createjs.Ticker.RAF;
    createjs.Ticker.on('tick', this.handleTick, this);

    // リサイズイベント
    this.handleResize();
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  /**
   * エンターフレームイベント
   */
  handleTick() {
    // 薄く暗く塗る
    const context = this.stageCalcInside.canvas.getContext('2d');
    context.fillStyle = `rgba(255, 255, 255, 0.2)`;
    context.fillRect(
      0,
      0,
      this.stageCalcInside.canvas.width,
      this.stageCalcInside.canvas.height);

    // 波の表現を更新
    this.stageCalcInside.update();
  }

  /**
   * リサイズイベント
   */
  handleResize() {
    // ウェーブ風グラフィック用ステージのりサイズ
    this.stageCalcInside.canvas.width = innerWidth;
    this.stageCalcInside.canvas.height = innerHeight;
  }
}