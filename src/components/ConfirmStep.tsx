import {
  OFFICER_SLOT_LABELS,
  type Assignment,
  type Member,
  type ParseSuccess,
  type RoleSettings,
} from '../lib/roster';

type Props = {
  parsed: ParseSuccess;
  settings: RoleSettings;
  assignment: Assignment;
  leader: Member | null;
  leaderId: string | null;
  officers: (Member | null)[];
  warnings: string[];
  onSettingsChange: (settings: RoleSettings) => void;
  onLeaderChange: (id: string | null) => void;
  onOfficerChange: (slotIndex: number, id: string | null) => void;
  onBack: () => void;
  onNext: () => void;
};

function memberLabel(member: Member): string {
  const role = member.role || '役職なし';
  return `${member.name}（${role} / ${member.studentId || '学籍番号なし'}）`;
}

export default function ConfirmStep({
  parsed,
  settings,
  assignment,
  leader,
  leaderId,
  officers,
  warnings,
  onSettingsChange,
  onLeaderChange,
  onOfficerChange,
  onBack,
  onNext,
}: Props) {
  const needsLeaderChoice = assignment.leaderCandidates.length !== 1;
  const leaderOptions = assignment.leaderCandidates.length >= 2
    ? assignment.leaderCandidates
    : parsed.members;
  const officerOptions = parsed.members.filter((member) => member.id !== leaderId);
  const slotIds = officers.map((officer) => officer?.id ?? null);
  const leftoverOfficers = assignment.officerPool.filter(
    (member) => !slotIds.includes(member.id) && member.id !== leaderId,
  );
  const phoneWarningMembers = parsed.members.filter((member) => member.phoneWarning);

  return (
    <section className="card">
      <h2>2. 内容を確認する</h2>

      <div className="summary-grid">
        <div>
          <span className="summary-label">シート</span>
          <strong>{parsed.sheetName}</strong>
        </div>
        <div>
          <span className="summary-label">見出し行</span>
          <strong>{parsed.headerExcelRow} 行目</strong>
        </div>
        <div>
          <span className="summary-label">読み込んだ人数</span>
          <strong>{parsed.members.length} 人</strong>
        </div>
        <div>
          <span className="summary-label">読み飛ばした行</span>
          <strong>{parsed.skippedRows} 行</strong>
        </div>
      </div>

      <h3>列の対応</h3>
      <table className="table">
        <thead>
          <tr>
            <th>必要な列</th>
            <th>名簿の見出し</th>
            <th>Excel の列</th>
          </tr>
        </thead>
        <tbody>
          {parsed.columns.map((column) => (
            <tr key={column.key}>
              <td>{column.label}</td>
              <td>{column.header}</td>
              <td>{column.columnLetter}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {warnings.length > 0 && (
        <div className="alert warn">
          <strong>警告</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>代表者</h3>
      {needsLeaderChoice ? (
        <p className="note">
          役職「{settings.leaderRole}」の人が{assignment.leaderCandidates.length}人でした。
          代表者を一覧から選んでください。
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="leader-select">代表者</label>
        <select
          id="leader-select"
          value={leaderId ?? ''}
          onChange={(event) => onLeaderChange(event.target.value || null)}
        >
          <option value="">— 選んでください —</option>
          {leaderOptions.map((member) => (
            <option key={member.id} value={member.id}>
              {memberLabel(member)}
            </option>
          ))}
        </select>
      </div>
      {leader && (
        <table className="table">
          <tbody>
            <tr>
              <th>氏名</th>
              <td>{leader.name}</td>
            </tr>
            <tr>
              <th>フリガナ</th>
              <td>{leader.kana}</td>
            </tr>
            <tr>
              <th>携帯番号</th>
              <td className={leader.phoneWarning ? 'cell-warn' : undefined}>{leader.phone}</td>
            </tr>
          </tbody>
        </table>
      )}

      <h3>幹部①〜④</h3>
      <p className="note">
        {settings.officerRoles.join('→')} の順で上位4人を入れています。
        選び直すと名簿ではなく画面上の割り当てだけが変わります。
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>枠</th>
            <th>担当者</th>
            <th>フリガナ</th>
            <th>学籍番号</th>
            <th>携帯番号</th>
          </tr>
        </thead>
        <tbody>
          {OFFICER_SLOT_LABELS.map((slot, index) => {
            const officer = officers[index] ?? null;
            return (
              <tr key={slot}>
                <th>
                  {slot}
                  {index < 2 && <span className="required">必須</span>}
                </th>
                <td>
                  <select
                    value={officer?.id ?? ''}
                    onChange={(event) => onOfficerChange(index, event.target.value || null)}
                  >
                    <option value="">— 空欄 —</option>
                    {officerOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {memberLabel(member)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{officer?.kana ?? ''}</td>
                <td>{officer?.studentId ?? ''}</td>
                <td className={officer?.phoneWarning ? 'cell-warn' : undefined}>
                  {officer?.phone ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {leftoverOfficers.length > 0 && (
        <p className="note">
          入らなかった幹部：
          {leftoverOfficers.map((member) => `${member.name}（${member.role}）`).join('、')}
        </p>
      )}

      {phoneWarningMembers.length > 0 && (
        <>
          <h3>携帯番号を確認したい人</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Excel 行</th>
                <th>氏名</th>
                <th>元の値</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {phoneWarningMembers.map((member) => (
                <tr key={member.id}>
                  <td>{member.excelRow}</td>
                  <td>{member.name}</td>
                  <td className="cell-warn">{member.phone || '（空欄）'}</td>
                  <td>{member.phoneWarning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <details className="settings">
        <summary>役職名と幹部の優先順を変える</summary>
        <div className="field">
          <label htmlFor="leader-role">代表者になる役職名</label>
          <input
            id="leader-role"
            type="text"
            value={settings.leaderRole}
            onChange={(event) =>
              onSettingsChange({ ...settings, leaderRole: event.target.value })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="officer-roles">幹部の役職名（優先順・読点か改行で区切る）</label>
          <input
            id="officer-roles"
            type="text"
            value={settings.officerRoles.join('、')}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                officerRoles: event.target.value
                  .split(/[、,，\n]/)
                  .map((role) => role.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <p className="note">
          役職は前後の空白を取ったうえで完全一致で判定します。ここに書かれていない役職は一般部員です。
        </p>
      </details>

      <h3>一般部員（{assignment.generalMembers.length}人）</h3>
      <p className="note">
        {assignment.generalMembers.length > 0
          ? assignment.generalMembers.map((member) => member.name).join('、')
          : 'なし'}
      </p>

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          読み込みに戻る
        </button>
        <button type="button" className="primary" onClick={onNext} disabled={!leader}>
          企画情報の入力へ進む
        </button>
      </div>
    </section>
  );
}
