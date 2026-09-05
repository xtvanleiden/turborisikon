import { CONTINENTS, TERRITORY_MAP } from "./board";
import { maxArmiesPurchasable } from "./economy";
import { personalityById } from "./personalities";
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

/** Frazione (0..1) di un continente già posseduta da playerId: quanto è vicino a completarlo. */
function continentProgress(state: GameState, playerId: string, territoryId: string): number {
  const continent = CONTINENTS.find((c) => c.territories.includes(territoryId));
  if (!continent) return 0;
  const owned = continent.territories.filter((tid) => state.territories[tid].owner === playerId).length;
  return owned / continent.territories.length;
}

/** true se conquistare esattamente questo territorio completerebbe un continente per playerId. */
function continentCompletionBonus(state: GameState, playerId: string, territoryId: string): number {
  for (const continent of CONTINENTS) {
    if (!continent.territories.includes(territoryId)) continue;
    const stillMissing = continent.territories.some(
      (tid) => tid !== territoryId && state.territories[tid].owner !== playerId
    );
    if (!stillMissing) return 1;
  }
  return 0;
}

/** Individua il giocatore attualmente "in testa" (più territori, poi più armate totali). */
function leaderPlayerId(state: GameState): string | null {
  let best: { id: string; territories: number; armies: number } | null = null;
  for (const p of state.players) {
    if (!p.alive) continue;
    const owned = ownedIds(state, p.id);
    const armies = owned.reduce((sum, id) => sum + state.territories[id].armies, 0);
    if (
      !best ||
      owned.length > best.territories ||
      (owned.length === best.territories && armies > best.armies)
    ) {
      best = { id: p.id, territories: owned.length, armies };
    }
  }
  return best?.id ?? null;
}

/** Sceglie un elemento tra i migliori candidati (già ordinati per punteggio decrescente),
 *  con una probabilità di scostarsi dall'ottimo che cresce con `randomness` (0..1). */
function pickWithRandomness<T>(sorted: T[], randomness: number): T {
  if (sorted.length <= 1 || randomness <= 0) return sorted[0];
  const poolSize = Math.min(sorted.length, 1 + Math.round(randomness * 3));
  const idx = Math.floor(Math.random() * poolSize);
  return sorted[idx];
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
  const personality = personalityById(state.players.find((p) => p.id === playerId)?.personalityId);
  const territory = TERRITORY_MAP[pending.to];

  let enemyMax = 0;
  for (const adj of territory.adjacent) {
    const t = state.territories[adj];
    if (t.owner && t.owner !== playerId) enemyMax = Math.max(enemyMax, t.armies);
  }
  const byThreat = Math.min(pending.max, Math.max(pending.min, enemyMax));
  const byPersonality = Math.round(
    pending.min + (pending.max - pending.min) * personality.conquestOverstack
  );
  const count = Math.min(pending.max, Math.max(byThreat, byPersonality));
  return { type: "MOVE_IN_ARMIES", playerId, count };
}

/** Decide gli acquisti e il piazzamento delle armate per il turno di rinforzo dell'IA. */
export function decideReinforcement(state: GameState, playerId: string): GameAction[] {
  const player = state.players.find((p) => p.id === playerId)!;
  const personality = personalityById(player.personalityId);
  const actions: GameAction[] = [];

  // Gestione dei Risikon: alcuni condottieri risparmiano per un "agguato" futuro,
  // altri spendono regolarmente tenendo solo un piccolo cuscinetto.
  let buyCount: number;
  if (personality.ambushThreshold != null) {
    buyCount =
      player.currency >= personality.ambushThreshold
        ? maxArmiesPurchasable(player.currency, state.settings.armyCostR)
        : 0;
  } else {
    const spendable = Math.max(0, player.currency - personality.currencyReserve);
    buyCount = maxArmiesPurchasable(spendable, state.settings.armyCostR);
  }
  if (buyCount > 0) {
    actions.push({ type: "BUY_ARMIES", playerId, count: buyCount });
  }

  let reserve = player.reserve + buyCount;
  const owned = ownedIds(state, playerId);
  const borders = owned
    .map((id) => ({
      id,
      score:
        borderScore(state, playerId, id) +
        continentProgress(state, playerId, id) * personality.continentFocus * 3,
    }))
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

// Quanto si abbassano le soglie di attacco per ogni turno di inattività militare consecutiva.
const IMPATIENCE_RATIO_STEP = 0.05;
const IMPATIENCE_RATIO_FLOOR = 0.8;
const IMPATIENCE_ARMIES_STEP_TURNS = 8; // ogni N turni di inattività, il presidio minimo richiesto scende di 1

/** Restituisce la prossima mossa di attacco dell'IA, o null se ha finito. */
export function decideNextAttack(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const personality = personalityById(player.personalityId);
  const owned = ownedIds(state, playerId);
  const leaderId = leaderPlayerId(state);

  // Più turni passano senza che questo giocatore attacchi, più diventa disposto a rischiare:
  // anche il condottiero più prudente, prima o poi, finisce per attaccare.
  const inactivity = player.turnsSinceLastAttack;
  const attackRatioThreshold = Math.max(
    IMPATIENCE_RATIO_FLOOR,
    personality.attackRatioThreshold - inactivity * IMPATIENCE_RATIO_STEP
  );
  const minArmiesToKeepAttacking = Math.max(
    1,
    personality.minArmiesToKeepAttacking - Math.floor(inactivity / IMPATIENCE_ARMIES_STEP_TURNS)
  );

  const candidates: { from: string; to: string; fromArmies: number; score: number }[] = [];

  for (const fromId of owned) {
    const from = state.territories[fromId];
    if (from.armies < 2) continue;
    if (from.armies <= minArmiesToKeepAttacking) continue;

    const territory = TERRITORY_MAP[fromId];
    for (const toId of territory.adjacent) {
      const to = state.territories[toId];
      if (!to.owner || to.owner === playerId) continue;
      const ratio = from.armies / Math.max(1, to.armies);
      if (ratio < attackRatioThreshold) continue;

      let score = ratio;
      score += continentCompletionBonus(state, playerId, toId) * personality.continentFocus * 3;
      if (leaderId && to.owner === leaderId) score += personality.targetLeaderBias * 2;

      candidates.push({ from: fromId, to: toId, fromArmies: from.armies, score });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const chosen = pickWithRandomness(candidates, personality.randomness);
  const dice = Math.min(3, chosen.fromArmies - 1);
  return { type: "ATTACK", playerId, from: chosen.from, to: chosen.to, dice };
}

/** Decide un eventuale spostamento di rinforzo verso il fronte più debole. */
export function decideFortify(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const personality = personalityById(player.personalityId);
  const owned = ownedIds(state, playerId);
  const scored = owned.map((id) => ({ id, score: borderScore(state, playerId, id) }));

  const weakestBorder = scored
    .filter((s) => s.score > -1)
    .sort((a, b) => b.score - a.score)[0];
  if (!weakestBorder) return null;

  // i condottieri meno difensivi a volte preferiscono continuare a espandersi
  // piuttosto che ritirare truppe verso un fronte debole
  if (Math.random() > 0.3 + personality.defensiveBias * 0.7) return null;

  const interior = scored
    .filter((s) => s.score === -1 && state.territories[s.id].armies > 1 && s.id !== weakestBorder.id)
    .sort((a, b) => state.territories[b.id].armies - state.territories[a.id].armies);

  for (const candidate of interior) {
    if (isReachable(state, playerId, candidate.id, weakestBorder.id)) {
      const spare = state.territories[candidate.id].armies - 1;
      const count = Math.max(1, Math.round(spare * (0.4 + 0.6 * personality.defensiveBias)));
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
