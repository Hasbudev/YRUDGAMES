const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
const ADMIN_CODE_STORAGE_KEY = "yrud:adminCode";

export interface QuestionBankSummary {
  id: string;
  name: string;
  questionCount: number;
}

export interface EventSummary {
  id: string;
  code: string;
  name: string;
  status?: "draft" | "live" | "finished";
}

export interface OpenEventSummary {
  code: string;
  name: string;
  status: "draft" | "live";
  playerCount: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  name: string;
  clan: string | null;
  eventsPlayed: number;
  wins: number;
  bestPlacement: number;
  totalCorrectAnswers: number;
}

export function getStoredAdminCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_CODE_STORAGE_KEY);
}

export function storeAdminCode(code: string) {
  localStorage.setItem(ADMIN_CODE_STORAGE_KEY, code);
}

export function clearStoredAdminCode() {
  localStorage.removeItem(ADMIN_CODE_STORAGE_KEY);
}

class UnauthorizedError extends Error {}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const adminCode = getStoredAdminCode();
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { ...init.headers, "x-admin-code": adminCode ?? "" },
  });
  if (res.status === 401) {
    clearStoredAdminCode();
    throw new UnauthorizedError("Invalid admin code");
  }
  return res;
}

export { UnauthorizedError };

export async function listOpenEvents(): Promise<OpenEventSummary[]> {
  const res = await fetch(`${SERVER_URL}/api/events/open`);
  if (!res.ok) throw new Error("Failed to load open events");
  return res.json();
}

export async function listLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${SERVER_URL}/api/leaderboard`);
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

export async function listQuestionBanks(): Promise<QuestionBankSummary[]> {
  const res = await adminFetch("/api/question-banks");
  if (!res.ok) throw new Error("Failed to load question banks");
  return res.json();
}

export async function createEvent(input: {
  name: string;
  questionBankId: string;
}): Promise<EventSummary> {
  const res = await adminFetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create event");
  return res.json();
}

export async function getEventByCode(code: string): Promise<EventSummary | null> {
  const res = await fetch(`${SERVER_URL}/api/events/${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load event");
  return res.json();
}

// --- Question bank management ---

// "speed" is kept here even though the speed round feature was removed — it's
// still a valid value in the Prisma QuestionTheme enum (legacy rows stay
// representable) even though nothing creates or plays them anymore.
export type QuestionTheme = "trivia" | "ost" | "stats" | "speed";

export interface MelodyNoteInput {
  freq: number;
  durationMs: number;
}

// Round grouping (for the "MANCHE N" banner) and scoring beyond the flat
// default — shared across every theme, so questions of any theme can be
// grouped into the same manche.
export interface RoundFields {
  roundIndex?: number;
  roundLabel?: string;
  wrongPoints?: number;
  blankPoints?: number;
  comboThreshold?: number;
  comboBonus?: number;
  allCorrect?: boolean;
}

export type QuestionInput =
  | ({ theme: "trivia"; prompt: string; choices: string[]; correctIndex: number; mediaUrl?: string; points?: number } & RoundFields)
  | ({
      theme: "ost";
      prompt: string;
      choices: string[];
      correctIndex: number;
      mediaUrl?: string;
      notes?: MelodyNoteInput[];
      audioFile?: string;
      points?: number;
    } & RoundFields)
  | ({ theme: "stats"; prompt: string; choices: [string, string]; correctIndex: 0 | 1; stat: string; points?: number } & RoundFields);

export interface QuestionRecord {
  id: string;
  theme: QuestionTheme;
  order: number;
  prompt: string;
  mediaUrl: string | null;
  choices: string[];
  correctIndex: number;
  metadata: {
    notes?: MelodyNoteInput[];
    stat?: string;
    audioFile?: string;
  } | null;
  points: number;
  roundIndex: number;
  roundLabel: string | null;
  wrongPoints: number;
  blankPoints: number | null;
  comboThreshold: number | null;
  comboBonus: number | null;
  allCorrect: boolean;
}

class ApiError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export { ApiError };

async function parseErrorOrThrow(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new ApiError(body?.error ?? fallback, body?.details);
}

export async function createQuestionBank(name: string): Promise<QuestionBankSummary> {
  const res = await adminFetch("/api/question-banks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Échec de la création de la banque de questions.");
  return res.json();
}

export async function listQuestions(bankId: string): Promise<QuestionRecord[]> {
  const res = await adminFetch(`/api/question-banks/${encodeURIComponent(bankId)}/questions`);
  if (!res.ok) return parseErrorOrThrow(res, "Échec du chargement des questions.");
  return res.json();
}

export async function createQuestion(bankId: string, input: QuestionInput): Promise<QuestionRecord> {
  const res = await adminFetch(`/api/question-banks/${encodeURIComponent(bankId)}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Échec de la création de la question.");
  return res.json();
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<QuestionRecord> {
  const res = await adminFetch(`/api/questions/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Échec de la modification de la question.");
  return res.json();
}

export async function deleteQuestion(id: string): Promise<void> {
  const res = await adminFetch(`/api/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) return parseErrorOrThrow(res, "Échec de la suppression de la question.");
}

export async function moveQuestion(id: string, direction: "up" | "down"): Promise<void> {
  const res = await adminFetch(`/api/questions/${encodeURIComponent(id)}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Échec du déplacement de la question.");
}

export async function bulkImportQuestions(bankId: string, questions: QuestionInput[]): Promise<{ created: number }> {
  const res = await adminFetch(`/api/question-banks/${encodeURIComponent(bankId)}/questions/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions }),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Échec de l'import en masse.");
  return res.json();
}
