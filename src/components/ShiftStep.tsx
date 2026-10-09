import { useEffect, useMemo, useState } from 'react';
import type { Member } from '../lib/roster';
import {
  SHIFT_PRESETS,
  buildShiftTable,
  downloadShift,
  exampleColumn,
  resizeClosed,
  type ShiftCell,
  type ShiftSettings,
} from '../lib/shift';

type Props = {
  order: Member[];
  settings: ShiftSettings;
  onSettingsChange: (settings: ShiftSettings) => void;
  onShuffle: () => void;
  onResetOrder: () => void;
  onBack: () => void;
};

type LinesFieldProps = {
  id: string;
  label: string;
  note?: string;
  value: string[];
  onChange: (value: string[]) => void;
};

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** 1行に1つ入力させる欄。入力中の空行を消さないよう、表示用の文字列は中で持つ */
function LinesField({ id, label, note, value, onChange }: LinesFieldProps) {
  const [text, setText] = useState(value.join('\n'));

  useEffect(() => {
    if (parseLines(text).join('\n') !== value.join('\n')) setText(value.join('\n'));
    // 外から値が変わったときだけ表示を合わせる
  }, [value]);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {note && <p className="field-note">{note}</p>}
      <textarea
        id={id}
        rows={Math.max(value.length + 1, 3)}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseLines(event.target.value));
        }}
      />
    </div>
  );
}

function Entries({ cell }: { cell: ShiftCell }) {
  return (
    <>
      {cell.entries.map((entry, index) => (
        <div className="shift-entry" key={index}>
          {entry.name || '（空欄）'}
          <span className="shift-duty">{entry.duty}</span>
        </div>
      ))}
    </>
  );
}

export default function ShiftStep({
  order,
  settings,
  onSettingsChange,
  onShuffle,
  onResetOrder,
  onBack,
}: Props) {
  const table = useMemo(() => buildShiftTable(order, settings), [order, settings]);
  const example = useMemo(() => exampleColumn(settings), [settings]);

  function update(changes: Partial<ShiftSettings>) {
    const next = { ...settings, ...changes };
    next.closed = resizeClosed(next.closed, next.timeSlots.length, next.dateLabels.length);
    onSettingsChange(next);
  }

  function toggleClosed(slotIndex: number, dayIndex: number) {
    const closed = settings.closed.map((row) => [...row]);
    closed[slotIndex][dayIndex] = !closed[slotIndex][dayIndex];
    update({ closed });
  }

  const shortStaff = order.length > 0 && order.length < settings.duties.length;

  return (
    <section className="card">
      <h2>5. シフト表を書き出す</h2>
      <p className="lead">
        行が時間帯、列が日付の表を Excel（.xlsx）で書き出します。名簿の上から順に係へ割り当て、
        最後まで行ったら先頭に戻ります。提出前に Excel 上で直す前提の仮シフトです。
      </p>

      <div className="preset-row">
        {SHIFT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="secondary"
            onClick={() => update({ title: preset.title, duties: preset.duties })}
          >
            {preset.label}の設定にする
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="shift-title">表の名前（シート名とファイル名に使う）</label>
        <input
          id="shift-title"
          type="text"
          value={settings.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </div>

      <LinesField
        id="shift-dates"
        label="日付（1行に1つ）"
        value={settings.dateLabels}
        onChange={(dateLabels) => update({ dateLabels })}
      />
      <LinesField
        id="shift-slots"
        label="時間帯（1行に1つ）"
        note="その年の営業時間に合わせて直してください。"
        value={settings.timeSlots}
        onChange={(timeSlots) => update({ timeSlots })}
      />
      <LinesField
        id="shift-duties"
        label="係（1行に1つ）"
        note="1つの時間帯に、ここに書いた係をそれぞれ1人ずつ入れます。"
        value={settings.duties}
        onChange={(duties) => update({ duties })}
      />

      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.includeExample}
          onChange={(event) => update({ includeExample: event.target.checked })}
        />
        記入例の列（{settings.exampleHeader}）を入れる
      </label>

      {shortStaff && (
        <p className="alert warn">
          名簿の人数（{order.length}人）が係の数（{settings.duties.length}）より少ないため、
          同じ時間帯に同じ人が複数の係に入ります。
        </p>
      )}

      <h3>割り当て（「斜線」にチェックを入れた枠は空けます）</h3>
      <table className="table shift-table">
        <thead>
          <tr>
            <th />
            {settings.includeExample && <th>{settings.exampleHeader}</th>}
            {settings.dateLabels.map((date) => (
              <th key={date}>{date}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, slotIndex) => (
            <tr key={row.slot}>
              <th>{row.slot}</th>
              {settings.includeExample && (
                <td className="shift-example">
                  <Entries cell={example[slotIndex]} />
                </td>
              )}
              {row.cells.map((cell, dayIndex) => (
                <td
                  key={settings.dateLabels[dayIndex]}
                  className={cell.closed ? 'shift-closed' : undefined}
                >
                  <label className="checkbox small">
                    <input
                      type="checkbox"
                      checked={cell.closed}
                      onChange={() => toggleClosed(slotIndex, dayIndex)}
                    />
                    斜線
                  </label>
                  {!cell.closed && <Entries cell={cell} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          コピペ一覧に戻る
        </button>
        <button type="button" className="secondary" onClick={onShuffle}>
          ランダムに並べ替える
        </button>
        <button type="button" className="secondary" onClick={onResetOrder}>
          名簿順に戻す
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => downloadShift(table, settings)}
          disabled={order.length === 0}
        >
          Excel で書き出す
        </button>
      </div>
    </section>
  );
}
