"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createEvent,
  deleteEvent,
  getStoredAdminCode,
  listAllEvents,
  listQuestionBanks,
  storeAdminCode,
  UnauthorizedError,
  type AdminEventSummary,
  type QuestionBankSummary,
} from "@/lib/api";

const STATUS_LABEL: Record<AdminEventSummary["status"], string> = {
  draft: "en attente",
  live: "en cours",
  finished: "terminé",
};
import { AdminCodeGate } from "@/components/admin/AdminCodeGate";

export default function AdminHomePage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = not checked yet
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [name, setName] = useState("Soirée YRUD GAMES");
  const [questionBankId, setQuestionBankId] = useState("");
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function refreshEvents() {
    try {
      setEvents(await listAllEvents());
      setEventsError(null);
    } catch {
      setEventsError("Échec du chargement des événements.");
    }
  }

  async function tryLoadBanks() {
    try {
      const b = await listQuestionBanks();
      setBanks(b);
      if (b[0]) setQuestionBankId(b[0].id);
      setUnlocked(true);
      await refreshEvents();
    } catch (e) {
      setUnlocked(false);
      if (e instanceof UnauthorizedError) setGateError("Code d'accès invalide.");
    }
  }

  useEffect(() => {
    if (getStoredAdminCode()) {
      tryLoadBanks();
    } else {
      setUnlocked(false);
    }
  }, []);

  async function unlock(code: string) {
    setGateBusy(true);
    setGateError(null);
    storeAdminCode(code);
    await tryLoadBanks();
    setGateBusy(false);
  }

  async function handleDelete(code: string) {
    setDeletingCode(code);
    try {
      await deleteEvent(code);
      await refreshEvents();
    } catch {
      setEventsError(`Échec de la suppression de l'événement ${code}.`);
    } finally {
      setDeletingCode(null);
    }
  }

  if (unlocked === null) return null;
  if (!unlocked) return <AdminCodeGate onUnlock={unlock} error={gateError} busy={gateBusy} />;

  async function submit() {
    setFormError(null);
    try {
      const event = await createEvent({ name, questionBankId });
      setCreated(event);
      await refreshEvents();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setUnlocked(false);
        setGateError("Session expirée — entre à nouveau le code.");
        return;
      }
      setFormError("Échec de la création de l'événement. Le serveur est-il lancé ?");
    }
  }

  if (created) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="font-display text-2xl font-bold text-gold-bright">Événement créé !</h1>
        <p className="text-lg text-ink">
          Code de participation : <span className="font-mono font-bold text-gold-bright">{created.code}</span>
        </p>
        <Link
          href={`/admin/console/${created.code}`}
          className="btn-gold"
        >
          Ouvrir la Console de Yrud
        </Link>
        <Link href={`/play/${created.code}`} className="text-sm text-ink-muted underline">
          Ouvrir la page de connexion des joueurs
        </Link>
        <button onClick={() => setCreated(null)} className="text-sm text-ink-muted underline">
          Retour à la liste des événements
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-display text-2xl font-bold text-gold-bright">Créer un événement YRUD GAMES</h1>
      <Link href="/admin/questions" className="text-sm text-ink-muted underline hover:text-ink">
        Gérer les banques de questions
      </Link>
      <div className="panel-ornate flex w-full max-w-sm flex-col gap-3 rounded-2xl p-6">
        <label className="text-sm text-ink-muted">
          Nom de l&apos;événement
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Banque de questions
          <select
            value={questionBankId}
            onChange={(e) => setQuestionBankId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          >
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.questionCount} questions)
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={submit}
          disabled={!questionBankId}
          className="btn-gold w-full"
        >
          Créer l&apos;événement
        </button>
        {formError && <p className="text-sm text-crimson-bright">{formError}</p>}
      </div>

      <div className="panel-ornate flex w-full max-w-2xl flex-col gap-3 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gold-bright">Événements existants</h2>
          <button onClick={refreshEvents} className="text-xs text-ink-muted underline hover:text-ink">
            Rafraîchir
          </button>
        </div>
        {eventsError && <p className="text-sm text-crimson-bright">{eventsError}</p>}
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun événement pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-void-deep/40 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink">
                    {e.name} — <span className="font-mono text-gold-bright">{e.code}</span>
                  </span>
                  <span className="text-xs text-ink-muted">
                    {STATUS_LABEL[e.status]} · {e.playerCount} joueur(s) · {e.questionBankName ?? "banque supprimée"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/console/${e.code}`}
                    className="rounded-lg border border-border px-3 py-1 text-xs text-ink-muted hover:border-border-strong"
                  >
                    Console
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer définitivement l'événement "${e.name}" (${e.code}) ?`)) {
                        handleDelete(e.code);
                      }
                    }}
                    disabled={deletingCode === e.code}
                    className="rounded-lg border border-crimson/50 px-3 py-1 text-xs text-crimson-bright hover:border-crimson disabled:opacity-40"
                  >
                    {deletingCode === e.code ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
