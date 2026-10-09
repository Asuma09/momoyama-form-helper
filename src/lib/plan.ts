import type { CopyItem } from './roster';

export const WANT = '希望する';
export const NOT_WANT = '希望しない';
export const EXTINGUISHER_AGREE = '同意する';
export const EXTINGUISHER_NO_FIRE = '火器を使用しないため必要ない';

export type PlanTextKey =
  | 'productShort'
  | 'productAll'
  | 'prices'
  | 'ingredients'
  | 'method'
  | 'sales';

export type PlanChoiceKey =
  | 'propane'
  | 'regulator'
  | 'generator'
  | 'chairs'
  | 'tables'
  | 'extinguisher'
  | 'threeDays';

export type BoardSize = 'small' | 'medium' | 'large';

export type PlanInput = Record<PlanTextKey, string> &
  Record<PlanChoiceKey, string> & { boards: Record<BoardSize, string> };

export type PlanField =
  | { kind: 'text'; key: PlanTextKey; label: string; note?: string; placeholder?: string }
  | {
      kind: 'multiline';
      key: PlanTextKey;
      label: string;
      note?: string;
      placeholder?: string;
      rows: number;
    }
  | { kind: 'choice'; key: PlanChoiceKey; label: string; note?: string; options: string[] }
  | { kind: 'number'; key: PlanTextKey; label: string; note?: string; unit: string }
  | { kind: 'boards'; label: string; note?: string };

/** フォームと同じ順番。選択肢の文言もフォームのまま。 */
export const PLAN_FIELDS: PlanField[] = [
  {
    kind: 'text',
    key: 'productShort',
    label: '販売商品名（簡潔に）',
    note: 'パンフレットに載る',
    placeholder: '焼きそば',
  },
  {
    kind: 'multiline',
    key: 'productAll',
    label: '販売商品名（すべて）',
    note: '販売するものをすべて',
    rows: 3,
  },
  {
    kind: 'multiline',
    key: 'prices',
    label: '販売価格',
    note: '例：焼きそば 300円',
    rows: 3,
  },
  { kind: 'multiline', key: 'ingredients', label: '全ての材料', rows: 4 },
  { kind: 'multiline', key: 'method', label: '調理方法（遊戯内容）', rows: 4 },
  {
    kind: 'choice',
    key: 'propane',
    label: 'プロパンガス',
    note: '予価9,000円／20kg',
    options: [WANT, NOT_WANT],
  },
  {
    kind: 'choice',
    key: 'regulator',
    label: '調整機',
    note: '過去に購入して保管していれば不要',
    options: [WANT, NOT_WANT],
  },
  {
    kind: 'choice',
    key: 'generator',
    label: '発電機',
    note: '1台でホットプレート1台分',
    options: ['希望する（1台）', '希望する（2台）', NOT_WANT],
  },
  {
    kind: 'choice',
    key: 'chairs',
    label: 'パイプイス',
    note: '0円×2個',
    options: [WANT, NOT_WANT],
  },
  {
    kind: 'choice',
    key: 'tables',
    label: '長机',
    note: '上限を超えたら抽選',
    options: [WANT, NOT_WANT],
  },
  {
    kind: 'choice',
    key: 'extinguisher',
    label: '消火器',
    note: '火器を使うなら必須',
    options: [EXTINGUISHER_AGREE, EXTINGUISHER_NO_FIRE],
  },
  { kind: 'boards', label: '石膏ボード', note: '小・中・大それぞれの枚数' },
  {
    kind: 'choice',
    key: 'threeDays',
    label: '3日間出店するか',
    options: ['3日間とも出店する', '3日間とも出店できない'],
  },
  {
    kind: 'number',
    key: 'sales',
    label: '売上金額',
    note: '前年に出店していれば昨年度の売上、初出店なら目標',
    unit: '円',
  },
];

export const EMPTY_BOARDS: Record<BoardSize, string> = { small: '0', medium: '0', large: '0' };

export const EMPTY_PLAN: PlanInput = {
  productShort: '',
  productAll: '',
  prices: '',
  ingredients: '',
  method: '',
  sales: '',
  propane: '',
  regulator: '',
  generator: '',
  chairs: '',
  tables: '',
  extinguisher: '',
  threeDays: '',
  boards: { ...EMPTY_BOARDS },
};

export const BOARD_LABELS: Record<BoardSize, string> = { small: '小', medium: '中', large: '大' };

function boardCount(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export function formatBoards(boards: Record<BoardSize, string>): string {
  return (Object.keys(BOARD_LABELS) as BoardSize[])
    .map((size) => `${BOARD_LABELS[size]} ${boardCount(boards[size])}枚`)
    .join(' / ');
}

/** プロパンガスを希望しつつ調整機を希望しない場合は、保管分があるか確認してもらう */
export function needsRegulatorCheck(plan: PlanInput): boolean {
  return plan.propane === WANT && plan.regulator === NOT_WANT;
}

function fieldValue(plan: PlanInput, field: PlanField): string {
  if (field.kind === 'boards') return formatBoards(plan.boards);
  return plan[field.key].trim();
}

export function planFieldId(field: PlanField): string {
  return field.kind === 'boards' ? 'plan-boards' : `plan-${field.key}`;
}

export function unfilledPlanFields(plan: PlanInput): PlanField[] {
  return PLAN_FIELDS.filter((field) => field.kind !== 'boards' && !fieldValue(plan, field));
}

export function buildPlanCopyItems(plan: PlanInput): CopyItem[] {
  return PLAN_FIELDS.map((field) => {
    const value = fieldValue(plan, field);
    return {
      id: planFieldId(field),
      label: field.label,
      source: field.note ?? '企画情報',
      value,
      warning: value ? undefined : '未入力です',
    };
  });
}
