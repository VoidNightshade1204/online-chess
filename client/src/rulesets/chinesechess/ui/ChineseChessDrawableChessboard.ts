import { configManager } from "src/boot/main";
import { ConfigItem } from "src/config/ConfigManager";
import ChessPos from "src/rulesets/chinesechess/rule/ChessPos";
import Signal from "src/utils/signals/Signal";
import DrawableChessboard from "src/rulesets/ui/DrawableChessboard";
import DrawableChess from "./DrawableChess";
import './chessboard.scss';
import './themes/chessboard/index.scss';
import chessboardThemes from './themes/chessboard/index';
import ChessboardState from "../rule/ChessboardState";

export default class ChineseChessDrawableChessboard extends DrawableChessboard {
  private _bounds: ChessboardBounds;

  public get bounds() { return this._bounds; }

  public readonly chessPickupOrDrop: Signal = new Signal();

  public readonly chessPosClicked: Signal = new Signal();

  public readonly chessMoved: Signal = new Signal();

  public chessboardState = new ChessboardState();

  public hanNumberInBottom = true;

  private screen: any;

  private canvas: HTMLCanvasElement;

  private readonly padding = 4;

  private chesses: DrawableChess[] = [];

  private font = new FontFace('founder-xin-kaiti', 'url(/fonts/FZXKJW.ttf)');

  constructor(stage: {width: number, height: number}, screen: any) {
    super();

    // eslint-disable-next-line
    this.screen = screen;

    this.load(stage);
  }

  private load(stage: {width: number, height: number}) {
    const el = document.createElement('div');
    this._el = el;
    el.className = 'chessboard chinesechess-chessboard';
    el.style.position = 'relative';
    el.style.padding = `${this.padding}px`;

    // eslint-disable-next-line
    el.classList.add(`${this.screen.name}-screen`);

    this.resetTheme();
    configManager.changed.add(this.onConfigChanged, this);

    el.onclick = this.onClick.bind(this);

    this.setupDragable();

    const canvas = document.createElement('canvas');
    this.canvas = canvas;
    el.appendChild(canvas);

    this.resizeAndDraw(stage, this.screen);
  }

  public redraw() {
    this.draw(this.canvas, this.screen);
  }

  public resizeAndDraw(stage: {width: number, height: number}, screen: any) {
    // eslint-disable-next-line
    this.screen = screen;
    this.calcBounds(stage, screen);

    const el = this._el;
    const { width, height } = this.bounds.canvas;
    el.style.width = `${width + this.padding * 2}px`;
    el.style.height = `${height + this.padding * 2}px`;

    this.draw(this.canvas, screen);

    this.chesses.forEach((chess: DrawableChess) => {
      chess.resizeAndDraw(this.bounds.chessRadius);
      const { x, y } = this.calcChessDisplayPos(chess.getPos());
      chess.x = x;
      chess.y = y;
    });
  }

  public destroy() {
    this.chesses.forEach((chess: DrawableChess) => {
      chess.destroy();
    });
    configManager.changed.remove(this.onConfigChanged, this);
  }

  private onConfigChanged(key: string) {
    if (key == ConfigItem.chinesechessChessboardTheme) {
      this.resetTheme();
    }
  }

  private resetTheme() {
    const { el } = this;
    const theme = configManager.get(ConfigItem.chinesechessChessboardTheme) as string;
    el.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) {
        el.classList.remove(cls);
      }
    });
    el.classList.add(`theme-${theme}`);
    if (this.canvas) {
      this.draw(this.canvas, this.screen);
    }
  }

  private setupDragable() {
    const el = this._el;

    // 接收拖拽
    el.ondragover = (event) => {
      event.preventDefault();
    };
    // 放置
    el.ondrop = (event) => {
      const data: string[] = event.dataTransfer?.getData('chess-pos').split(',') as string[];
      const fromPos = new ChessPos(+data[0], +data[1]);
      let toPos: ChessPos;
      if ((event.target as HTMLElement).classList.contains('chess')) {
        const target = this.chesses.find((chess: DrawableChess) => chess.el == event.target);
        toPos = target?.getPos() as ChessPos;
      } else {
        toPos = this.chessPosFromInputEvent(event);
      }
      this.chessMoved.dispatch({
        chess: this.chessAt(fromPos),
        toPos,
      });
    };
  }

  private onClick(event: MouseEvent) {
    this.clicked.dispatch(event);

    const pos = this.chessPosFromInputEvent(event);
    const args = { pos, chess: this.chessAt(pos) };

    this.chessPosClicked.dispatch(args);
  }

  private chessPosFromInputEvent(event: DragEvent | MouseEvent) {
    const targetEl = event.target as HTMLElement;
    if (targetEl.classList.contains('chess-target')) {
      const data: string[] = targetEl.getAttribute('chess-pos')?.split(',') as string[];
      return new ChessPos(+data[0], +data[1]);
    }

    // 当放置目标是棋盘时, 事件offsetX/Y才准确
    const { offsetX, offsetY } = event;
    const { bounds } = this;
    let row: number;
    let col: number;
    if (offsetY < bounds.grid.y) {
      row = 0;
    } else if (offsetY > bounds.canvas.height - bounds.grid.y) {
      row = 9;
    } else {
      row = Math.round((offsetY - bounds.grid.y) / bounds.grid.cellSize);
    }
    if (offsetX < bounds.grid.x) {
      col = 0;
    } else if (offsetX > bounds.canvas.width - bounds.grid.x) {
      col = 8;
    } else {
      col = Math.round((offsetX - bounds.grid.x) / bounds.grid.cellSize);
    }
    return new ChessPos(row, col);
  }

  private draw(canvas: HTMLCanvasElement, screen: any) {
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (context == null) return;

    const { grid } = this.bounds;

    const pixelRatio = (() => {
      // eslint-disable-next-line
      const ctx: any = context;
      // eslint-disable-next-line
      const backingStore = ctx.backingStorePixelRatio ||
      // eslint-disable-next-line
      ctx.webkitBackingStorePixelRatio ||
      // eslint-disable-next-line
      ctx.mozBackingStorePixelRatio ||
      // eslint-disable-next-line
      ctx.msBackingStorePixelRatio ||
      // eslint-disable-next-line
      ctx.oBackingStorePixelRatio ||
      // eslint-disable-next-line
      ctx.backingStorePixelRatio || 1;
      return (window.devicePixelRatio || 1) / backingStore;
    })();

    const canvasBounds = this.bounds.canvas;
    canvas.style.width = `${canvasBounds.width}px`;
    canvas.style.height = `${canvasBounds.height}px`;
    canvas.width = canvasBounds.width * pixelRatio;
    canvas.height = canvasBounds.height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);

    const theme = configManager.get(ConfigItem.chinesechessChessboardTheme) as string;
    const { lineColor } = chessboardThemes[theme];
    /// 画棋盘网格线
    const drawLine = (
      x1: number, y1: number,
      x2: number, y2: number,
      color?: string,
      lineWidth = 1,
    ) => {
      context.beginPath();
      context.shadowOffsetX = -0.5;
      context.shadowOffsetY = -0.5;
      context.shadowBlur = 0.5;
      context.shadowColor = 'rgba(0, 0, 0, 0.4)';
      // eslint-disable-next-line
      context.lineWidth = lineWidth;
      context.moveTo(grid.x + x1, grid.y + y1);
      context.lineTo(grid.x + x2, grid.y + y2);
      context.closePath();
      context.strokeStyle = color || lineColor;
      context.stroke();
    };

    const drawXLine = (baseRow: number, startCol: number, endCol: number) => {
      const y = baseRow * grid.cellSize;
      const startX = startCol * grid.cellSize;
      const endX = endCol * grid.cellSize;
      drawLine(startX, y, endX, y);
    };

    const drawYLine = (baseCol: number, startRow: number, endRow: number) => {
      const x = baseCol * grid.cellSize;
      const startY = startRow * grid.cellSize;
      const endY = endRow * grid.cellSize;
      drawLine(x, startY, x, endY);
    };

    drawYLine(0, 0, 9);
    drawYLine(8, 0, 9);
    for (let col = 1; col < 8; col++) {
      drawYLine(col, 0, 4);
      drawYLine(col, 5, 9);
    }
    for (let row = 0; row < 10; row++) {
      drawXLine(row, 0, 8);
    }

    // 画中间九宫的斜线
    const drawXGraph = (row: number) => {
      const x1 = 3 * grid.cellSize;
      const x2 = 5 * grid.cellSize;
      const baseY = grid.cellSize * row;
      drawLine(x1, baseY, x2, baseY + 2 * grid.cellSize);
      drawLine(x1, baseY + 2 * grid.cellSize, x2, baseY);
    };
    drawXGraph(0);
    drawXGraph(7);

    // 画十字
    (() => {
      /**
       * 画一个十字
       * @param cx 中心点x
       * @param cy 中心点y
       * @param indexs 十字图形索引，0到3分别表示左上,右上,右下,左下
       */
      const drawCross = (cx: number, cy: number, indexs: number[] = [0, 1, 2, 3]) => {
        // eslint-disable-next-line
        const m = Math.min(grid.cellSize / 8, screen.xs ? 3 : 4); // 距离中心点
        // eslint-disable-next-line
        const l = Math.min(grid.cellSize / 4, screen.xs ? 6 : 8); // 十字长度
        const dt = [[-1, -1], [+1, -1], [+1, +1], [-1, +1]];
        indexs.forEach((i) => {
          const [xf, yf] = dt[i];
          const x = cx + m * xf;
          const y = cy + m * yf;
          drawLine(x, y, x + l * xf, y);
          drawLine(x, y, x, y + l * yf);
        });
      };
      const drawCrossAt = (row: number, col: number, indexs?: number[]) => {
        drawCross(grid.cellSize * col, grid.cellSize * row, indexs);
      };

      drawCrossAt(2, 1);
      drawCrossAt(2, 7);
      drawCrossAt(7, 1);
      drawCrossAt(7, 7);
      for (let p = 0; p < 2; p++) {
        const row = 3 + p * 3;
        drawCrossAt(row, 0, [1, 2]);
        drawCrossAt(row, 2);
        drawCrossAt(row, 4);
        drawCrossAt(row, 6);
        drawCrossAt(row, 8, [0, 3]);
      }
    })();

    // 边框
    // eslint-disable-next-line
    const padding = screen.xs ? 4 : 6;
    // eslint-disable-next-line
    context.lineWidth = screen.xs ? 2.5 : 3;
    context.strokeRect(
      grid.x - padding,
      grid.y - padding,
      grid.cellSize * 8 + padding * 2,
      grid.cellSize * 9 + padding * 2,
    );

    // 画编号
    {
      const hanNos = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const araNos = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      context.fillStyle = '#996b48';
      const fontSize = Math.min(14, grid.x / 2);
      context.textBaseline = 'middle';
      context.textAlign = 'center';
      context.shadowOffsetX = -0.5;
      context.shadowOffsetY = -0.5;
      context.shadowBlur = 0;
      context.shadowColor = 'rgba(0, 0, 0, 0.3)';

      const fillNoText = (n: number, isHan: boolean, x: number, y: number) => {
        context.font = `${fontSize}px founder-kaiti`;
        context.fillText((isHan ? hanNos : araNos)[n - 1], x, y);
      };

      for (let c = 0; c < 9; c++) {
        const x = grid.x + c * grid.cellSize;
        fillNoText(c + 1, !this.hanNumberInBottom,
          x, grid.y / 2 - padding / 2);
        fillNoText(c + 1, this.hanNumberInBottom,
          x, canvasBounds.height - grid.y / 2 + padding - context.lineWidth / 2);
      }
    }

    // eslint-disable-next-line
    this.font.load().then(() => {
      // eslint-disable-next-line
      document.fonts.add(this.font);
      context.fillStyle = chessboardThemes[theme].centerTextColor || '#b8957a';
      const fontSize = grid.cellSize / 1.4;
      const y = canvasBounds.height / 2 + context.lineWidth;
      context.font = `bold ${fontSize}px 'founder-xin-kaiti'`;
      context.shadowOffsetX = -1;
      context.shadowOffsetY = -1;
      context.shadowBlur = 0;
      context.shadowColor = 'rgba(0, 0, 0, 0.3)';
      context.fillText('楚 河', grid.x + grid.cellSize * 1.8, y);
      context.fillText('汉 界', canvasBounds.width - grid.x - grid.cellSize * 1.8, y);
    });
  }

  private calcBounds(stage: {width: number, height: number}, screen: any) {
    const MIN_SIZE = 100;

    // 计算匹配屏幕的画布的宽度
    let narrow = Math.min(stage.width, stage.height);
    narrow -= this.padding * 2;
    if (narrow < MIN_SIZE) {
      narrow = MIN_SIZE;
    }

    // 根据网格宽度计算交叉点之间的距离
    let cellSize;
    if ((narrow / 9) * 10 > stage.height) {
      cellSize = narrow / 10;
    } else {
      cellSize = narrow / 9;
    }

    // 棋子宽度稍小于交叉点距离
    // eslint-disable-next-line
    const chessGap = screen.xs ? 4 : 10;
    const chessSize = cellSize - chessGap;
    // 最侧边的棋子需要占据半个位置
    const gridMargin = cellSize / 2;
    const canvasWidth = Math.floor(cellSize * 9);
    const canvasHeight = Math.floor(cellSize * 10);

    this._bounds = {
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
      },
      grid: {
        x: Math.round(gridMargin),
        y: Math.round(gridMargin),
        cellSize: Math.round(cellSize),
      },
      chessGap,
      chessRadius: Math.round(chessSize / 2),
    };
  }

  public removeChess(chess: DrawableChess) {
    this._el.removeChild(chess.el);
    this.chesses = this.chesses.filter((c) => c != chess);
  }

  public addChess(chess: DrawableChess) {
    this.chessboardState.setChess(chess.getPos(), chess.chess);
    const { x, y } = this.calcChessDisplayPos(chess.getPos());
    chess.x = x;
    chess.y = y;

    chess.clicked.removeAll();
    chess.pickup.removeAll();
    chess.drop.removeAll();

    chess.clicked.add(() => {
      this.chessPosClicked.dispatch({ chess, pos: chess.getPos() });
    });
    chess.pickup.add(() => {
      this.chessPickupOrDrop.dispatch({ chess, isPickup: true });
    });
    chess.drop.add(() => {
      this.chessPickupOrDrop.dispatch({ chess, isPickup: false });
    });
    this.chesses.push(chess);
    this._el.appendChild(chess.el);
  }

  public clear() {
    this.chessboardState.clear();
    this.chesses.forEach((chess) => {
      this.el.removeChild(chess.el);
    });
    this.chesses = [];
  }

  public chessAt(pos: ChessPos): DrawableChess | null {
    return this.chesses.find((chess) => pos.equals(chess?.getPos())) || null;
  }

  public getChesses() {
    return this.chesses;
  }

  public calcChessDisplayPos(pos: ChessPos) {
    const { grid } = this.bounds;
    const paddingOffset = this.padding / 2 + 1.5;
    const x = grid.x + paddingOffset + pos.col * grid.cellSize;
    const y = grid.y + paddingOffset + pos.row * grid.cellSize;
    return { x, y };
  }
}

interface ChessboardBounds {
  canvas: {
    width: number,
    height: number,
  },
  grid: {
    x: number,
    y: number,
    cellSize: number
  },
  chessGap: number,
  chessRadius: number,
}
