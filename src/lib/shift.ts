import * as XLSX from 'xlsx-js-style';
import type { Member } from './roster';

export type ShiftPreset = { label: string; title: string; duties: string[] };

export const SHIFT_PRESETS: ShiftPreset[] = [
  {
    label: '下ごしらえ調理',
    title: '下ごしらえ調理シフト表',
    duties: ['具材を切る係', '具材を混ぜる係', '金銭係'],
  },
  { label: '店番', title: '店番表', duties: ['販売係', '調理係', '金銭係'] },
];

export type ShiftSettings = {
  /** シート名とファイル名に使う */
  title: string;
  includeExample: boolean;
  exampleHeader: string;
  dateLabels: string[];
  timeSlots: string[];
  duties: string[];
  /** 斜線で空ける枠。[時間帯][日付] */
  closed: boolean[][];
};

export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = {
  title: '下ごしらえ調理シフト表',
  includeExample: true,
  exampleHeader: '例（焼きそば）',
  dateLabels: ['２１日（金）', '２２日（土）', '２３日（日）'],
  timeSlots: ['10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-17:00'],
  duties: ['具材を切る係', '具材を混ぜる係', '金銭係'],
  closed: [
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, true],
  ],
};

/** 時間帯や日付の数が変わっても、重なる範囲の斜線設定は残す */
export function resizeClosed(closed: boolean[][], slots: number, days: number): boolean[][] {
  return Array.from({ length: slots }, (_, slot) =>
    Array.from({ length: days }, (_, day) => closed[slot]?.[day] ?? false),
  );
}

export type ShiftEntry = { name: string; duty: string };
export type ShiftCell = { closed: boolean; entries: ShiftEntry[] };
export type ShiftTable = { slot: string; cells: ShiftCell[] }[];

/** 名簿の上から順に入れ、最後まで行ったら先頭に戻す */
export function buildShiftTable(order: Member[], settings: ShiftSettings): ShiftTable {
  const names = order.map((member) => member.name).filter(Boolean);
  const { timeSlots, dateLabels, duties } = settings;
  const table: ShiftTable = timeSlots.map((slot, slotIndex) => ({
    slot,
    cells: dateLabels.map((_, dayIndex) => ({
      closed: settings.closed[slotIndex]?.[dayIndex] ?? false,
      entries: [] as ShiftEntry[],
    })),
  }));

  let cursor = 0;
  dateLabels.forEach((_, dayIndex) => {
    timeSlots.forEach((_slot, slotIndex) => {
      const cell = table[slotIndex].cells[dayIndex];
      if (cell.closed) return;
      cell.entries = duties.map((duty) => {
        const name = names.length > 0 ? names[cursor % names.length] : '';
        cursor += 1;
        return { name, duty };
      });
    });
  });

  return table;
}

export function cellText(cell: ShiftCell): string {
  if (cell.closed) return '';
  return cell.entries.flatMap((entry) => [entry.name, entry.duty]).join('\n');
}

function exampleCell(slotIndex: number, duties: string[]): ShiftCell {
  return {
    closed: false,
    entries: duties.map((duty, index) => {
      const letter = String.fromCharCode(65 + ((slotIndex * duties.length + index) % 26));
      return { name: `${letter}さん`, duty };
    }),
  };
}

export function exampleColumn(settings: ShiftSettings): ShiftCell[] {
  return settings.timeSlots.map((_slot, index) => exampleCell(index, settings.duties));
}

export function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const LINE = { style: 'thin', color: { rgb: 'FF000000' } } as const;
const BOX = { top: LINE, bottom: LINE, left: LINE, right: LINE } as const;

const HEADER_STYLE = {
  border: BOX,
  font: { bold: true },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  fill: { fgColor: { rgb: 'FFF2F2F2' } },
};

const SLOT_STYLE = {
  border: BOX,
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const BODY_STYLE = {
  border: BOX,
  alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
};

const CLOSED_STYLE = {
  border: { ...BOX, diagonal: LINE, diagonalUp: true, diagonalDown: true },
};

/** シート名に使えない文字を落とす */
function sheetName(title: string): string {
  const cleaned = title.replace(/[\\/?*[\]:]/g, '').trim();
  return (cleaned || 'シフト表').slice(0, 31);
}

export function buildShiftWorkbook(table: ShiftTable, settings: ShiftSettings): XLSX.WorkBook {
  const example = exampleColumn(settings);
  const header = [
    '',
    ...(settings.includeExample ? [settings.exampleHeader] : []),
    ...settings.dateLabels,
  ];
  const body = table.map((row, slotIndex) => [
    row.slot,
    ...(settings.includeExample ? [cellText(example[slotIndex])] : []),
    ...row.cells.map(cellText),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[address] ?? { t: 's', v: '' };
      const dayIndex = c - (settings.includeExample ? 2 : 1);
      const isClosed = r > 0 && dayIndex >= 0 && table[r - 1]?.cells[dayIndex]?.closed;
      if (r === 0) cell.s = HEADER_STYLE;
      else if (c === 0) cell.s = SLOT_STYLE;
      else if (isClosed) cell.s = CLOSED_STYLE;
      else cell.s = BODY_STYLE;
      sheet[address] = cell;
    }
  }

  sheet['!cols'] = [
    { wch: 13 },
    ...(settings.includeExample ? [{ wch: 20 }] : []),
    ...settings.dateLabels.map(() => ({ wch: 20 })),
  ];
  sheet['!rows'] = [
    { hpt: 24 },
    ...table.map(() => ({ hpt: Math.max(settings.duties.length * 2 * 15, 60) })),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName(settings.title));
  return workbook;
}

export function downloadShift(table: ShiftTable, settings: ShiftSettings): void {
  const workbook = buildShiftWorkbook(table, settings);
  XLSX.writeFile(workbook, `${sheetName(settings.title)}.xlsx`);
}
