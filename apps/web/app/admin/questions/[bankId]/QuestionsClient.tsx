"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  bulkImportQuestions,
  createQuestion,
  deleteQuestion,
  getStoredAdminCode,
  listQuestions,
  moveQuestion,
  storeAdminCode,
  updateQuestion,
  UnauthorizedError,
  type QuestionInput,
  type QuestionRecord,
} from "@/lib/api";
import { AdminCodeGate } from "@/components/admin/AdminCodeGate";
import { QuestionForm } from "@/components/admin/QuestionForm";

const THEME_LABEL: Record<string, string> = {
  trivia: "Quiz de Yrud",
  ost: "Devine la musique",
  stats: "Duel de stats",
  speed: "Manche rapide",
};

const BULK_PLACEHOLDER = `[
  {
    "theme": "trivia",
    "prompt": "Quel type est super efficace contre Dragon ?",
    "choices": ["Glace", "Feu", "Eau", "Plante"],
    "correctIndex": 0
  }
]`;

export function QuestionsClient({ bankId }: { bankId: string }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  async function refresh() {
    try {
      setQuestions(await listQuestions(bankId));
      setUnlocked(true);
      setLoadError(null);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setUnlocked(false);
        setGateError("Code d'accès invalide.");
      } else {
        setLoadError("Échec du chargement des questions.");
      }
    }
  }

  useEffect(() => {
    if (getStoredAdminCode()) refresh();
    else setUnlocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId]);

  async function unlock(code: string) {
    setGateError(null);
    storeAdminCode(code);
    await refresh();
  }

  async function handleCreate(input: QuestionInput) {
    setFormBusy(true);
    try {
      await createQuestion(bankId, input);
      setCreating(false);
      setFormError(null);
      await refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Échec de la création.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleUpdate(id: string, input: QuestionInput) {
    setFormBusy(true);
    try {
      await updateQuestion(id, input);
      setEditingId(null);
      setFormError(null);
      await refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Échec de la modification.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteQuestion(id);
    await refresh();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    await moveQuestion(id, direction);
    await refresh();
  }

  async function handleBulkImport() {
    setBulkBusy(true);
    setBulkError(null);
    setBulkSuccess(null);
    try {
      const parsed = JSON.parse(bulkText);
      if (!Array.isArray(parsed)) throw new Error("Le JSON doit être un tableau de questions.");
      const result = await bulkImportQuestions(bankId, parsed as QuestionInput[]);
      setBulkSuccess(`${result.created} question(s) importée(s).`);
      setBulkText("");
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) setBulkError(e.message);
      else if (e instanceof SyntaxError) setBulkError("JSON invalide — vérifie la syntaxe.");
      else setBulkError(e instanceof Error ? e.message : "Échec de l'import.");
    } finally {
      setBulkBusy(false);
    }
  }

  if (unlocked === null) return null;
  if (!unlocked) return <AdminCodeGate onUnlock={unlock} error={gateError} />;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-8">
      <h1 className="font-display text-2xl font-bold text-gold-bright">Questions de la banque</h1>
      {loadError && <p className="text-sm text-crimson-bright">{loadError}</p>}

      <div className="flex w-full max-w-2xl flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id} className="panel flex flex-col gap-2 rounded-xl p-3">
            {editingId === q.id ? (
              <QuestionForm
                initial={q}
                busy={formBusy}
                error={formError}
                onCancel={() => {
                  setEditingId(null);
                  setFormError(null);
                }}
                onSubmit={(input) => handleUpdate(q.id, input)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-bright">
                    {THEME_LABEL[q.theme] ?? q.theme}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMove(q.id, "up")}
                      disabled={i === 0}
                      className="rounded border border-border px-2 py-0.5 text-xs text-ink-muted disabled:opacity-30 hover:border-border-strong"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(q.id, "down")}
                      disabled={i === questions.length - 1}
                      className="rounded border border-border px-2 py-0.5 text-xs text-ink-muted disabled:opacity-30 hover:border-border-strong"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(q.id);
                        setCreating(false);
                        setFormError(null);
                      }}
                      className="rounded border border-border px-2 py-0.5 text-xs text-ink-muted hover:border-border-strong"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="rounded border border-border px-2 py-0.5 text-xs text-crimson-bright hover:border-crimson"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium text-ink">{q.prompt}</p>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {q.choices.map((c, ci) => (
                    <li
                      key={ci}
                      className={`rounded-full px-2 py-0.5 ${
                        ci === q.correctIndex ? "bg-gold/20 font-bold text-gold-bright" : "bg-void-deep/60 text-ink-muted"
                      }`}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
                {q.metadata?.stat && <p className="text-xs text-ink-muted">Stat : {q.metadata.stat}</p>}
              </>
            )}
          </div>
        ))}
        {questions.length === 0 && <p className="text-center text-sm text-ink-muted">Aucune question pour le moment.</p>}
      </div>

      {creating ? (
        <div className="w-full max-w-2xl">
          <QuestionForm
            busy={formBusy}
            error={formError}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
            }}
            onSubmit={handleCreate}
          />
        </div>
      ) : (
        <button
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-void-deep"
        >
          + Ajouter une question
        </button>
      )}

      <div className="w-full max-w-2xl">
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="mb-2 text-sm text-ink-muted underline"
        >
          {bulkOpen ? "Masquer l'import en masse" : "Import en masse (JSON)"}
        </button>
        {bulkOpen && (
          <div className="panel-ornate flex flex-col gap-2 rounded-2xl p-4">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={BULK_PLACEHOLDER}
              rows={8}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 font-mono text-xs text-ink focus:border-gold focus:outline-none"
            />
            <button
              onClick={handleBulkImport}
              disabled={!bulkText.trim() || bulkBusy}
              className="self-start rounded-lg bg-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Importer
            </button>
            {bulkError && <p className="text-sm text-crimson-bright">{bulkError}</p>}
            {bulkSuccess && <p className="text-sm text-gold-bright">✓ {bulkSuccess}</p>}
          </div>
        )}
      </div>

      <Link href="/admin/questions" className="text-sm text-ink-muted underline">
        Retour aux banques de questions
      </Link>
    </div>
  );
}
