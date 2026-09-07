import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@yrud/shared";
import { getStoredAdminCode } from "./api";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export function createSocket(
  eventCode: string,
  role: "player" | "admin" | "spectator" = "player"
): Socket<ServerToClientEvents, ClientToServerEvents> {
  return io(SERVER_URL, {
    query: {
      eventCode,
      role,
      ...(role === "admin" ? { adminCode: getStoredAdminCode() ?? "" } : {}),
    },
    autoConnect: true,
  });
}
