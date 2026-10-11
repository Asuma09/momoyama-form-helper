import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanInput } from '../lib/plan';
import {
  CANVAS_SIZE,
  SIZE_NOTE,
  buildLayout,
  downloadLayout,
  drawLayout,
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

export default function LayoutStep({ plan, options, onOptionsChange, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useMemo(() => buildLayout(plan, options), [plan, options]);
  const [fileSize, setFileSize] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawLayout(canvas, layout, plan);
    canvas.toBlob((blob) => setFileSize(blob ? blob.size : null), 'image/png');
  }, [layout, plan]);

  return (
    <section className="card">
      <h2>6. 配置見取り図を書き出す</h2>
      <p className="lead">
        企画情報で選んだ物品から、テント内の配置を自動で描きます。配置はフォームの例と同じ形に
        決まっているので、動かすのではなく、画像を書き出してから必要なら手で直してください。
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
                onChange={() => onOptionsChange({ ...options, boardAlign: align })}
              />
              {ALIGN_LABELS[align]}
            </label>
          ))}
        </div>
        <p className="note">
          石膏ボードの幅の合計：{layout.boardTotal}cm
        </p>
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
          width={CANVAS_SIZE.width}
          height={CANVAS_SIZE.height}
          aria-label="配置見取り図のプレビュー"
        />
      </div>

      {layout.notes.map((note) => (
        <p className="note" key={note}>
          {note}
        </p>
      ))}

      <p className="note">
        テントの大きさ（4m × 2.8m）と、消火器・発電機・プロパンガスの位置は、
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
