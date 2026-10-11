/**
 * 配置見取り図。企画情報で選んだ物品の有無から、ルールで配置を決める（AI は使わない）。
 *
 * - 位置の調整はできない仕様なので、座標はすべてこのファイルの定数から決まる。
 * - フォームの配置見取り図（例）が変わった年は、下の寸法と POSITION の数値を直せばよい。
 * - 書き出しは PNG 1枚。描くのは図形と文字だけなので、サイズは数十KBに収まる。
 */

import {
  BOARD_LABELS,
  EXTINGUISHER_AGREE,
  EXTINGUISHER_NO_FIRE,
  WANT,
  boardCount,
  type BoardSize,
  type PlanInput,
} from './plan';

/**
 * テントの内側の寸法（cm）。フォームの配置見取り図（例）の 4.0m × 2.8m に合わせている。
 * 手前（下）が「お客様が並ぶ側」。
 */
export const TENT = { width: 400, depth: 280 };

/** 什器の寸法（cm）。石膏ボードは幅だけ変え、奥行きは長机と同じとして描く。 */
export const SIZES = {
  table: { width: 180, depth: 45 },
  boardWidth: { small: 45, medium: 60, large: 90 } as Record<BoardSize, number>,
  boardDepth: 45,
  /** 20kg ボンベの直径 */
  propane: 37,
  generator: { width: 60, depth: 45 },
  chair: { width: 45, depth: 45 },
  extinguisher: 25,
};

/** 壁から取る余白（cm） */
const MARGIN = 15;

/** 寸法が想定値であることを図と画面の両方に出す */
export const SIZE_NOTE = `長机 ${SIZES.table.width}×${SIZES.table.depth}cm / プロパンガス 20kgボンベ / 石膏ボードの幅 小${SIZES.boardWidth.small}・中${SIZES.boardWidth.medium}・大${SIZES.boardWidth.large}cm`;

export type Point = { x: number; y: number };

export type BoardAlign = 'left' | 'right';
export type LayoutOptions = {
  boardAlign: BoardAlign;
  /** ドラッグで動かしたものだけ、図形の id をキーに置き場所を覚える */
  moved: Record<string, Point>;
};
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = { boardAlign: 'left', moved: {} };

/** ドラッグ中に位置を丸める刻み（cm） */
export const SNAP_CM = 5;

export type ShapeTone = 'table' | 'board' | 'gas' | 'power' | 'fire' | 'chair';

export type Shape = {
  id: string;
  kind: 'rect' | 'circle';
  label: string;
  sub?: string;
  /** テント内の座標（cm）。原点はテントの左奥。円も外接する四角の左上で持つ */
  x: number;
  y: number;
  width: number;
  height: number;
  tone: ShapeTone;
  /** 上に別の図形が重なるものは、名前を図形の外に出す */
  labelOutside?: boolean;
};

export type Layout = {
  shapes: Shape[];
  warnings: string[];
  notes: string[];
  /** 石膏ボードの幅の合計（cm） */
  boardTotal: number;
};

/** 長机は通路側（図の下）に寄せ、その奥にイス、奥の壁沿いにガスと発電機を置く */
const TABLE_X = (TENT.width - SIZES.table.width) / 2;
const TABLE_Y = TENT.depth - MARGIN - SIZES.table.depth;

function generatorCount(value: string): number {
  if (value === '希望する（1台）') return 1;
  if (value === '希望する（2台）') return 2;
  return 0;
}

export function buildLayout(plan: PlanInput, options: LayoutOptions): Layout {
  const shapes: Shape[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const hasTable = plan.tables === WANT;
  if (hasTable) {
    shapes.push({
      id: 'table',
      kind: 'rect',
      label: '長机',
      sub: `${SIZES.table.width}×${SIZES.table.depth}cm`,
      x: TABLE_X,
      y: TABLE_Y,
      width: SIZES.table.width,
      height: SIZES.table.depth,
      tone: 'table',
      labelOutside: true,
    });
  }

  // 石膏ボードは机の上に、左寄せか右寄せで並べる
  const boards = (Object.keys(BOARD_LABELS) as BoardSize[]).flatMap((size) =>
    Array.from({ length: boardCount(plan.boards[size]) }, () => size),
  );
  const boardTotal = boards.reduce((sum, size) => sum + SIZES.boardWidth[size], 0);
  if (boards.length > 0) {
    // 机に収まらない枚数のときは、はみ出さないように描く幅だけ縮める。
    // 本当の幅は図の中の文字と警告で伝えるので、縮めるのは見た目だけ。
    const shrink = boardTotal > SIZES.table.width ? SIZES.table.width / boardTotal : 1;
    const drawTotal = boardTotal * shrink;
    const aligned =
      options.boardAlign === 'left' ? TABLE_X : TABLE_X + SIZES.table.width - drawTotal;
    let cursor = aligned;
    boards.forEach((size, index) => {
      const width = SIZES.boardWidth[size];
      shapes.push({
        id: `board-${index}`,
        kind: 'rect',
        label: `石膏ボード${BOARD_LABELS[size]}`,
        sub: `幅${width}cm`,
        x: cursor,
        y: TABLE_Y,
        width: width * shrink,
        height: SIZES.boardDepth,
        tone: 'board',
      });
      cursor += width * shrink;
    });
    if (boardTotal > SIZES.table.width) {
      warnings.push(
        `石膏ボードの幅の合計が${boardTotal}cmで、長机の${SIZES.table.width}cmを超えます。枚数を見直すか、机に収まるか確認してください。`,
      );
      notes.push(
        `石膏ボードは机に収まらないので、図では机の幅（${SIZES.table.width}cm）に合わせて縮めて描いています。図の中の幅の数値は実際の値です。`,
      );
    }
    if (!hasTable) {
      warnings.push(
        '長机を希望していないので、石膏ボードを置く机がありません。図では机があるつもりの位置に描いています。',
      );
    }
  }

  if (plan.propane === WANT) {
    // フォームの例に合わせて手前の左
    shapes.push({
      id: 'propane',
      kind: 'circle',
      label: 'プロパンガス',
      sub: plan.regulator === WANT ? '20kg・調整機つき' : '20kg',
      x: MARGIN,
      y: TENT.depth - MARGIN - SIZES.propane,
      width: SIZES.propane,
      height: SIZES.propane,
      tone: 'gas',
    });
  } else if (plan.regulator === WANT) {
    notes.push('調整機だけを希望しているため、図にはプロパンガスを描いていません。');
  }

  // フォームの例に合わせて奥の右
  const generators = generatorCount(plan.generator);
  for (let index = 0; index < generators; index += 1) {
    shapes.push({
      id: `generator-${index}`,
      kind: 'rect',
      label: generators > 1 ? `発電機${index + 1}` : '発電機',
      x: TENT.width - MARGIN - SIZES.generator.width,
      y: MARGIN + index * (SIZES.generator.depth + 10),
      width: SIZES.generator.width,
      height: SIZES.generator.depth,
      tone: 'power',
    });
  }

  if (plan.chairs === WANT) {
    // パイプイスは2脚。机の奥に並べて座る向きにする
    const gap = 30;
    const left = (TENT.width - (SIZES.chair.width * 2 + gap)) / 2;
    [0, 1].forEach((index) => {
      shapes.push({
        id: `chair-${index}`,
        kind: 'rect',
        label: 'パイプイス',
        x: left + index * (SIZES.chair.width + gap),
        y: TABLE_Y - 10 - SIZES.chair.depth,
        width: SIZES.chair.width,
        height: SIZES.chair.depth,
        tone: 'chair',
      });
    });
  }

  if (plan.extinguisher === EXTINGUISHER_AGREE) {
    // フォームの例に合わせて奥の左
    shapes.push({
      id: 'extinguisher',
      kind: 'rect',
      label: '消火器',
      x: MARGIN,
      y: MARGIN,
      width: SIZES.extinguisher,
      height: SIZES.extinguisher,
      tone: 'fire',
    });
  } else if (plan.extinguisher === EXTINGUISHER_NO_FIRE) {
    notes.push('火器を使用しないため、消火器は描いていません。');
  }

  if (shapes.length === 0) {
    notes.push('企画情報で物品を選ぶと、ここに配置が描かれます。');
  }

  // ドラッグで動かしたものは、自動で決めた位置より優先する
  const placed = shapes.map((shape) => {
    const moved = options.moved[shape.id];
    return moved ? { ...shape, ...clampToTent(moved, shape) } : shape;
  });

  return { shapes: placed, warnings, notes, boardTotal };
}

/** テントからはみ出さない位置に丸める */
export function clampToTent(point: Point, size: { width: number; height: number }): Point {
  return {
    x: Math.min(Math.max(point.x, 0), Math.max(TENT.width - size.width, 0)),
    y: Math.min(Math.max(point.y, 0), Math.max(TENT.depth - size.height, 0)),
  };
}

export function snapToGrid(value: number): number {
  return Math.round(value / SNAP_CM) * SNAP_CM;
}

/** 重なっている場合は、後に描いたもの（上にあるもの）を掴む */
export function findShapeAt(shapes: Shape[], x: number, y: number): Shape | null {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (shape.kind === 'circle') {
      const radius = shape.width / 2;
      const dx = x - (shape.x + radius);
      const dy = y - (shape.y + radius);
      if (dx * dx + dy * dy <= radius * radius) return shape;
    } else if (
      x >= shape.x &&
      x <= shape.x + shape.width &&
      y >= shape.y &&
      y <= shape.y + shape.height
    ) {
      return shape;
    }
  }
  return null;
}

/* ---------------- ここから描画 ---------------- */

const PX_PER_CM = 3;
const PAD = 44;
const HEADER = 84;
const FOOTER = 96;
const GRID_CM = 50;

export const CANVAS_SIZE = {
  width: TENT.width * PX_PER_CM + PAD * 2,
  height: TENT.depth * PX_PER_CM + HEADER + FOOTER,
};

const INK = '#241f1a';
const MUTED = '#6b635a';
/** 掴んでいる図形の枠。styles.css の --accent と同じ色 */
const ACCENT = '#b4442f';
const FONT = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif";

const TONE_FILL: Record<ShapeTone, string> = {
  table: '#f2efe9',
  board: '#d9dde2',
  gas: '#fbeee8',
  power: '#eaf0ea',
  fire: '#fae2de',
  chair: '#faf7f2',
};

function label(size: number, bold = false): string {
  return `${bold ? 'bold ' : ''}${size}px ${FONT}`;
}

/** 画面の座標を、テント内の座標（cm）に直す。canvas は縮小表示されている */
export function toTentPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width > 0 ? canvas.width / rect.width : 1;
  return {
    x: ((clientX - rect.left) * scale - PAD) / PX_PER_CM,
    y: ((clientY - rect.top) * scale - HEADER) / PX_PER_CM,
  };
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, active: boolean): void {
  const x = PAD + shape.x * PX_PER_CM;
  const y = HEADER + shape.y * PX_PER_CM;
  const w = shape.width * PX_PER_CM;
  const h = shape.height * PX_PER_CM;

  ctx.fillStyle = TONE_FILL[shape.tone];
  ctx.strokeStyle = active ? ACCENT : INK;
  ctx.lineWidth = active ? 3 : 1.5;
  ctx.beginPath();
  if (shape.kind === 'circle') {
    ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
  ctx.stroke();

  // 図形に収まらない文字は図形の下に出す
  ctx.font = label(13);
  const fitsInside =
    !shape.labelOutside && ctx.measureText(shape.label).width <= w - 8 && h >= 34;
  const cx = Math.min(Math.max(x + w / 2, PAD + 48), CANVAS_SIZE.width - PAD - 48);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  if (fitsInside) {
    ctx.fillText(shape.label, x + w / 2, y + h / 2 + (shape.sub ? -2 : 5));
    if (shape.sub) {
      ctx.font = label(11);
      ctx.fillStyle = MUTED;
      ctx.fillText(shape.sub, x + w / 2, y + h / 2 + 14);
    }
  } else {
    ctx.fillText(shape.label, cx, y + h + 15);
    if (shape.sub) {
      ctx.font = label(11);
      ctx.fillStyle = MUTED;
      ctx.fillText(shape.sub, cx, y + h + 29);
    }
  }
}

export function drawLayout(
  canvas: HTMLCanvasElement,
  layout: Layout,
  plan: PlanInput,
  activeId?: string | null,
): void {
  canvas.width = CANVAS_SIZE.width;
  canvas.height = CANVAS_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 見出し
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = label(22, true);
  ctx.fillText('配置見取り図', PAD, 36);
  ctx.font = label(13);
  ctx.fillStyle = MUTED;
  const title = plan.productShort.trim();
  const tentText = `テント ${TENT.width / 100}m × ${TENT.depth / 100}m`;
  ctx.fillText(title ? `企画名：${title}　／　${tentText}` : tentText, PAD, 58);

  const left = PAD;
  const top = HEADER;
  const width = TENT.width * PX_PER_CM;
  const depth = TENT.depth * PX_PER_CM;

  // 方眼（50cm）
  ctx.strokeStyle = '#e6e0d6';
  ctx.lineWidth = 1;
  for (let cm = GRID_CM; cm < TENT.width; cm += GRID_CM) {
    ctx.beginPath();
    ctx.moveTo(left + cm * PX_PER_CM, top);
    ctx.lineTo(left + cm * PX_PER_CM, top + depth);
    ctx.stroke();
  }
  for (let cm = GRID_CM; cm < TENT.depth; cm += GRID_CM) {
    ctx.beginPath();
    ctx.moveTo(left, top + cm * PX_PER_CM);
    ctx.lineTo(left + width, top + cm * PX_PER_CM);
    ctx.stroke();
  }

  // テントの外枠
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(left, top, width, depth);

  layout.shapes.forEach((shape) => drawShape(ctx, shape, shape.id === activeId));

  // 寸法とお客様の向き（フォームの例と同じ位置に出す）
  ctx.font = label(12);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(`${TENT.width / 100}m`, left + width / 2, top + depth + 20);
  ctx.fillText('↓ お客様が並ぶ側', left + width / 2, top + depth + 38);
  ctx.save();
  ctx.translate(left + width + 16, top + depth / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(`${TENT.depth / 100}m`, 0, 0);
  ctx.restore();

  // 注記
  ctx.textAlign = 'left';
  ctx.font = label(11);
  ctx.fillStyle = MUTED;
  ctx.fillText(`方眼は${GRID_CM}cm。寸法の想定：${SIZE_NOTE}`, PAD, top + depth + 60);
  ctx.fillText(
    '企画情報で選んだ物品から自動で配置しています。実物と違う場合は図を直してください。',
    PAD,
    top + depth + 76,
  );
}

/** ファイル名に使えない文字を落とす */
function fileName(plan: PlanInput): string {
  const title = plan.productShort.trim().replace(/[\\/:*?"<>|]/g, '');
  return title ? `配置見取り図_${title}.png` : '配置見取り図.png';
}

export function downloadLayout(canvas: HTMLCanvasElement, plan: PlanInput): void {
  const name = fileName(plan);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // file:// でも使えるよう、解放は少し待ってから
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
