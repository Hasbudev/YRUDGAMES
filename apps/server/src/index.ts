import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@yrud/shared";
import { eventsRouter } from "./admin/events";
import { questionsRouter } from "./admin/questions";
import { getRoomByCode } from "./rooms/roomManager";

const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", eventsRouter);
app.use("/api", questionsRouter);

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: WEB_ORIGIN },
});

io.on("connection", async (socket) => {
  const eventCode = String(socket.handshake.query.eventCode ?? "");
  const role = socket.handshake.query.role === "admin" ? "admin" : "player";
  socket.data.eventCode = eventCode;
  socket.data.role = role;

  if (role === "admin") {
    const adminCode = socket.handshake.query.adminCode;
    if (!process.env.ADMIN_ACCESS_CODE || adminCode !== process.env.ADMIN_ACCESS_CODE) {
      socket.emit("error:message", { message: "Code d'administrateur invalide." });
      socket.disconnect(true);
      return;
    }
  }

  const room = await getRoomByCode(io, eventCode);
  if (!room) {
    socket.emit("error:message", { message: `Événement "${eventCode}" introuvable.` });
    socket.disconnect(true);
    return;
  }

  socket.join(room.socketRoom);
  socket.emit("state:sync", room.snapshot());

  socket.on("player:join", async ({ name, existingPlayerId, avatarId }, ack) => {
    const playerId = existingPlayerId ?? randomUUID();
    const result = await room.addPlayer(playerId, name.trim().slice(0, 24) || "Joueur", avatarId);
    if ("error" in result) {
      ack({ error: result.error });
      return;
    }
    socket.data.playerId = playerId;
    room.registerPlayerSocket(playerId, socket.id);
    room.markPlayerConnected(playerId);
    ack({ playerId });
  });

  socket.on("disconnect", () => {
    if (socket.data.playerId) room.markPlayerDisconnected(socket.data.playerId);
  });

  socket.on("player:answer", ({ questionId, choiceIndex }) => {
    const playerId = socket.data.playerId;
    if (!playerId) return;
    room.submitAnswer(playerId, questionId, choiceIndex);
  });

  function requireAdmin(ack?: (res: { ok: true } | { error: string }) => void): boolean {
    if (socket.data.role === "admin") return true;
    ack?.({ error: "Non autorisé." });
    return false;
  }

  socket.on("admin:start", async (ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.start());
  });

  socket.on("admin:reveal", async (ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.reveal());
  });

  socket.on("admin:next", async (ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.next());
  });

  socket.on("admin:startSpeedRound", async (ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.startSpeedRound());
  });

  socket.on("speedRound:requestQuestion", (ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ error: "Rejoins d'abord l'événement." });
      return;
    }
    ack(room.requestSpeedQuestion(playerId));
  });

  socket.on("speedRound:answer", ({ questionId, choiceIndex }, ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ error: "Rejoins d'abord l'événement." });
      return;
    }
    ack(room.answerSpeedQuestion(playerId, questionId, choiceIndex));
  });

  socket.on("admin:taunt", async ({ message }, ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.sendTaunt(message));
  });

  socket.on("admin:triggerPrank", async ({ prankId }, ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.triggerPrank(prankId));
  });

  socket.on("admin:challengeDuel", async ({ opponentId }, ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.challengeDuel(opponentId));
  });

  socket.on("admin:declareBattlePlan", async ({ text }, ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.declareBattlePlan(text));
  });

  socket.on("admin:startFinalBattle", async ({ player1Id, player2Id, team1, team2 }, ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.startFinalBattle(player1Id, player2Id, team1, team2));
  });

  socket.on("admin:battleInterfere", async ({ type, optionId }, ack) => {
    if (!requireAdmin(ack)) return;
    ack?.(await room.applyBattleInterference(type, optionId));
  });

  socket.on("player:battleChoice", ({ choice }, ack) => {
    const playerId = socket.data.playerId;
    if (!playerId) {
      ack({ error: "Rejoins d'abord l'événement." });
      return;
    }
    ack(room.submitBattleChoice(playerId, choice));
  });
});

httpServer.listen(PORT, () => {
  console.log(`YRUD GAMES server listening on :${PORT}`);
});
