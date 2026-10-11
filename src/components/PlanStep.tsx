import { useEffect, useState } from 'react';
import AiDraft from './AiDraft';
import { checkAiAvailability, type AiAvailability, type DraftRequest } from '../lib/ai';
import {
  BOARD_LABELS,
  EMPTY_BOARDS,
  EXTINGUISHER_NO_FIRE,
  PLAN_FIELDS,
  formatBoards,
  needsRegulatorCheck,
  planFieldId,
  unfilledPlanFields,
  type BoardSize,
  type PlanChoiceKey,
  type PlanField,
  type PlanInput,
  type PlanTextKey,
} from '../lib/plan';

type Props = {
  plan: PlanInput;
  onChange: (plan: PlanInput) => void;
  onBack: () => void;
  onNext: () => void;
};

/** AI の下書きが使える項目と、元になる値の作り方 */
function draftRequestFor(key: PlanTextKey, plan: PlanInput): DraftRequest | null {
  const products = [plan.productAll, plan.productShort].map((v) => v.trim()).find(Boolean);
  if (!products) return null;
  if (key === 'ingredients') return { kind: 'ingredients', products };
  if (key === 'method') return { kind: 'method', products, ingredients: plan.ingredients };
  return null;
}

export default function PlanStep({ plan, onChange, onBack, onNext }: Props) {
  const [aiAvailability, setAiAvailability] = useState<AiAvailability>('unavailable');

  useEffect(() => {
    let active = true;
    checkAiAvailability().then((result) => {
      if (active) setAiAvailability(result);
    });
    return () => {
      active = false;
    };
  }, []);

  function patch(changes: Partial<PlanInput>) {
    onChange({ ...plan, ...changes });
  }

  function setText(key: PlanTextKey, value: string) {
    patch({ [key]: value } as Partial<PlanInput>);
  }

  function setChoice(key: PlanChoiceKey, value: string) {
    if (key === 'extinguisher' && value === EXTINGUISHER_NO_FIRE) {
      patch({ extinguisher: value, boards: { ...EMPTY_BOARDS } });
      return;
    }
    patch({ [key]: value } as Partial<PlanInput>);
  }

  function setBoard(size: BoardSize, value: string) {
    patch({ boards: { ...plan.boards, [size]: value.replace(/\D/g, '') } });
  }

  const unfilled = unfilledPlanFields(plan);

  function renderField(field: PlanField) {
    const id = planFieldId(field);
    switch (field.kind) {
      case 'text':
        return (
          <input
            id={id}
            type="text"
            value={plan[field.key]}
            placeholder={field.placeholder}
            onChange={(event) => setText(field.key, event.target.value)}
          />
        );
      case 'multiline':
        return (
          <textarea
            id={id}
            rows={field.rows}
            value={plan[field.key]}
            placeholder={field.placeholder}
            onChange={(event) => setText(field.key, event.target.value)}
          />
        );
      case 'choice':
        return (
          <div className="choices">
            {field.options.map((option) => (
              <label key={option} className="choice">
                <input
                  type="radio"
                  name={id}
                  value={option}
                  checked={plan[field.key] === option}
                  onChange={() => setChoice(field.key, option)}
                />
                {option}
              </label>
            ))}
          </div>
        );
      case 'number':
        return (
          <span className="with-unit">
            <input
              id={id}
              type="text"
              inputMode="numeric"
              value={plan[field.key]}
              onChange={(event) => setText(field.key, event.target.value.replace(/\D/g, ''))}
            />
            {field.unit}
          </span>
        );
      case 'boards':
        return (
          <>
            <div className="boards">
              {(Object.keys(BOARD_LABELS) as BoardSize[]).map((size) => (
                <label key={size} className="board">
                  {BOARD_LABELS[size]}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={plan.boards[size]}
                    onChange={(event) => setBoard(size, event.target.value)}
                  />
                  枚
                </label>
              ))}
            </div>
            <p className="note">コピーする内容：{formatBoards(plan.boards)}</p>
          </>
        );
    }
  }

  return (
    <section className="card">
      <h2>3. 企画情報を入力する</h2>
      <p className="lead">
        名簿から埋まらない項目を入力します。入力した内容はコピペ一覧にフォームと同じ順で並びます。
        選択肢はフォームの文言どおりです。
      </p>

      {aiAvailability !== 'unavailable' && (
        <p className="note ai-notice">
          「全ての材料」と「調理方法」は、Chrome 内蔵の AI で下書きを作れます。
          AI はこの端末の中だけで動き、渡すのは販売商品名と材料だけです（名簿は渡しません）。
          {aiAvailability !== 'available' &&
            '初めて使うときだけ、Chrome が AI モデル（数GB）をダウンロードします。'}
        </p>
      )}

      {needsRegulatorCheck(plan) && (
        <p className="alert warn">
          プロパンガスを希望して調整機を希望しない設定です。過去に購入した調整機が保管されているか確認してください。
        </p>
      )}

      {PLAN_FIELDS.map((field) => {
        const aiKey =
          field.kind === 'multiline' && (field.key === 'ingredients' || field.key === 'method')
            ? field.key
            : null;
        return (
          <div className="field plan-field" key={planFieldId(field)}>
            <label htmlFor={field.kind === 'choice' || field.kind === 'boards' ? undefined : planFieldId(field)}>
              {field.label}
            </label>
            {field.note && <p className="field-note">{field.note}</p>}
            {renderField(field)}
            {aiKey && (
              <AiDraft
                availability={aiAvailability}
                request={draftRequestFor(aiKey, plan)}
                hint="先に「販売商品名」を入力してください"
                onInsert={(text) => setText(aiKey, text)}
              />
            )}
          </div>
        );
      })}

      {unfilled.length > 0 && (
        <p className="note">
          未入力：{unfilled.map((field) => field.label).join('、')}
          （空欄のままでも一覧に進めます）
        </p>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          確認に戻る
        </button>
        <button type="button" className="primary" onClick={onNext}>
          コピペ一覧へ進む
        </button>
      </div>
    </section>
  );
}
