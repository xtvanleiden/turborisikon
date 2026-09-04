import { TERRITORY_MAP } from "./board";
import { maxArmiesPurchasable } from "./economy";
import { GameAction, GameState } from "./types";

function ownedIds(state: GameState, playerId: string): string[] {
  return Object.entries(state.territories)
    .filter(([, t]) => t.owner === playerId)
    .map(([id]) => id);
}

function borderScore(state: GameState, playerId: string, territoryId: string): number {
  const territory = TERRITORY_MAP[territoryId];
  const own = state.territories[territoryId].armies;
  let enemyMax = 0;
  let hasEnemyBorder = false;
  for (const adj of territory.adjacent) {
    const t = state.territories[adj];
    if (t.owner && t.owner !== playerId) {
      hasEnemyBorder = true;
      enemyMax = Math.max(enemyMax, t.armies);
    }
  }
  if (!hasEnemyBorder) return -1;
  return enemyMax - own;
}

/** Decide il piazzamento delle armate dell'IA durante la fase di setup iniziale (max 3 a turno). */
export function decideSetupPlacement(state: GameState, playerId: string): GameAction[] {
  const player = state.players.find((p) => p.id === playerId)!;
  const toPlace = Math.min(3, player.reserve);
  const actions: GameAction[] = [];
  if (toPlace <= 0) return actions;

  const owned = ownedIds(state, playerId);
  const borders = owned
    .map((id) => ({ id, score: borderScore(state, playerId, id) }))
    .filter((b) => b.score > -1)
    .sort((a, b) => b.score - a.score);
  const targets = borders.length > 0 ? borders : owned.map((id) => ({ id, score: 0 }));

  const allocation = new Map<string, number>();
  let remaining = toPlace;
  let i = 0;
  while (remaining > 0 && targets.length > 0) {
    const target = targets[i % targets.length];
    allocation.set(target.id, (allocation.get(target.id) ?? 0) + 1);
    remaining -= 1;
    i += 1;
  }
  for (const [territoryId, count] of allocation) {
    actions.push({ type: "PLACE_ARMIES", playerId, territoryId, count });
  }
  return actions;
}

/** Decide quante armate spostare nel territorio appena conquistato dall'IA. */
export function decideConquerMove(state: GameState, playerId: string): GameAction {
  const pending = state.pendingConquest!;
  const territory = TERRITORY_MAP[pending.to];
  let enemyMax = 0;
  for (const adj of territory.adjacent) {
    const t = state.territories[adj];
    if (t.owner && t.owner !== playerId) enemyMax = Math.max(enemyMax, t.armies);
  }
  const count = Math.min(pending.max, Math.max(pending.min, enemyMax));
  return { type: "MOVE_IN_ARMIES", playerId, count };
}

/** Decide gli acquisti e il piazzamento delle armate per il turno di rinforzo dell'IA. */
export function decideReinforcement(state: GameState, playerId: string): GameAction[] {
  const player = state.players.find((p) => p.id === playerId)!;
  const actions: GameAction[] = [];

  const buyCount = maxArmiesPurchasable(player.currency, state.settings.armyCostR);
  if (buyCount > 0) {
    actions.push({ type: "BUY_ARMIES", playerId, count: buyCount });
  }

  let reserve = player.reserve + buyCount;
  const owned = ownedIds(state, playerId);
  const borders = owned
    .map((id) => ({ id, score: borderScore(state, playerId, id) }))
    .filter((b) => b.score > -1)
    .sort((a, b) => b.score - a.score);

  const targets = borders.length > 0 ? borders : owned.map((id) => ({ id, score: 0 }));

  const allocation = new Map<string, number>();
  let i = 0;
  while (reserve > 0 && targets.length > 0) {
    const target = targets[i % targets.length];
    allocation.set(target.id, (allocation.get(target.id) ?? 0) + 1);
    reserve -= 1;
    i += 1;
  }
  for (const [territoryId, count] of allocation) {
    actions.push({ type: "PLACE_ARMIES", playerId, territoryId, count });
  }

  actions.push({ type: "END_REINFORCE", playerId });
  return actions;
}

/** Restituisce la prossima mossa di attacco dell'IA, o null se ha finito. */
export function decideNextAttack(state: GameState, playerId: string): GameAction | null {
  const owned = ownedIds(state, playerId);
  let best: { from: string; to: string; ratio: number; fromArmies: number } | null = null;

  for (const fromId of owned) {
    const from = state.territories[fromId];
    if (from.armies < 2) continue;
    const territory = TERRITORY_MAP[fromId];
    for (const toId of territory.adjacent) {
      const to = state.territories[toId];
      if (!to.owner || to.owner === playerId) continue;
      const ratio = from.armies / Math.max(1, to.armies);
      if (ratio < 1.5) continue;
      if (!best || ratio > best.ratio) {
        best = { from: fromId, to: toId, ratio, fromArmies: from.armies };
      }
    }
  }

  if (!best) return null;
  const dice = Math.min(3, best.fromArmies - 1);
  return { type: "ATTACK", playerId, from: best.from, to: best.to, dice };
}

/** Decide un eventuale spostamento di rinforzo verso il fronte più debole. */
export function decideFortify(state: GameState, playerId: string): GameAction | null {
  const owned = ownedIds(state, playerId);
  const scored = owned.map((id) => ({ id, score: borderScore(state, playerId, id) }));

  const weakestBorder = scored
    .filter((s) => s.score > -1)
    .sort((a, b) => b.score - a.score)[0];
  if (!weakestBorder) return null;

  const interior = scored
    .filter((s) => s.score === -1 && state.territories[s.id].armies > 1 && s.id !== weakestBorder.id)
    .sort((a, b) => state.territories[b.id].armies - state.territories[a.id].armies);

  for (const candidate of interior) {
    if (isReachable(state, playerId, candidate.id, weakestBorder.id)) {
      const count = state.territories[candidate.id].armies - 1;
      if (count > 0) {
        return { type: "FORTIFY", playerId, from: candidate.id, to: weakestBorder.id, count };
      }
    }
  }
  return null;
}

function isReachable(state: GameState, playerId: string, start: string, target: string): boolean {
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === target) return true;
    for (const adj of TERRITORY_MAP[current].adjacent) {
      if (visited.has(adj)) continue;
      if (state.territories[adj]?.owner !== playerId) continue;
      visited.add(adj);
      queue.push(adj);
    }
  }
  return visited.has(target);
}
