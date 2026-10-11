import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanInput } from '../lib/plan';
import {
  CANVAS_SIZE,
  SIZE_NOTE,
  SNAP_CM,
  buildLayout,
  clampToTent,
  downloadLayout,
  drawLayout,
  findShapeAt,
  snapToGrid,
  toTentPoint,
  type BoardAlign,
  type LayoutOptions,
} from '../lib/layout';

type Props = {
  plan: PlanInput;
  options: LayoutOptions;
  onOptionsChange: (options: LayoutOptions) => void;
  onBack: () => void;
};

const ALIGN_LABELS: Record<BoardAlign, string> = { left: '左寄せ', right: '右寄せ' };

/** 掴んでいる図形と、図形の左上から掴んだ点までのずれ（cm） */
type Drag = { id: string; offsetX: number; offsetY: number };

export default function LayoutStep({ plan, options, onOptionsChange, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const layout = useMemo(() => buildLayout(plan, options), [plan, options]);
  const movedCount = Object.keys(options.moved).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawLayout(canvas, layout, plan, drag?.id ?? null);
    if (!drag) canvas.toBlob((blob) => setFileSize(blob ? blob.size : null), 'image/png');
  }, [layout, plan, drag]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = toTentPoint(canvas, event.clientX, event.clientY);
    const shape = findShapeAt(layout.shapes, point.x, point.y);
    if (!shape) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // 指やマウスが外れている場合は掴みっぱなしにしないだけでよい
    }
    setDrag({ id: shape.id, offsetX: point.x - shape.x, offsetY: point.y - shape.y });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drag) return;
    const shape = layout.shapes.find((item) => item.id === drag.id);
    if (!shape) return;
    const point = toTentPoint(canvas, event.clientX, event.clientY);
    const next = clampToTent(
      {
        x: snapToGrid(point.x - drag.offsetX),
        y: snapToGrid(point.y - drag.offsetY),
      },
      shape,
    );
    if (next.x === shape.x && next.y === shape.y) return;

    const moved = { ...options.moved, [drag.id]: next };
    // 石膏ボードは机の上に置くものなので、机を動かしたら一緒に動かす
    if (drag.id === 'table') {
      const dx = next.x - shape.x;
      const dy = next.y - shape.y;
      layout.shapes
        .filter((item) => item.id.startsWith('board-'))
        .forEach((board) => {
          moved[board.id] = clampToTent({ x: board.x + dx, y: board.y + dy }, board);
        });
    }
    onOptionsChange({ ...options, moved });
  }

  function endDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    try {
      if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch {
      // 解放できなくても掴んだ状態を解くだけでよい
    }
    setDrag(null);
  }

  /** 石膏ボードの寄せ方を変えたら、ボードを動かした分は捨てて並べ直す */
  function changeAlign(boardAlign: BoardAlign) {
    const moved = Object.fromEntries(
      Object.entries(options.moved).filter(([id]) => !id.startsWith('board-')),
    );
    onOptionsChange({ boardAlign, moved });
  }

  return (
    <section className="card">
      <h2>6. 配置見取り図を書き出す</h2>
      <p className="lead">
        企画情報で選んだ物品から、テント内の配置を自動で描きます。はじめの置き場所はフォームの例に
        合わせてあります。図の中の物をドラッグすれば動かせます（{SNAP_CM}cm 刻み）。
      </p>

      <div className="field">
        <label>机の上の石膏ボード</label>
        <div className="choices">
          {(Object.keys(ALIGN_LABELS) as BoardAlign[]).map((align) => (
            <label key={align} className="choice">
              <input
                type="radio"
                name="board-align"
                checked={options.boardAlign === align}
                onChange={() => changeAlign(align)}
              />
              {ALIGN_LABELS[align]}
            </label>
          ))}
        </div>
        <p className="note">石膏ボードの幅の合計：{layout.boardTotal}cm</p>
      </div>

      {layout.warnings.length > 0 && (
        <div className="alert warn">
          <ul>
            {layout.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="layout-preview">
        <canvas
          ref={canvasRef}
          className={drag ? 'dragging' : undefined}
          width={CANVAS_SIZE.width}
          height={CANVAS_SIZE.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="配置見取り図。図の中の物はドラッグで動かせます"
        />
      </div>

      {layout.notes.map((note) => (
        <p className="note" key={note}>
          {note}
        </p>
      ))}

      <p className="note">
        テントの大きさ（4m × 2.8m）と、消火器・発電機・プロパンガスのはじめの置き場所は、
        フォームの配置見取り図（例）に合わせています。例の図が変わった年は
        <code>src/lib/layout.ts</code> の数値を直してください。
      </p>
      <p className="note">
        寸法の想定：{SIZE_NOTE}。この数値は実物を確認できていないので、違っていれば同じファイルで直せます。
      </p>

      {fileSize !== null && (
        <p className="note">
          書き出すPNGの大きさ：約{Math.max(1, Math.round(fileSize / 1024))}KB（{CANVAS_SIZE.width}×
          {CANVAS_SIZE.height}px）。フォームの上限10MBに対して十分小さいサイズです。
        </p>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          シフト表に戻る
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => onOptionsChange({ ...options, moved: {} })}
          disabled={movedCount === 0}
        >
          自動配置に戻す{movedCount > 0 ? `（${movedCount}個を移動中）` : ''}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (canvasRef.current) downloadLayout(canvasRef.current, plan);
          }}
        >
          PNG で書き出す
        </button>
      </div>
    </section>
  );
}
