import { useRef, useState } from 'react';

type Props = {
  fileName: string | null;
  sheetNames: string[];
  selectedSheet: string | null;
  error: string | null;
  onFile: (file: File) => void;
  onSelectSheet: (sheetName: string) => void;
  onReset: () => void;
};

export default function LoadStep({
  fileName,
  sheetNames,
  selectedSheet,
  error,
  onFile,
  onSelectSheet,
  onReset,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <section className="card">
      <h2>1. 名簿を読み込む</h2>
      <p className="lead">
        部員名簿の Excel（.xlsx）を選ぶか、下の枠にドラッグしてください。
        必要な列は <strong>役職・氏名・学籍番号・電話番号（連絡先）</strong> の4つです。
        <strong>フリガナ</strong> はあれば使い、なくても読み込めます。
        シートが複数あっても、部員一覧の見出しがあるシートを自動で探します。
      </p>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <p className="dropzone-main">Excel ファイルをここにドラッグ</p>
        <p className="dropzone-sub">またはクリックしてファイルを選ぶ（.xlsx / .xls）</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = '';
          }}
        />
      </div>

      {fileName && (
        <p className="file-name">
          読み込んだファイル：<strong>{fileName}</strong>
          <button type="button" className="link-button" onClick={onReset}>
            やり直す
          </button>
        </p>
      )}

      {sheetNames.length > 1 && (
        <div className="field">
          <label htmlFor="sheet-select">
            シートを選ぶ（部員一覧のあるシートを自動で選んでいます）
          </label>
          <select
            id="sheet-select"
            value={selectedSheet ?? ''}
            onChange={(event) => onSelectSheet(event.target.value)}
          >
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="alert error">{error}</p>}

      <p className="note">
        名簿の中身はこのブラウザの中だけで処理します。どこにも送信せず、保存もしません。
        ページを閉じると消えます。
      </p>
    </section>
  );
}
