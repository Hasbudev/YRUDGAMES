"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createQuestionBank,
  getStoredAdminCode,
  listQuestionBanks,
  storeAdminCode,
  UnauthorizedError,
  type QuestionBankSummary,
} from "@/lib/api";
import { AdminCodeGate } from "@/components/admin/AdminCodeGate";

export default function QuestionBanksPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [newBankName, setNewBankName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setBanks(await listQuestionBanks());
      setUnlocked(true);
    } catch (e) {
      setUnlocked(false);
      if (e instanceof UnauthorizedError) setGateError("Code d'accès invalide.");
    }
  }

  useEffect(() => {
    if (getStoredAdminCode()) refresh();
    else setUnlocked(false);
  }, []);

  async function unlock(code: string) {
    setGateError(null);
    storeAdminCode(code);
    await refresh();
  }

  async function createBank() {
    if (!newBankName.trim()) return;
    try {
      const bank = await createQuestionBank(newBankName.trim());
      setBanks((prev) => [...prev, bank]);
      setNewBankName("");
      setError(null);
    } catch {
      setError("Échec de la création de la banque.");
    }
  }

  if (unlocked === null) return null;
  if (!unlocked) return <AdminCodeGate onUnlock={unlock} error={gateError} />;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-8">
      <h1 className="font-display text-2xl font-bold text-gold-bright">Banques de questions</h1>

      <div className="panel flex w-full max-w-lg flex-col gap-3 rounded-2xl p-4">
        <div className="flex gap-2">
          <input
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBank()}
            placeholder="Nom de la nouvelle banque..."
            className="flex-1 rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
          <button
            onClick={createBank}
            disabled={!newBankName.trim()}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-void-deep disabled:opacity-40"
          >
            Créer
          </button>
        </div>
        {error && <p className="text-sm text-crimson-bright">{error}</p>}
      </div>

      <div className="flex w-full max-w-lg flex-col gap-2">
        {banks.length === 0 && <p className="text-center text-sm text-ink-muted">Aucune banque pour le moment.</p>}
        {banks.map((bank) => (
          <Link
            key={bank.id}
            href={`/admin/questions/${bank.id}`}
            className="panel flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:border-border-strong"
          >
            <span className="font-semibold text-ink">{bank.name}</span>
            <span className="text-xs text-ink-muted">{bank.questionCount} question(s)</span>
          </Link>
        ))}
      </div>

      <Link href="/admin" className="text-sm text-ink-muted underline">
        Retour à l&apos;administration
      </Link>
    </div>
  );
}
