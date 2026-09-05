import { areAdjacent, TERRITORIES } from "./board";
import { resolveCombat, maxAttackerDice, maxDefenderDice } from "./combat";
import { computeIncome, computeReinforcementArmies, DEFAULT_SETTINGS } from "./economy";
import { makeId } from "./id";
import { GameAction, GameState, Player, PlayerKind, TerritoryState } from "./types";

export class GameError extends Error {}

const PLAYER_COLORS = ["#e5484d", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"];

export function createLobby(): GameState {
  return {
    status: "lobby",
    players: [],
    turnOrder: [],
    setupOrder: [],
    setupPlacedThisTurn: 0,
    currentPlayerIndex: 0,
    turn: 0,
    phase: "reinforce",
    territories: {},
    settings: { ...DEFAULT_SETTINGS },
    lastBattle: null,
    pendingConquest: null,
    attackedThisTurn: false,
    log: [],
    winnerId: null,
  };
}

export function addPlayer(
  state: GameState,
  name: string,
  kind: PlayerKind,
  id?: string,
  personalityId: string | null = null
): GameState {
  const next = structuredClone(state);
  if (next.status !== "lobby") throw new GameError("La partita è già iniziata");
  if (next.players.length >= 6) throw new GameError("Numero massimo di giocatori raggiunto");
  const color = PLAYER_COLORS[next.players.length];
  next.players.push({
    id: id ?? makeId(),
    name,
    kind,
    color,
    alive: true,
    currency: 0,
    reserve: 0,
    personalityId,
    turnsSinceLastAttack: 0,
  });
  return next;
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const next = structuredClone(state);
  if (next.status !== "lobby") return next;
  next.players = next.players.filter((p) => p.id !== playerId);
  return next;
}

function startArmiesFor(playerCount: number): number {
  return Math.max(20, 45 - 5 * (playerCount - 2));
}

function log(state: GameState, message: string) {
  state.log.push({ id: makeId(), turn: state.turn, message });
  if (state.log.length > 200) state.log.shift();
}

function grantTurnIncome(state: GameState, playerId: string) {
  const player = state.players.find((p) => p.id === playerId)!;
  const armies = computeReinforcementArmies(state, playerId);
  const income = computeIncome(state, playerId);
  player.reserve += armies;
  player.currency += income;
  log(
    state,
    `${player.name} riceve ${armies} armate di rinforzo e ${income}R di reddito (riserva: ${player.reserve}, R: ${player.currency}).`
  );
}

export function startGame(state: GameState): GameState {
  const next = structuredClone(state);
  if (next.status !== "lobby") throw new GameError("La partita è già iniziata");
  if (next.players.length < 2) throw new GameError("Servono almeno 2 giocatori");

  const shuffledPlayers = [...next.players].sort(() => Math.random() - 0.5);
  next.turnOrder = shuffledPlayers.map((p) => p.id);

  const shuffledTerritories = [...TERRITORIES].sort(() => Math.random() - 0.5);
  const territories: Record<string, TerritoryState> = {};
  for (const t of TERRITORIES) territories[t.id] = { owner: null, armies: 0 };

  shuffledTerritories.forEach((t, i) => {
    const owner = next.turnOrder[i % next.turnOrder.length];
    territories[t.id] = { owner, armies: 1 };
  });
  next.territories = territories;

  const totalStart = startArmiesFor(next.players.length);
  for (const player of next.players) {
    const owned = Object.values(territories).filter((t) => t.owner === player.id).length;
    player.reserve = Math.max(0, totalStart - owned);
    player.currency = 0;
  }

  next.status = "playing";
  next.turn = 0;
  next.setupOrder = [...next.turnOrder].reverse();
  next.setupPlacedThisTurn = 0;
  next.currentPlayerIndex = 0;
  next.phase = "setup";
  next.log = [];
  next.winnerId = null;
  next.pendingConquest = null;

  const firstSetupIdx = next.setupOrder.findIndex(
    (pid) => playerById(next, pid).reserve > 0
  );
  if (firstSetupIdx === -1) {
    beginRealGame(next);
  } else {
    next.currentPlayerIndex = firstSetupIdx;
    log(
      next,
      `La partita inizia. Fase di piazzamento iniziale: tocca a ${playerById(next, next.setupOrder[firstSetupIdx]).name}.`
    );
  }
  return next;
}

function playerById(state: GameState, id: string): Player {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new GameError("Giocatore non trovato");
  return p;
}

export function currentPlayerId(state: GameState): string {
  if (state.phase === "setup") {
    return state.setupOrder[state.currentPlayerIndex];
  }
  return state.turnOrder[state.currentPlayerIndex];
}

function assertCurrentPlayer(state: GameState, playerId: string) {
  if (currentPlayerId(state) !== playerId) {
    throw new GameError("Non è il tuo turno");
  }
}

function assertPhase(state: GameState, phase: GameState["phase"]) {
  if (state.phase !== phase) {
    throw new GameError(`Azione non valida nella fase "${state.phase}"`);
  }
}

function territoriesOwnedCount(state: GameState, playerId: string): number {
  return Object.values(state.territories).filter((t) => t.owner === playerId).length;
}

function checkWinner(state: GameState) {
  const alive = state.players.filter((p) => p.alive);
  if (alive.length === 1) {
    state.status = "finished";
    state.phase = "gameover";
    state.winnerId = alive[0].id;
    log(state, `${alive[0].name} ha conquistato il mondo!`);
  }
}

function totalReserve(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.reserve, 0);
}

function beginRealGame(state: GameState) {
  state.phase = "reinforce";
  state.currentPlayerIndex = 0;
  state.turn = 1;
  const firstPlayer = playerById(state, state.turnOrder[0]);
  log(state, `Piazzamento iniziale completato. La partita inizia. Tocca a ${firstPlayer.name}.`);
  grantTurnIncome(state, state.turnOrder[0]);
}

function advanceSetupTurn(state: GameState) {
  state.setupPlacedThisTurn = 0;
  if (totalReserve(state) <= 0) {
    beginRealGame(state);
    return;
  }
  const n = state.setupOrder.length;
  let idx = state.currentPlayerIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const pid = state.setupOrder[idx];
    const player = playerById(state, pid);
    if (player.reserve > 0) {
      state.currentPlayerIndex = idx;
      log(state, `Piazzamento iniziale: tocca a ${player.name} (riserva: ${player.reserve}).`);
      return;
    }
  }
  beginRealGame(state);
}

function advanceToNextPlayer(state: GameState) {
  const n = state.turnOrder.length;
  let idx = state.currentPlayerIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const pid = state.turnOrder[idx];
    const player = playerById(state, pid);
    if (player.alive) {
      if (idx <= state.currentPlayerIndex) state.turn += 1;
      state.currentPlayerIndex = idx;
      state.phase = "reinforce";
      state.lastBattle = null;
      log(state, `Turno ${state.turn}: tocca a ${player.name}.`);
      grantTurnIncome(state, pid);
      return;
    }
  }
}

export function applyAction(state: GameState, action: GameAction): GameState {
  const next = structuredClone(state);
  if (next.status !== "playing") throw new GameError("La partita non è in corso");

  switch (action.type) {
    case "BUY_ARMIES": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "reinforce");
      if (action.count <= 0) throw new GameError("Quantità non valida");
      const player = playerById(next, action.playerId);
      const cost = action.count * next.settings.armyCostR;
      if (cost > player.currency) throw new GameError("Risikon insufficienti");
      player.currency -= cost;
      player.reserve += action.count;
      log(next, `${player.name} acquista ${action.count} armate per ${cost}R.`);
      break;
    }
    case "PLACE_ARMIES": {
      assertCurrentPlayer(next, action.playerId);
      if (next.phase !== "reinforce" && next.phase !== "setup") {
        throw new GameError(`Azione non valida nella fase "${next.phase}"`);
      }
      const player = playerById(next, action.playerId);
      const territory = next.territories[action.territoryId];
      if (!territory) throw new GameError("Territorio inesistente");
      if (territory.owner !== action.playerId) throw new GameError("Territorio non tuo");
      if (action.count <= 0 || action.count > player.reserve) {
        throw new GameError("Armate in riserva insufficienti");
      }
      if (next.phase === "setup") {
        const remaining = 3 - next.setupPlacedThisTurn;
        if (action.count > remaining) {
          throw new GameError(`Puoi piazzare al massimo ${remaining} armate in questo turno`);
        }
      }
      player.reserve -= action.count;
      territory.armies += action.count;
      log(next, `${player.name} schiera ${action.count} armate su ${action.territoryId}.`);
      if (next.phase === "setup") {
        next.setupPlacedThisTurn += action.count;
        if (next.setupPlacedThisTurn >= 3 || player.reserve === 0) {
          advanceSetupTurn(next);
        }
      }
      break;
    }
    case "END_REINFORCE": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "reinforce");
      next.phase = "attack";
      next.attackedThisTurn = false;
      break;
    }
    case "ATTACK": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "attack");
      const player = playerById(next, action.playerId);
      const from = next.territories[action.from];
      const to = next.territories[action.to];
      if (!from || !to) throw new GameError("Territorio inesistente");
      if (from.owner !== action.playerId) throw new GameError("Territorio di partenza non tuo");
      if (to.owner === action.playerId) throw new GameError("Non puoi attaccare un tuo territorio");
      if (!areAdjacent(action.from, action.to)) throw new GameError("Territori non adiacenti");

      next.attackedThisTurn = true;

      const maxAtk = maxAttackerDice(from.armies);
      if (maxAtk < 1) throw new GameError("Armate insufficienti per attaccare");
      const attackerDiceCount = Math.min(action.dice, maxAtk);
      const defenderDiceCount = maxDefenderDice(to.armies);
      const defenderId = to.owner!;

      const result = resolveCombat(attackerDiceCount, defenderDiceCount);
      from.armies -= result.attackerLosses;
      to.armies -= result.defenderLosses;

      let conquered = false;
      if (to.armies <= 0) {
        conquered = true;
        const min = Math.min(attackerDiceCount, from.armies - 1);
        const max = Math.max(min, from.armies - 1);
        to.owner = action.playerId;
        to.armies = 0;
        next.pendingConquest = { from: action.from, to: action.to, min, max };
        next.phase = "conquer";

        const defender = playerById(next, defenderId);
        if (territoriesOwnedCount(next, defenderId) === 0) {
          defender.alive = false;
          player.currency += defender.currency;
          defender.currency = 0;
          log(next, `${defender.name} è stato eliminato! ${player.name} ne eredita i Risikon.`);
        }
      }

      next.lastBattle = {
        from: action.from,
        to: action.to,
        attackerId: action.playerId,
        defenderId,
        attackerDice: result.attackerDice,
        defenderDice: result.defenderDice,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        conquered,
      };
      log(
        next,
        `${player.name} attacca ${action.to} da ${action.from}: [${result.attackerDice.join(
          ","
        )}] vs [${result.defenderDice.join(",")}] → attaccante -${result.attackerLosses}, difensore -${result.defenderLosses}${
          conquered ? " — TERRITORIO CONQUISTATO" : ""
        }.`
      );

      checkWinner(next);
      break;
    }
    case "MOVE_IN_ARMIES": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "conquer");
      const pending = next.pendingConquest;
      if (!pending) throw new GameError("Nessuna conquista in sospeso");
      const player = playerById(next, action.playerId);
      if (action.count < pending.min || action.count > pending.max) {
        throw new GameError(`Devi spostare tra ${pending.min} e ${pending.max} armate`);
      }
      const from = next.territories[pending.from];
      const to = next.territories[pending.to];
      from.armies -= action.count;
      to.armies += action.count;
      log(next, `${player.name} sposta ${action.count} armate nel territorio conquistato (${pending.to}).`);
      next.pendingConquest = null;
      next.phase = "attack";
      break;
    }
    case "END_ATTACK": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "attack");
      const player = playerById(next, action.playerId);
      player.turnsSinceLastAttack = next.attackedThisTurn ? 0 : player.turnsSinceLastAttack + 1;
      next.phase = "fortify";
      break;
    }
    case "FORTIFY": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "fortify");
      const player = playerById(next, action.playerId);
      const from = next.territories[action.from];
      const to = next.territories[action.to];
      if (!from || !to) throw new GameError("Territorio inesistente");
      if (from.owner !== action.playerId || to.owner !== action.playerId) {
        throw new GameError("Entrambi i territori devono essere tuoi");
      }
      if (action.count <= 0 || action.count >= from.armies) {
        throw new GameError("Devi lasciare almeno 1 armata nel territorio di partenza");
      }
      if (!isConnectedThroughOwnTerritory(next, action.playerId, action.from, action.to)) {
        throw new GameError("I territori non sono collegati da un percorso di tuoi territori");
      }
      from.armies -= action.count;
      to.armies += action.count;
      log(next, `${player.name} sposta ${action.count} armate da ${action.from} a ${action.to}.`);
      break;
    }
    case "END_FORTIFY": {
      assertCurrentPlayer(next, action.playerId);
      assertPhase(next, "fortify");
      advanceToNextPlayer(next);
      break;
    }
    default:
      throw new GameError("Azione sconosciuta");
  }

  return next;
}

function isConnectedThroughOwnTerritory(
  state: GameState,
  playerId: string,
  start: string,
  target: string
): boolean {
  const visited = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === target) return true;
    const territory = TERRITORIES.find((t) => t.id === current)!;
    for (const adj of territory.adjacent) {
      if (visited.has(adj)) continue;
      if (state.territories[adj]?.owner !== playerId) continue;
      visited.add(adj);
      queue.push(adj);
    }
  }
  return visited.has(target);
}

export function activePlayer(state: GameState): Player | null {
  if (state.status !== "playing") return null;
  return playerById(state, currentPlayerId(state));
}
