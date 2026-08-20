import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  QuestionMetadata,
  ServerToClientEvents,
  SocketData,
} from "@yrud/shared";
import { prisma } from "../db/client";
import type { InternalQuestion } from "../game/types";
import { DEFAULT_TIME_LIMIT_MS, EventRoom } from "./eventRoom";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const rooms = new Map<string, EventRoom>();
// Concurrent connections for the same code must await the same load, or each
// one races past the (empty) cache and builds its own orphaned EventRoom.
const pendingLoads = new Map<string, Promise<EventRoom | null>>();

async function loadRoom(io: IoServer, code: string): Promise<EventRoom | null> {
  const event = await prisma.event.findUnique({
    where: { code },
    include: { questionBank: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!event) return null;

  const allQuestions: InternalQuestion[] = (event.questionBank?.questions ?? []).map((q) => ({
    id: q.id,
    theme: q.theme,
    prompt: q.prompt,
    choices: q.choices as string[],
    correctIndex: q.correctIndex,
    metadata: (q.metadata as QuestionMetadata | null) ?? undefined,
    mediaUrl: q.mediaUrl ?? undefined,
    timeLimitMs: DEFAULT_TIME_LIMIT_MS,
  }));

  // Blind test pulls independently from its own pool — it's not part of the
  // main one-question-at-a-time sequence; the admin triggers it as a
  // side-activity instead of via "next question". Any legacy "speed"-themed
  // rows (the removed speed round) are simply excluded — dead data, not fed
  // into any pool.
  const mainQuestions = allQuestions.filter((q) => q.theme !== "speed" && q.theme !== "ost");
  const blindTestQuestions = allQuestions.filter((q) => q.theme === "ost");

  const room = new EventRoom(io, event.id, event.code, mainQuestions, blindTestQuestions, event.livesPerPlayer);
  rooms.set(code, room);
  return room;
}

export async function getRoomByCode(io: IoServer, code: string): Promise<EventRoom | null> {
  const cached = rooms.get(code);
  if (cached) return cached;

  const pending = pendingLoads.get(code);
  if (pending) return pending;

  const loadPromise = loadRoom(io, code).finally(() => pendingLoads.delete(code));
  pendingLoads.set(code, loadPromise);
  return loadPromise;
}

export function dropRoom(code: string) {
  rooms.delete(code);
}
