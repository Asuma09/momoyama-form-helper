import { useEffect, useMemo, useState } from 'react';
import type { WorkBook } from 'xlsx';
import LoadStep from './components/LoadStep';
import ConfirmStep from './components/ConfirmStep';
import PlanStep from './components/PlanStep';
import CopyStep from './components/CopyStep';
import { EMPTY_PLAN, buildPlanCopyItems, type PlanInput } from './lib/plan';
import {
  DEFAULT_ROLE_SETTINGS,
  OFFICER_SLOT_LABELS,
  assignByRole,
  buildCopyItems,
  findRosterSheet,
  parseSheet,
  readWorkbook,
  type RoleSettings,
} from './lib/roster';

type Step = 'load' | 'confirm' | 'plan' | 'copy';

const STEP_LABELS: Record<Step, string> = {
  load: '読み込み',
  confirm: '確認',
  plan: '企画情報の入力',
  copy: 'コピペ一覧',
};

const EMPTY_SLOTS: (string | null)[] = OFFICER_SLOT_LABELS.map(() => null);

export default function App() {
  const [step, setStep] = useState<Step>('load');
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RoleSettings>(DEFAULT_ROLE_SETTINGS);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [officerIds, setOfficerIds] = useState<(string | null)[]>(EMPTY_SLOTS);
  const [plan, setPlan] = useState<PlanInput>(EMPTY_PLAN);

  const parsed = useMemo(() => {
    if (!workbook || !selectedSheet) return null;
    return parseSheet(workbook, selectedSheet);
  }, [workbook, selectedSheet]);

  const roster = parsed?.ok ? parsed : null;

  const assignment = useMemo(
    () => (roster ? assignByRole(roster.members, settings) : null),
    [roster, settings],
  );

  useEffect(() => {
    if (!assignment) {
      setLeaderId(null);
      setOfficerIds(EMPTY_SLOTS);
      return;
    }
    const autoLeader =
      assignment.leaderCandidates.length === 1 ? assignment.leaderCandidates[0].id : null;
    setLeaderId(autoLeader);
    setOfficerIds(
      OFFICER_SLOT_LABELS.map((_, index) => assignment.officerPool[index]?.id ?? null),
    );
  }, [assignment]);

  const memberById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof roster>['members'][number]>();
    roster?.members.forEach((member) => map.set(member.id, member));
    return map;
  }, [roster]);

  const leader = leaderId ? memberById.get(leaderId) ?? null : null;
  const officers = officerIds.map((id) => (id ? memberById.get(id) ?? null : null));

  const warnings = useMemo(() => {
    if (!assignment || !roster) return [];
    const list: string[] = [];
    const leaderCount = assignment.leaderCandidates.length;
    if (leaderCount === 0) {
      list.push(
        `役職「${settings.leaderRole}」の人が名簿にいません。代表者を一覧から選んでください。`,
      );
    } else if (leaderCount >= 2) {
      list.push(
        `役職「${settings.leaderRole}」の人が${leaderCount}人います。代表者を一覧から選んでください。`,
      );
    }
    const officerCount = assignment.officerPool.length;
    if (officerCount < 2) {
      list.push(`幹部が${officerCount}人しかいません。幹部①②は必須です。`);
    } else if (officerCount >= 5) {
      list.push(`幹部が${officerCount}人います。上位4人を①〜④に入れました。`);
    }
    const phoneIssues = roster.members.filter((member) => member.phoneWarning).length;
    if (phoneIssues > 0) {
      list.push(`携帯番号を整形できなかった人が${phoneIssues}人います。元の値のまま表示します。`);
    }
    return list;
  }, [assignment, roster, settings.leaderRole]);

  const copyItems = useMemo(
    () => [...buildCopyItems(leader, officers), ...buildPlanCopyItems(plan)],
    [leader, officers, plan],
  );

  function loadSheet(book: WorkBook, sheetName: string) {
    const result = parseSheet(book, sheetName);
    setSelectedSheet(sheetName);
    if (result.ok) {
      setLoadError(null);
      setStep('confirm');
    } else {
      setLoadError(result.message);
      setStep('load');
    }
  }

  async function handleFile(file: File) {
    try {
      const book = readWorkbook(await file.arrayBuffer());
      if (book.SheetNames.length === 0) {
        setLoadError('シートが見つかりませんでした。');
        return;
      }
      setFileName(file.name);
      setWorkbook(book);
      setSheetNames(book.SheetNames);
      loadSheet(book, findRosterSheet(book));
    } catch {
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet(null);
      setLoadError('Excel ファイルとして読み込めませんでした。.xlsx 形式か確認してください。');
    }
  }

  function handleReset() {
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet(null);
    setFileName(null);
    setLoadError(null);
    setStep('load');
  }

  function handleLeaderChange(id: string | null) {
    setLeaderId(id);
    if (id) {
      setOfficerIds((prev) => prev.map((slot) => (slot === id ? null : slot)));
    }
  }

  function handleOfficerChange(slotIndex: number, id: string | null) {
    setOfficerIds((prev) => {
      const next = [...prev];
      // 同じ人が2つの枠に入らないよう、既に入っている枠と入れ替える
      const existing = id ? next.indexOf(id) : -1;
      if (existing >= 0 && existing !== slotIndex) {
        next[existing] = next[slotIndex];
      }
      next[slotIndex] = id;
      return next;
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>桃山祭 出店フォーム入力補助</h1>
        <p>
          部員名簿の Excel と企画情報から、模擬店最終企画書フォームに貼る内容を作ります。
        </p>
        <ol className="stepper">
          {(Object.keys(STEP_LABELS) as Step[]).map((key, index) => (
            <li key={key} className={step === key ? 'current' : undefined}>
              <span className="step-no">{index + 1}</span>
              {STEP_LABELS[key]}
            </li>
          ))}
        </ol>
      </header>

      <main>
        {step === 'load' && (
          <LoadStep
            fileName={fileName}
            sheetNames={sheetNames}
            selectedSheet={selectedSheet}
            error={loadError}
            onFile={handleFile}
            onSelectSheet={(name) => {
              if (workbook) loadSheet(workbook, name);
            }}
            onReset={handleReset}
          />
        )}

        {step === 'confirm' && roster && assignment && (
          <ConfirmStep
            parsed={roster}
            settings={settings}
            assignment={assignment}
            leader={leader}
            leaderId={leaderId}
            officers={officers}
            warnings={warnings}
            onSettingsChange={setSettings}
            onLeaderChange={handleLeaderChange}
            onOfficerChange={handleOfficerChange}
            onBack={() => setStep('load')}
            onNext={() => setStep('plan')}
          />
        )}

        {step === 'plan' && roster && (
          <PlanStep
            plan={plan}
            onChange={setPlan}
            onBack={() => setStep('confirm')}
            onNext={() => setStep('copy')}
          />
        )}

        {step === 'copy' && roster && (
          <CopyStep items={copyItems} onBack={() => setStep('plan')} />
        )}
      </main>

      <footer className="app-footer">
        名簿と入力した内容はブラウザの中だけで処理します。サーバーへの送信も、ブラウザへの保存もしません。
      </footer>
    </div>
  );
}
