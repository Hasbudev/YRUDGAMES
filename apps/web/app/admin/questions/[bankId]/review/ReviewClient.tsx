"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ApiError,
  getStoredAdminCode,
  listQuestions,
  storeAdminCode,
  updateQuestion,
  UnauthorizedError,
  type QuestionInput,
  type QuestionRecord,
} from "@/lib/api";
import { AdminCodeGate } from "@/components/admin/AdminCodeGate";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";

const THEME_LABEL: Record<string, string> = {
  trivia: "Quiz de Yrud",
  ost: "Devine la musique",
  stats: "Duel de stats",
  speed: "Manche rapide",
};

const FALLBACK_LETTERS = ["A", "B", "C", "D", "E", "F"];

function reviewedStorageKey(bankId: string) {
  return `yrud-review-${bankId}`;
}

function loadReviewed(bankId: string): Set<string> {
  try {
    const raw = localStorage.getItem(reviewedStorageKey(bankId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReviewed(bankId: string, reviewed: Set<string>) {
  try {
    localStorage.setItem(reviewedStorageKey(bankId), JSON.stringify([...reviewed]));
  } catch {
    // localStorage unavailable (private mode, quota) — reviewed state just won't persist across reloads
  }
}

export function ReviewClient({ bankId }: { bankId: string }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setReviewed(loadReviewed(bankId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId]);

  async function unlock(code: string) {
    setGateError(null);
    storeAdminCode(code);
    await refresh();
  }

  const visibleQuestions = useMemo(
    () => (onlyUnreviewed ? questions.filter((q) => !reviewed.has(q.id)) : questions),
    [questions, onlyUnreviewed, reviewed]
  );

  const clampedIndex = Math.min(index, Math.max(0, visibleQuestions.length - 1));
  const current = visibleQuestions[clampedIndex];

  function toggleReviewed(id: string) {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveReviewed(bankId, next);
      return next;
    });
  }

  function goTo(i: number) {
    setEditing(false);
    setFormError(null);
    setIndex(Math.max(0, Math.min(i, visibleQuestions.length - 1)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return;
      if (e.key === "ArrowRight") goTo(clampedIndex + 1);
      else if (e.key === "ArrowLeft") goTo(clampedIndex - 1);
      else if (e.key.toLowerCase() === "r" && current) toggleReviewed(current.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedIndex, visibleQuestions.length, editing, current]);

  async function handleUpdate(input: QuestionInput) {
    if (!current) return;
    setFormBusy(true);
    try {
      await updateQuestion(current.id, input);
      setEditing(false);
      setFormError(null);
      await refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Échec de la modification.");
    } finally {
      setFormBusy(false);
    }
  }

  if (unlocked === null) return null;
  if (!unlocked) return <AdminCodeGate onUnlock={unlock} error={gateError} />;

  const reviewedCount = questions.filter((q) => reviewed.has(q.id)).length;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-3xl items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-gold-bright">Revue des questions</h1>
        <Link href={`/admin/questions/${bankId}`} className="text-sm text-ink-muted underline">
          Retour à l&apos;éditeur
        </Link>
      </div>

      {loadError && <p className="text-sm text-crimson-bright">{loadError}</p>}

      {questions.length === 0 ? (
        <p className="text-center text-sm text-ink-muted">Aucune question pour le moment.</p>
      ) : (
        <>
          <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-ink-muted">
              {reviewedCount} / {questions.length} vérifiées
            </span>
            <label className="flex items-center gap-2 text-ink-muted">
              <input
                type="checkbox"
                checked={onlyUnreviewed}
                onChange={(e) => {
                  setOnlyUnreviewed(e.target.checked);
                  setIndex(0);
                }}
              />
              N&apos;afficher que les questions non vérifiées
            </label>
          </div>

          {!current ? (
            <p className="text-center text-sm text-gold-bright">✓ Toutes les questions ont été vérifiées !</p>
          ) : (
            <>
              {/* thumbnail strip — dots color-coded by review state, click to jump */}
              <div className="flex w-full max-w-3xl flex-wrap gap-1.5">
                {visibleQuestions.map((q, i) => (
                  <button
                    key={q.id}
                    title={`Question ${i + 1}${q.roundLabel ? ` — ${q.roundLabel}` : ""}`}
                    onClick={() => goTo(i)}
                    className={`h-2.5 w-4 rounded-sm border transition-opacity ${
                      i === clampedIndex
                        ? "border-gold-bright bg-gold-bright"
                        : reviewed.has(q.id)
                          ? "border-transparent bg-emerald-500/70"
                          : "border-border bg-void-deep/60"
                    }`}
                  />
                ))}
              </div>

              <div className="w-full max-w-2xl">
                {editing ? (
                  <div className="panel rounded-2xl p-4">
                    <QuestionForm
                      initial={current}
                      busy={formBusy}
                      error={formError}
                      onCancel={() => {
                        setEditing(false);
                        setFormError(null);
                      }}
                      onSubmit={handleUpdate}
                    />
                  </div>
                ) : (
                  <OrnatePanel>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-semibold tracking-wide text-gold-bright uppercase">
                          {THEME_LABEL[current.theme] ?? current.theme}
                        </span>
                        {current.roundLabel && (
                          <span className="rounded-full border border-purple/40 bg-purple/10 px-3 py-1 font-semibold tracking-wide text-ink uppercase">
                            Manche {current.roundIndex} · {current.roundLabel}
                          </span>
                        )}
                        <span className="text-ink-muted">
                          Question {clampedIndex + 1} sur {visibleQuestions.length} (banque : {questions.length})
                        </span>
                      </div>

                      <h2 className="font-display text-xl font-semibold text-ink">{current.prompt}</h2>

                      {current.mediaUrl && (
                        <div className="relative mx-auto h-56 w-full max-w-md overflow-hidden rounded-xl border border-gold/25 bg-void-deep/40 sm:h-72">
                          <Image
                            src={current.mediaUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 90vw, 448px"
                            className="object-contain"
                            unoptimized={!current.mediaUrl.startsWith("/")}
                          />
                        </div>
                      )}
                      {current.theme !== "ost" && !current.mediaUrl && (
                        <p className="text-center text-xs text-ink-muted italic">Aucune image pour cette question.</p>
                      )}
                      {current.metadata?.audioFile && (
                        <p className="text-center text-xs text-ink-muted">
                          🎵 Fichier audio : <span className="font-mono text-ink">{current.metadata.audioFile}</span>
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {current.choices.map((choice, i) => {
                          const isCorrect = current.allCorrect || i === current.correctIndex;
                          return (
                            <div
                              key={i}
                              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left ${
                                isCorrect
                                  ? "border-gold bg-gradient-to-r from-gold/25 to-gold/5"
                                  : "border-border bg-void-deep/30 opacity-60"
                              }`}
                            >
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                  isCorrect ? "border-gold bg-gold text-void-deep" : "border-border-strong text-ink-muted"
                                }`}
                              >
                                {isCorrect ? "✓" : (FALLBACK_LETTERS[i] ?? i + 1)}
                              </span>
                              <span className={`font-medium ${isCorrect ? "text-gold-bright" : "text-ink"}`}>{choice}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px] text-ink-muted">
                        {current.allCorrect && (
                          <span className="rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 font-bold text-gold-bright">
                            🎉 Toutes les réponses sont bonnes
                          </span>
                        )}
                        <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5">
                          +{current.points} pt{current.points === 1 ? "" : "s"}
                        </span>
                        {current.wrongPoints !== 0 && (
                          <span className="rounded-full border border-crimson/40 bg-crimson/10 px-2 py-0.5 text-crimson-bright">
                            {current.wrongPoints} si faux
                          </span>
                        )}
                        {current.blankPoints != null && (
                          <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5">
                            {current.blankPoints} si aucune réponse
                          </span>
                        )}
                        {current.comboThreshold && current.comboBonus && (
                          <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5">
                            +{current.comboBonus} tous les {current.comboThreshold} bonnes réponses d&apos;affilée
                          </span>
                        )}
                        {current.metadata?.stat && (
                          <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5">
                            Stat : {current.metadata.stat}
                          </span>
                        )}
                      </div>
                    </div>
                  </OrnatePanel>
                )}
              </div>

              {!editing && (
                <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => goTo(clampedIndex - 1)}
                      disabled={clampedIndex === 0}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-ink-muted disabled:opacity-30 hover:border-border-strong"
                    >
                      ← Précédente
                    </button>
                    <button
                      onClick={() => goTo(clampedIndex + 1)}
                      disabled={clampedIndex === visibleQuestions.length - 1}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-ink-muted disabled:opacity-30 hover:border-border-strong"
                    >
                      Suivante →
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-ink-muted hover:border-border-strong"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => toggleReviewed(current.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${
                        reviewed.has(current.id)
                          ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "bg-gold text-void-deep"
                      }`}
                    >
                      {reviewed.has(current.id) ? "✓ Vérifiée" : "Marquer comme vérifiée"}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-center text-[11px] text-ink-muted">
                Raccourcis : ← / → pour naviguer, R pour marquer/démarquer comme vérifiée.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
