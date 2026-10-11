/**
 * Chrome 内蔵 AI（Gemini Nano）の薄いラッパー。
 *
 * - Chrome 148 以降は Prompt API が既定で有効。日本語の入出力は Chrome 149 以降。
 * - 推論はすべて端末の中で動く。渡すのは企画情報の文字列だけで、名簿は渡さない。
 * - 使えないブラウザ（Safari など）では `availability()` が 'unavailable' を返すので、
 *   呼び出し側は AI の表示を出さずに手入力のままにする。
 */

export type AiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

type LanguageModelExpectation = { type: 'text'; languages?: string[] };

type DownloadMonitor = {
  addEventListener: (
    type: 'downloadprogress',
    listener: (event: { loaded: number }) => void,
  ) => void;
};

type LanguageModelCreateOptions = {
  initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  expectedInputs?: LanguageModelExpectation[];
  expectedOutputs?: LanguageModelExpectation[];
  monitor?: (monitor: DownloadMonitor) => void;
  signal?: AbortSignal;
};

type LanguageModelSession = {
  prompt: (input: string, options?: { signal?: AbortSignal }) => Promise<string>;
  destroy: () => void;
};

type LanguageModelApi = {
  availability: () => Promise<AiAvailability>;
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession>;
};

declare global {
  /** Chrome 内蔵 AI。対応していないブラウザでは undefined。 */
  // eslint-disable-next-line no-var
  var LanguageModel: LanguageModelApi | undefined;
}

const SYSTEM_PROMPT =
  'あなたは大学の学園祭の模擬店の企画書づくりを手伝います。' +
  '日本語で、提出書類にそのまま書ける簡潔な表現で答えます。' +
  'あいさつ・前置き・補足説明・見出しは書かず、求められた内容だけを書きます。';

export function isAiSupported(): boolean {
  return typeof globalThis.LanguageModel !== 'undefined';
}

export async function checkAiAvailability(): Promise<AiAvailability> {
  const api = globalThis.LanguageModel;
  if (!api) return 'unavailable';
  try {
    return await api.availability();
  } catch {
    return 'unavailable';
  }
}

/** AI に渡す内容。ここに出てこない値は AI に渡らない。 */
export type DraftRequest =
  | { kind: 'ingredients'; products: string }
  | { kind: 'method'; products: string; ingredients: string };

export const DRAFT_LABELS: Record<DraftRequest['kind'], string> = {
  ingredients: '全ての材料',
  method: '調理方法',
};

function buildPrompt(request: DraftRequest): string {
  if (request.kind === 'ingredients') {
    return [
      '模擬店で次のものを販売します。',
      request.products,
      '',
      '必要な材料と調味料を、読点（、）で区切って1行で挙げてください。',
      '分量や個数は書かないでください。',
    ].join('\n');
  }
  const lines = ['模擬店で次のものを販売します。', request.products, ''];
  if (request.ingredients.trim()) {
    lines.push(`使う材料：${request.ingredients.replace(/\s*\n\s*/g, '、')}`, '');
  }
  lines.push(
    '当日の調理方法を、企画書に書く文章として3〜4文で説明してください。',
    '箇条書きや番号付きの手順ではなく、文章で書いてください。',
  );
  return lines.join('\n');
}

/** モデルの出力は体裁が崩れることがあるので、貼りやすい形に整える */
function cleanDraft(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^\s*(?:材料|調理方法|手順)\s*[:：]\s*/u, '')
    .replace(/^[ \t]*[-*・]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type DraftProgress = (ratio: number) => void;

/**
 * 下書きを1つ作る。セッションは毎回作って捨てる（状態を持ち越さない）。
 * onProgress は初回のモデルダウンロード中だけ呼ばれる（0〜1）。
 */
export async function runDraft(
  request: DraftRequest,
  onProgress?: DraftProgress,
): Promise<string> {
  const api = globalThis.LanguageModel;
  if (!api) throw new Error('このブラウザでは AI を使えません。');

  const session = await api.create({
    initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
    expectedInputs: [{ type: 'text', languages: ['ja'] }],
    expectedOutputs: [{ type: 'text', languages: ['ja'] }],
    monitor: onProgress
      ? (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => onProgress(event.loaded));
        }
      : undefined,
  });

  try {
    const answer = await session.prompt(buildPrompt(request));
    return cleanDraft(answer);
  } finally {
    session.destroy();
  }
}
