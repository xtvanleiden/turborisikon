import type { Server, Socket } from "socket.io";
import { addPlayer, applyAction, createLobby, GameError, removePlayer, startGame } from "../lib/game/engine";
import {
  decideConquerMove,
  decideFortify,
  decideNextAttack,
  decideReinforcement,
  decideSetupPlacement,
} from "../lib/game/ai";
import { makeId } from "../lib/game/id";
import { GameAction, GameState } from "../lib/game/types";

interface Room {
  id: string;
  hostId: string;
  gameState: GameState;
  /** playerId -> socketId (null if disconnected human) */
  sockets: Record<string, string | null>;
  aiRunning: boolean;
}

const rooms = new Map<string, Room>();

function makeRoomId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 5; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(id) ? makeRoomId() : id;
}

function publicRoom(room: Room) {
  return {
    id: room.id,
    hostId: room.hostId,
    players: room.gameState.players.map((p) => ({
      ...p,
      connected: p.kind === "ai" ? true : Boolean(room.sockets[p.id]),
    })),
    status: room.gameState.status,
  };
}

function broadcastRoom(io: Server, room: Room) {
  io.to(room.id).emit("room:state", publicRoom(room));
}

function broadcastGame(io: Server, room: Room) {
  io.to(room.id).emit("game:state", room.gameState);
}

const AI_ATTACK_DELAY_MS = 550;
const AI_REINFORCE_DELAY_MS = 250;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAiIfNeeded(io: Server, room: Room) {
  if (room.aiRunning) return;
  const state = room.gameState;
  if (state.status !== "playing") return;
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const player = state.players.find((p) => p.id === currentId);
  if (!player || player.kind !== "ai") return;

  room.aiRunning = true;
  try {
    while (room.gameState.status === "playing") {
      const cur = room.gameState;
      const curId = cur.turnOrder[cur.currentPlayerIndex];
      const curPlayer = cur.players.find((p) => p.id === curId);
      if (!curPlayer || curPlayer.kind !== "ai") break;

      if (cur.phase === "setup") {
        const actions = decideSetupPlacement(cur, curId);
        for (const action of actions) {
          room.gameState = applyAction(room.gameState, action);
          broadcastGame(io, room);
          await delay(AI_REINFORCE_DELAY_MS);
        }
        if (actions.length === 0) break;
      } else if (cur.phase === "conquer") {
        const action = decideConquerMove(cur, curId);
        room.gameState = applyAction(room.gameState, action);
        broadcastGame(io, room);
        await delay(AI_ATTACK_DELAY_MS);
      } else if (cur.phase === "reinforce") {
        const actions = decideReinforcement(cur, curId);
        for (const action of actions) {
          room.gameState = applyAction(room.gameState, action);
          broadcastGame(io, room);
          await delay(AI_REINFORCE_DELAY_MS);
        }
      } else if (cur.phase === "attack") {
        const action = decideNextAttack(cur, curId);
        if (action) {
          room.gameState = applyAction(room.gameState, action);
          broadcastGame(io, room);
          await delay(AI_ATTACK_DELAY_MS);
        } else {
          room.gameState = applyAction(room.gameState, { type: "END_ATTACK", playerId: curId });
          broadcastGame(io, room);
          await delay(150);
        }
      } else if (cur.phase === "fortify") {
        const action = decideFortify(cur, curId);
        if (action) {
          room.gameState = applyAction(room.gameState, action);
          broadcastGame(io, room);
          await delay(AI_REINFORCE_DELAY_MS);
        }
        room.gameState = applyAction(room.gameState, { type: "END_FORTIFY", playerId: curId });
        broadcastGame(io, room);
        await delay(150);
      } else {
        break;
      }
    }
  } finally {
    room.aiRunning = false;
  }
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  socket.on("room:create", (payload: { name: string }, ack: (res: any) => void) => {
    const roomId = makeRoomId();
    let gameState = createLobby();
    const playerId = makeId();
    gameState = addPlayer(gameState, payload.name?.slice(0, 20) || "Giocatore", "human", playerId);
    const room: Room = {
      id: roomId,
      hostId: playerId,
      gameState,
      sockets: { [playerId]: socket.id },
      aiRunning: false,
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    ack({ ok: true, roomId, playerId });
    broadcastRoom(io, room);
  });

  socket.on(
    "room:join",
    (payload: { roomId: string; name: string }, ack: (res: any) => void) => {
      const room = rooms.get(payload.roomId?.toUpperCase());
      if (!room) return ack({ ok: false, error: "Stanza non trovata" });
      if (room.gameState.status !== "lobby") {
        return ack({ ok: false, error: "La partita è già iniziata" });
      }
      try {
        const playerId = makeId();
        room.gameState = addPlayer(
          room.gameState,
          payload.name?.slice(0, 20) || "Giocatore",
          "human",
          playerId
        );
        room.sockets[playerId] = socket.id;
        socket.join(room.id);
        ack({ ok: true, roomId: room.id, playerId });
        broadcastRoom(io, room);
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "Errore" });
      }
    }
  );

  socket.on(
    "room:rejoin",
    (payload: { roomId: string; playerId: string }, ack: (res: any) => void) => {
      const room = rooms.get(payload.roomId?.toUpperCase());
      if (!room) return ack({ ok: false, error: "Stanza non trovata" });
      const player = room.gameState.players.find((p) => p.id === payload.playerId);
      if (!player) return ack({ ok: false, error: "Giocatore non trovato in questa stanza" });
      room.sockets[payload.playerId] = socket.id;
      socket.join(room.id);
      ack({ ok: true, roomId: room.id, playerId: payload.playerId });
      broadcastRoom(io, room);
      socket.emit("game:state", room.gameState);
    }
  );

  socket.on("room:addAi", (payload: { roomId: string; playerId: string }, ack?: (res: any) => void) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack?.({ ok: false, error: "Stanza non trovata" });
    if (room.hostId !== payload.playerId) return ack?.({ ok: false, error: "Solo l'host può farlo" });
    try {
      const aiNumber = room.gameState.players.filter((p) => p.kind === "ai").length + 1;
      room.gameState = addPlayer(room.gameState, `IA ${aiNumber}`, "ai");
      ack?.({ ok: true });
      broadcastRoom(io, room);
    } catch (e) {
      ack?.({ ok: false, error: e instanceof Error ? e.message : "Errore" });
    }
  });

  socket.on(
    "room:removePlayer",
    (payload: { roomId: string; playerId: string; targetId: string }, ack?: (res: any) => void) => {
      const room = rooms.get(payload.roomId);
      if (!room) return ack?.({ ok: false, error: "Stanza non trovata" });
      if (room.hostId !== payload.playerId) return ack?.({ ok: false, error: "Solo l'host può farlo" });
      if (payload.targetId === room.hostId) return ack?.({ ok: false, error: "Non puoi rimuovere l'host" });
      room.gameState = removePlayer(room.gameState, payload.targetId);
      delete room.sockets[payload.targetId];
      ack?.({ ok: true });
      broadcastRoom(io, room);
    }
  );

  socket.on("room:start", (payload: { roomId: string; playerId: string }, ack?: (res: any) => void) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack?.({ ok: false, error: "Stanza non trovata" });
    if (room.hostId !== payload.playerId) return ack?.({ ok: false, error: "Solo l'host può avviare la partita" });
    try {
      room.gameState = startGame(room.gameState);
      ack?.({ ok: true });
      broadcastRoom(io, room);
      broadcastGame(io, room);
      void runAiIfNeeded(io, room);
    } catch (e) {
      ack?.({ ok: false, error: e instanceof Error ? e.message : "Errore" });
    }
  });

  socket.on(
    "game:action",
    (payload: { roomId: string; action: GameAction }, ack?: (res: any) => void) => {
      const room = rooms.get(payload.roomId);
      if (!room) return ack?.({ ok: false, error: "Stanza non trovata" });
      try {
        room.gameState = applyAction(room.gameState, payload.action);
        ack?.({ ok: true });
        broadcastGame(io, room);
        void runAiIfNeeded(io, room);
      } catch (e) {
        const message = e instanceof GameError ? e.message : "Errore imprevisto";
        ack?.({ ok: false, error: message });
      }
    }
  );

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      for (const [playerId, socketId] of Object.entries(room.sockets)) {
        if (socketId === socket.id) {
          room.sockets[playerId] = null;
          broadcastRoom(io, room);
        }
      }
    }
  });
}
