const WHITESPACE = /[\s　]+/g;

/** 前後の空白（半角・全角）を取る */
export function trimAll(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/^[\s　]+/, '').replace(/[\s　]+$/, '');
}

/** 氏名：姓と名の間の空白を全角1つに統一する */
export function normalizeName(value: unknown): string {
  return trimAll(value).replace(WHITESPACE, '　');
}

/** フリガナ：ひらがな・半角カナを全角カタカナにする */
export function normalizeKana(value: unknown): string {
  const nfkc = trimAll(value).normalize('NFKC');
  const katakana = nfkc.replace(/[ぁ-ゖ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0x60),
  );
  return katakana.replace(WHITESPACE, '　');
}

/** 学籍番号：全角英数字を半角にし、英字は小文字にする */
export function normalizeStudentId(value: unknown): string {
  return trimAll(value).normalize('NFKC').replace(WHITESPACE, '').toLowerCase();
}

export type PhoneResult = {
  /** フォームに貼る値。整形できなかった場合は元の値 */
  value: string;
  /** 整形できなかった理由 */
  warning?: string;
};

/** 電話番号：数字以外を除いて 3-4-4 桁のハイフンありにする */
export function normalizePhone(value: unknown): PhoneResult {
  const original = trimAll(value);
  let digits = original.normalize('NFKC').replace(/\D/g, '');

  // Excel で先頭の 0 が消えた 10 桁を補う
  if (digits.length === 10 && /^[789]/.test(digits)) {
    digits = `0${digits}`;
  }

  if (digits.length === 11) {
    return { value: `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}` };
  }

  return {
    value: original,
    warning: original
      ? `電話番号が11桁になりません（数字${digits.length}桁）`
      : '電話番号が空欄です',
  };
}

/** 見出し行の照合用に、空白と括弧の違いを無視した形にそろえる */
export function normalizeHeader(value: unknown): string {
  return trimAll(value)
    .normalize('NFKC')
    .replace(WHITESPACE, '')
    .replace(/[()［］\[\]「」]/g, '')
    .toLowerCase();
}
