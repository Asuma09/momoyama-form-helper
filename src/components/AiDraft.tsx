import { useState } from 'react';
import { runDraft, type AiAvailability, type DraftRequest } from '../lib/ai';

type Props = {
  availability: AiAvailability;
  /** AI に渡す内容。元になる項目が未入力なら null */
  request: DraftRequest | null;
  /** request が null のときに出す案内 */
  hint: string;
  onInsert: (text: string) => void;
};

type Phase = 'idle' | 'downloading' | 'running' | 'done';

export default function AiDraft({ availability, request, hint, onInsert }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (availability === 'unavailable') return null;

  const busy = phase === 'downloading' || phase === 'running';

  async function generate() {
    if (!request) return;
    setError(null);
    setDraft('');
    setPhase(availability === 'available' ? 'running' : 'downloading');
    setProgress(0);
    try {
      const text = await runDraft(request, (ratio) => {
        setProgress(ratio);
        setPhase(ratio >= 1 ? 'running' : 'downloading');
      });
      if (!text) {
        setError('AI から文章が返りませんでした。もう一度試してください。');
        setPhase('idle');
        return;
      }
      setDraft(text);
      setPhase('done');
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? `AI の下書きに失敗しました：${cause.message}`
          : 'AI の下書きに失敗しました。',
      );
      setPhase('idle');
    }
  }

  return (
    <div className="ai-draft">
      <div className="ai-row">
        <button type="button" className="ai-button" onClick={generate} disabled={busy || !request}>
          {busy ? '作成中…' : 'AI で下書き'}
        </button>
        {!request && <span className="ai-hint">{hint}</span>}
        {phase === 'downloading' && (
          <span className="ai-hint">
            初回だけ AI モデルを用意します（{Math.round(progress * 100)}%）
          </span>
        )}
        {phase === 'running' && <span className="ai-hint">この端末の中で考えています…</span>}
      </div>

      {error && <p className="alert error">{error}</p>}

      {phase === 'done' && (
        <div className="ai-result">
          <p className="ai-hint">
            AI の下書きです。直してから入れてください。正しいかどうかは必ず自分で確認してください。
          </p>
          <textarea
            rows={4}
            value={draft}
            aria-label="AI の下書き"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="ai-row">
            <button
              type="button"
              className="ai-button"
              onClick={() => {
                onInsert(draft);
                setPhase('idle');
                setDraft('');
              }}
              disabled={!draft.trim()}
            >
              この内容を入れる
            </button>
            <button type="button" className="link-button" onClick={() => setPhase('idle')}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
