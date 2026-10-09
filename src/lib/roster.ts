import * as XLSX from 'xlsx';
import {
  normalizeHeader,
  normalizeKana,
  normalizeName,
  normalizePhone,
  normalizeStudentId,
  trimAll,
} from './normalize';

export type ColumnKey = 'role' | 'name' | 'kana' | 'studentId' | 'phone';

type ColumnDef = { key: ColumnKey; label: string; aliases: string[] };

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'role', label: '役職', aliases: ['役職', '役職名', '役'] },
  { key: 'name', label: '氏名', aliases: ['氏名', '名前', '氏名漢字'] },
  {
    key: 'kana',
    label: 'フリガナ',
    aliases: ['フリガナ', 'ふりがな', 'カナ', 'かな', '氏名フリガナ', '氏名カナ', '読み'],
  },
  { key: 'studentId', label: '学籍番号', aliases: ['学籍番号', '学生番号', '学番'] },
  {
    key: 'phone',
    label: '携帯番号',
    aliases: ['携帯番号', '携帯電話', '携帯電話番号', '携帯', '電話番号', 'tel'],
  },
];

/**
 * 見出し行を探す範囲（上から何行まで見るか）。
 * 構成員名簿は提出用の表が上にあり、部員一覧の見出しは20行目前後から始まる。
 */
const HEADER_SEARCH_ROWS = 100;

export type Member = {
  id: string;
  /** Excel 上の行番号（1始まり） */
  excelRow: number;
  /** 整形後の役職（原文のまま、前後の空白のみ除去） */
  role: string;
  /** 区切りで分割した役職 */
  roles: string[];
  name: string;
  kana: string;
  studentId: string;
  phone: string;
  phoneWarning?: string;
};

export type ParseSuccess = {
  ok: true;
  sheetName: string;
  headerExcelRow: number;
  columns: { key: ColumnKey; label: string; header: string; columnLetter: string }[];
  members: Member[];
  skippedRows: number;
};

export type ParseFailure = {
  ok: false;
  message: string;
  missingColumns?: string[];
};

export type ParseResult = ParseSuccess | ParseFailure;

const ROLE_SEPARATOR = /[・､、,，\/／|｜\s　]+/;

function splitRoles(role: string): string[] {
  return role
    .split(ROLE_SEPARATOR)
    .map((part) => trimAll(part))
    .filter((part) => part.length > 0);
}

function columnLetter(index: number): string {
  let n = index;
  let letter = '';
  do {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

export function readWorkbook(data: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(data, { type: 'array' });
}

/** 常に Excel の1行目を起点に読む（配列の添字と行番号をそろえる） */
function readRows(sheet: XLSX.WorkSheet, maxRows?: number): string[][] {
  const options: XLSX.Sheet2JSONOpts = {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
  };
  if (sheet['!ref']) {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    range.s.r = 0;
    if (maxRows !== undefined) {
      range.e.r = Math.min(range.e.r, maxRows - 1);
    }
    options.range = XLSX.utils.encode_range(range);
  }
  return XLSX.utils.sheet_to_json<string[]>(sheet, options);
}

/** 見出し行の各セルを、必要な5列のどれかに割り当てる */
function matchColumns(headerCells: string[]): Partial<Record<ColumnKey, number>> {
  const found: Partial<Record<ColumnKey, number>> = {};
  for (const def of COLUMN_DEFS) {
    const aliases = def.aliases.map(normalizeHeader);
    const index = headerCells.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
    if (index !== -1) found[def.key] = index;
  }
  return found;
}

/**
 * 見出し行を探す。
 * requireAll が true なら5列すべて揃う行だけを見出しとみなす（入部届など似た表を避けるため）。
 * false なら「氏名」と「学籍番号」の両方がある行を見出しとみなす（不足列を知らせるため）。
 */
function findHeaderRow(rows: string[][], requireAll: boolean): number {
  for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_ROWS); i += 1) {
    const matched = matchColumns(rows[i] ?? []);
    const ok = requireAll
      ? COLUMN_DEFS.every((def) => matched[def.key] !== undefined)
      : matched.name !== undefined && matched.studentId !== undefined;
    if (ok) return i;
  }
  return -1;
}

/** 名簿の見出しを持つシートを探す。見つからなければ最初のシートを返す。 */
export function findRosterSheet(workbook: XLSX.WorkBook): string {
  const probe = (requireAll: boolean) =>
    workbook.SheetNames.find((name) => {
      const sheet = workbook.Sheets[name];
      return sheet ? findHeaderRow(readRows(sheet, HEADER_SEARCH_ROWS), requireAll) !== -1 : false;
    });
  return probe(true) ?? probe(false) ?? workbook.SheetNames[0];
}

export function parseSheet(workbook: XLSX.WorkBook, sheetName: string): ParseResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { ok: false, message: `シート「${sheetName}」が見つかりません。` };
  }

  const rows = readRows(sheet);
  const strictIndex = findHeaderRow(rows, true);
  const headerIndex = strictIndex !== -1 ? strictIndex : findHeaderRow(rows, false);

  if (headerIndex === -1) {
    return {
      ok: false,
      message: `シート「${sheetName}」の上から${HEADER_SEARCH_ROWS}行以内に、「氏名」と「学籍番号」の両方を含む見出し行が見つかりませんでした。別のシートを選んでください。`,
    };
  }

  const headerCells = rows[headerIndex] ?? [];
  const columnIndex = {} as Record<ColumnKey, number>;
  const columns: ParseSuccess['columns'] = [];
  const missingColumns: string[] = [];

  for (const def of COLUMN_DEFS) {
    const aliases = def.aliases.map(normalizeHeader);
    const found = headerCells.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
    if (found === -1) {
      missingColumns.push(def.label);
      continue;
    }
    columnIndex[def.key] = found;
    columns.push({
      key: def.key,
      label: def.label,
      header: trimAll(headerCells[found]),
      columnLetter: columnLetter(found),
    });
  }

  if (missingColumns.length > 0) {
    return {
      ok: false,
      message: `名簿に必要な列が見つかりません：${missingColumns.join('、')}`,
      missingColumns,
    };
  }

  const members: Member[] = [];
  let skippedRows = 0;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const name = normalizeName(row[columnIndex.name]);
    if (!name) {
      if (row.some((cell) => trimAll(cell).length > 0)) skippedRows += 1;
      continue;
    }
    const role = trimAll(row[columnIndex.role]);
    const phone = normalizePhone(row[columnIndex.phone]);
    members.push({
      id: `row-${i + 1}`,
      excelRow: i + 1,
      role,
      roles: splitRoles(role),
      name,
      kana: normalizeKana(row[columnIndex.kana]),
      studentId: normalizeStudentId(row[columnIndex.studentId]),
      phone: phone.value,
      phoneWarning: phone.warning,
    });
  }

  return {
    ok: true,
    sheetName,
    headerExcelRow: headerIndex + 1,
    columns,
    members,
    skippedRows,
  };
}

export type RoleSettings = {
  /** 代表者になる役職名 */
  leaderRole: string;
  /** 幹部の役職名（配列の順が優先順） */
  officerRoles: string[];
};

export const DEFAULT_ROLE_SETTINGS: RoleSettings = {
  leaderRole: '部長',
  officerRoles: ['副部長', '会計', '文サ'],
};

export type Assignment = {
  /** 役職が代表者役職と一致した人 */
  leaderCandidates: Member[];
  /** 幹部役職の人（優先順 → 行順） */
  officerPool: Member[];
  /** 役職が対象外・空欄の人 */
  generalMembers: Member[];
};

/** 役職の値で代表者・幹部・一般部員に振り分ける（完全一致で判定） */
export function assignByRole(members: Member[], settings: RoleSettings): Assignment {
  const leaderRole = trimAll(settings.leaderRole);
  const officerRoles = settings.officerRoles.map(trimAll).filter(Boolean);

  const leaderCandidates: Member[] = [];
  const officers: { member: Member; priority: number }[] = [];
  const generalMembers: Member[] = [];

  members.forEach((member) => {
    if (leaderRole && member.roles.includes(leaderRole)) {
      leaderCandidates.push(member);
      return;
    }
    const priorities = member.roles
      .map((role) => officerRoles.indexOf(role))
      .filter((index) => index >= 0);
    if (priorities.length > 0) {
      officers.push({ member, priority: Math.min(...priorities) });
      return;
    }
    generalMembers.push(member);
  });

  officers.sort((a, b) => a.priority - b.priority || a.member.excelRow - b.member.excelRow);

  return {
    leaderCandidates,
    officerPool: officers.map((entry) => entry.member),
    generalMembers,
  };
}

export const OFFICER_SLOT_LABELS = ['①', '②', '③', '④'] as const;

export type CopyItem = {
  id: string;
  /** フォームの項目名 */
  label: string;
  /** 元になる列の説明 */
  source: string;
  value: string;
  warning?: string;
};

export function buildCopyItems(
  leader: Member | null,
  officers: (Member | null)[],
): CopyItem[] {
  const items: CopyItem[] = [
    {
      id: 'leader-name',
      label: '代表者名',
      source: '部長の氏名',
      value: leader?.name ?? '',
    },
    {
      id: 'leader-kana',
      label: '代表者名（フリガナ）',
      source: '部長のフリガナ',
      value: leader?.kana ?? '',
    },
    {
      id: 'leader-phone',
      label: '携帯電話（ハイフンあり）',
      source: '部長の携帯番号',
      value: leader?.phone ?? '',
      warning: leader?.phoneWarning,
    },
  ];

  OFFICER_SLOT_LABELS.forEach((slot, index) => {
    const officer = officers[index] ?? null;
    items.push(
      {
        id: `officer-${index}-name`,
        label: `${slot}名前`,
        source: '幹部の氏名',
        value: officer?.name ?? '',
      },
      {
        id: `officer-${index}-kana`,
        label: `${slot}名前（フリガナ）`,
        source: '幹部のフリガナ',
        value: officer?.kana ?? '',
      },
      {
        id: `officer-${index}-studentId`,
        label: `${slot}学籍番号`,
        source: '幹部の学籍番号',
        value: officer?.studentId ?? '',
      },
      {
        id: `officer-${index}-phone`,
        label: `${slot}携帯電話番号（ハイフンあり）`,
        source: '幹部の携帯番号',
        value: officer?.phone ?? '',
        warning: officer?.phoneWarning,
      },
    );
  });

  return items;
}
