"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createEvent,
  getStoredAdminCode,
  listQuestionBanks,
  storeAdminCode,
  UnauthorizedError,
  type QuestionBankSummary,
} from "@/lib/api";
import { AdminCodeGate } from "@/components/admin/AdminCodeGate";

export default function AdminHomePage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = not checked yet
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [name, setName] = useState("Soirée YRUD GAMES");
  const [questionBankId, setQuestionBankId] = useState("");
  const [livesPerPlayer, setLivesPerPlayer] = useState(3);
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function tryLoadBanks() {
    try {
      const b = await listQuestionBanks();
      setBanks(b);
      if (b[0]) setQuestionBankId(b[0].id);
      setUnlocked(true);
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

  if (unlocked === null) return null;
  if (!unlocked) return <AdminCodeGate onUnlock={unlock} error={gateError} busy={gateBusy} />;

  async function submit() {
    setFormError(null);
    try {
      const event = await createEvent({ name, questionBankId, livesPerPlayer });
      setCreated(event);
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
        <label className="text-sm text-ink-muted">
          Vies par joueur
          <input
            type="number"
            min={1}
            max={10}
            value={livesPerPlayer}
            onChange={(e) => setLivesPerPlayer(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
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
    </div>
  );
}
