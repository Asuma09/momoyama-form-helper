import { useState } from 'react';
import type { CopyItem } from '../lib/roster';

type Props = {
  items: CopyItem[];
  onBack: () => void;
};

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari や非セキュアな環境では Clipboard API が使えないことがある
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  }
}

export default function CopyStep({ items, onBack }: Props) {
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<string | null>(null);

  async function copy(item: CopyItem) {
    if (await writeToClipboard(item.value)) {
      setCopied((prev) => ({ ...prev, [item.id]: true }));
      setFailed(null);
    } else {
      setFailed('クリップボードにコピーできませんでした。値を選んで手動でコピーしてください。');
    }
  }

  const copiedCount = items.filter((item) => copied[item.id]).length;

  return (
    <section className="card">
      <h2>4. コピペ一覧</h2>
      <p className="lead">
        名簿からの項目と企画情報が、フォームと同じ順番で並んでいます。
        ボタンを押すとその項目だけをコピーします。
        団体名・所属・メールアドレスは名簿にないため、フォームで直接入力してください。
      </p>

      <div className="progress">
        コピー済み {copiedCount} / {items.length}
        <button type="button" className="link-button" onClick={() => setCopied({})}>
          印をリセット
        </button>
      </div>

      {failed && <p className="alert error">{failed}</p>}

      <table className="table copy-table">
        <thead>
          <tr>
            <th>フォームの項目</th>
            <th>貼る内容</th>
            <th aria-label="コピー" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={copied[item.id] ? 'row-copied' : undefined}>
              <th>
                {item.label}
                <span className="source">{item.source}</span>
              </th>
              <td>
                <code className={item.warning ? 'cell-warn' : undefined}>
                  {item.value || '（空欄）'}
                </code>
                {item.warning && <span className="inline-warn">{item.warning}</span>}
              </td>
              <td className="copy-cell">
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => copy(item)}
                  disabled={!item.value}
                >
                  {copied[item.id] ? '✓ コピー済み' : 'コピー'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          企画情報の入力に戻る
        </button>
      </div>
    </section>
  );
}
