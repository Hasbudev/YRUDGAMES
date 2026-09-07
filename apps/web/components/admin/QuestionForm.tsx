"use client";

import { useEffect, useState } from "react";
import type { QuestionInput, QuestionRecord, QuestionTheme } from "@/lib/api";

// "speed" is intentionally excluded — the speed round feature was removed,
// so admins can no longer create new speed-themed questions (legacy rows
// stay representable in the Prisma enum, but aren't selectable here).
const THEME_LABEL: Record<Exclude<QuestionTheme, "speed">, string> = {
  trivia: "Quiz de Yrud",
  ost: "Devine la musique",
  stats: "Duel de stats",
};

function parseNotes(text: string): { freq: number; durationMs: number }[] | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [freq, durationMs] = pair.split(":").map((n) => Number(n.trim()));
      return { freq: freq || 440, durationMs: durationMs || 150 };
    });
}

function serializeNotes(notes?: { freq: number; durationMs: number }[]): string {
  return (notes ?? []).map((n) => `${n.freq}:${n.durationMs}`).join(", ");
}

interface QuestionFormProps {
  initial?: QuestionRecord | null;
  onSubmit: (input: QuestionInput) => Promise<void> | void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
}

export function QuestionForm({ initial, onSubmit, onCancel, busy, error }: QuestionFormProps) {
  const [theme, setTheme] = useState<Exclude<QuestionTheme, "speed">>(
    initial?.theme && initial.theme !== "speed" ? initial.theme : "trivia"
  );
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [choices, setChoices] = useState<string[]>(initial?.choices ?? ["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(initial?.correctIndex ?? 0);
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? "");
  const [notesText, setNotesText] = useState(serializeNotes(initial?.metadata?.notes));
  const [stat, setStat] = useState(initial?.metadata?.stat ?? "");
  const [audioFile, setAudioFile] = useState(initial?.metadata?.audioFile ?? "");
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [roundIndex, setRoundIndex] = useState(initial?.roundIndex ?? 0);
  const [roundLabel, setRoundLabel] = useState(initial?.roundLabel ?? "");
  const [wrongPoints, setWrongPoints] = useState(initial?.wrongPoints ?? 0);
  const [blankPoints, setBlankPoints] = useState(initial?.blankPoints ?? "");
  const [comboThreshold, setComboThreshold] = useState(initial?.comboThreshold ?? "");
  const [comboBonus, setComboBonus] = useState(initial?.comboBonus ?? "");
  const [allCorrect, setAllCorrect] = useState(initial?.allCorrect ?? false);

  function roundFields() {
    return {
      roundIndex,
      roundLabel: roundLabel.trim() || undefined,
      wrongPoints,
      blankPoints: blankPoints === "" ? undefined : Number(blankPoints),
      comboThreshold: comboThreshold === "" ? undefined : Number(comboThreshold),
      comboBonus: comboBonus === "" ? undefined : Number(comboBonus),
      allCorrect,
    };
  }

  useEffect(() => {
    if (theme === "stats" && choices.length !== 2) setChoices(["", ""]);
    if (theme !== "stats" && choices.length < 2) setChoices(["", ""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  function updateChoice(i: number, value: string) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  }

  function addChoice() {
    if (choices.length >= 6) return;
    setChoices((prev) => [...prev, ""]);
  }

  function removeChoice(i: number) {
    if (choices.length <= 2) return;
    setChoices((prev) => prev.filter((_, idx) => idx !== i));
    if (correctIndex >= choices.length - 1) setCorrectIndex(Math.max(0, choices.length - 2));
  }

  function handleSubmit() {
    const trimmedChoices = choices.map((c) => c.trim());
    if (theme === "stats") {
      onSubmit({
        theme: "stats",
        prompt: prompt.trim(),
        choices: [trimmedChoices[0] ?? "", trimmedChoices[1] ?? ""],
        correctIndex: correctIndex === 1 ? 1 : 0,
        stat: stat.trim(),
        points,
        ...roundFields(),
      });
      return;
    }
    if (theme === "ost") {
      onSubmit({
        theme: "ost",
        prompt: prompt.trim(),
        choices: trimmedChoices,
        correctIndex,
        mediaUrl: mediaUrl.trim() || undefined,
        notes: parseNotes(notesText),
        audioFile: audioFile.trim() || undefined,
        points,
        ...roundFields(),
      });
      return;
    }
    onSubmit({ theme: "trivia", prompt: prompt.trim(), choices: trimmedChoices, correctIndex, points, ...roundFields() });
  }

  const canSubmit =
    prompt.trim().length > 0 &&
    choices.every((c) => c.trim().length > 0) &&
    (theme !== "stats" || stat.trim().length > 0);

  return (
    <div className="panel flex w-full flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(THEME_LABEL) as Exclude<QuestionTheme, "speed">[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              theme === t ? "bg-gold text-void-deep" : "border border-border text-ink-muted hover:border-border-strong"
            }`}
          >
            {THEME_LABEL[t]}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Énoncé de la question..."
        rows={2}
        className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
      />

      {theme === "stats" && (
        <input
          value={stat}
          onChange={(e) => setStat(e.target.value)}
          placeholder="Statistique comparée (ex: Vitesse)"
          className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
        />
      )}

      {theme === "ost" && (
        <>
          <div className="flex flex-col gap-1 rounded-lg border border-gold/40 bg-gold/5 p-3">
            <label className="text-xs font-bold uppercase tracking-wide text-gold">
              Blind test — fichier audio local
            </label>
            <input
              value={audioFile}
              onChange={(e) => setAudioFile(e.target.value)}
              placeholder="ex: 1ZoneZero.wav"
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-ink-muted">
              Nom exact du fichier dans apps/web/public/blindtest — pas de lecture automatique de la durée, Yrud
              révèle la réponse quand il le décide.
            </p>
          </div>
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="URL du clip audio (repli si pas de fichier local)"
            className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
          <input
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Mélodie synthétisée (repli) — ex: 660:150, 990:150, 880:300"
            className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
        </>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Manche &amp; score</p>
        <div className="flex flex-wrap gap-2">
          <label className="flex w-28 flex-col gap-1 text-xs text-ink-muted">
            N° de manche
            <input
              type="number"
              min={0}
              value={roundIndex}
              onChange={(e) => setRoundIndex(Math.max(0, Number(e.target.value) || 0))}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
            Titre de la manche (banière)
            <input
              value={roundLabel}
              onChange={(e) => setRoundLabel(e.target.value)}
              placeholder="ex: Quizz Classique"
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs text-ink-muted">
            Points (bonne réponse)
            <input
              type="number"
              min={1}
              max={20}
              value={points}
              onChange={(e) => setPoints(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs text-ink-muted">
            Pénalité mauvaise rép.
            <input
              type="number"
              max={0}
              value={wrongPoints}
              onChange={(e) => setWrongPoints(Math.min(0, Number(e.target.value) || 0))}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs text-ink-muted">
            Pénalité si blanc (défaut = idem)
            <input
              type="number"
              value={blankPoints}
              onChange={(e) => setBlankPoints(e.target.value === "" ? "" : Number(e.target.value))}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs text-ink-muted">
            Combo : tous les
            <input
              type="number"
              min={2}
              value={comboThreshold}
              onChange={(e) => setComboThreshold(e.target.value === "" ? "" : Number(e.target.value))}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs text-ink-muted">
            Combo : bonus
            <input
              type="number"
              min={1}
              value={comboBonus}
              onChange={(e) => setComboBonus(e.target.value === "" ? "" : Number(e.target.value))}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={allCorrect} onChange={(e) => setAllCorrect(e.target.checked)} className="accent-gold" />
          Toutes les réponses sont bonnes (question blague — seul un blanc peut coûter des points, via la pénalité si blanc)
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {choices.map((choice, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correctIndex"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              title="Bonne réponse"
              className="accent-gold"
            />
            <input
              value={choice}
              onChange={(e) => updateChoice(i, e.target.value)}
              placeholder={theme === "stats" ? `Pokémon ${i + 1}` : `Choix ${i + 1}`}
              className="flex-1 rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
            {theme !== "stats" && choices.length > 2 && (
              <button
                type="button"
                onClick={() => removeChoice(i)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-ink-muted hover:border-crimson hover:text-crimson-bright"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {theme !== "stats" && choices.length < 6 && (
          <button
            type="button"
            onClick={addChoice}
            className="self-start rounded-lg border border-border px-3 py-1 text-xs text-ink-muted hover:border-border-strong"
          >
            + Ajouter un choix
          </button>
        )}
      </div>

      {error && <p className="text-sm text-crimson-bright">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-void-deep disabled:opacity-40"
        >
          {initial ? "Enregistrer" : "Ajouter la question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm text-ink-muted hover:border-border-strong"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
