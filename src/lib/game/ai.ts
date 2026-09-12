import { CONTINENTS, TERRITORY_MAP } from "./board";
import { attackerWinProbability } from "./combat";
import { maxArmiesPurchasable } from "./economy";
import { AiPersonality, personalityById } from "./personalities";
import { GameAction, GameState } from "./types";

function ownedIds(state: GameState, playerId: string): string[] {
  return Object.entries(state.territories)
    .filter(([, t]) => t.owner === playerId)
    .map(([id]) => id);
}

/** null se il territorio non confina con nessun nemico (territorio interno);
 *  altrimenti la differenza (armate nemiche più forti - armate proprie): più alta, più a rischio. */
function borderScore(state: GameState, playerId: string, territoryId: string): number | null {
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
  if (!hasEnemyBorder) return null;
  return enemyMax - own;
}

/** Probabilità che il territorio resista se il vicino nemico più forte lo attaccasse fino alla morte
 *  (1 = nessuna minaccia). Usata per dare priorità ai rinforzi su basi solide, non su un semplice conteggio. */
function holdProbability(state: GameState, playerId: string, territoryId: string): number {
  const territory = TERRITORY_MAP[territoryId];
  const own = state.territories[territoryId].armies;
  let enemyMax = 0;
  for (const adj of territory.adjacent) {
    const t = state.territories[adj];
    if (t.owner && t.owner !== playerId) enemyMax = Math.max(enemyMax, t.armies);
  }
  if (enemyMax === 0) return 1;
  return 1 - attackerWinProbability(enemyMax, own);
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

/** true se conquistare questo territorio spezzerebbe un continente attualmente completo di un avversario
 *  (gli toglie il bonus di rinforzo): una priorità classica delle IA più "geografiche". */
function continentDenialBonus(state: GameState, targetOwnerId: string, territoryId: string): number {
  for (const continent of CONTINENTS) {
    if (!continent.territories.includes(territoryId)) continue;
    const fullyOwnedByTarget = continent.territories.every(
      (tid) => state.territories[tid].owner === targetOwnerId
    );
    if (fullyOwnedByTarget) return 1;
  }
  return 0;
}

/** Stima delle armate necessarie per eliminare del tutto un giocatore in un turno:
 *  le sue armate attuali, più circa 1 armata di presidio per territorio da occupare,
 *  più un margine per l'eventuale rinforzo che riceverebbe, più un cuscinetto di sicurezza.
 *  Ispirata alla logica delle IA storiche che davano priorità a "finire" gli avversari deboli
 *  per ereditarne le risorse invece di limitarsi a mordicchiare i confini. */
function estimatedArmiesToEliminate(state: GameState, targetPlayerId: string): number {
  const territories = ownedIds(state, targetPlayerId);
  const totalArmies = territories.reduce((sum, id) => sum + state.territories[id].armies, 0);
  const territoryCount = territories.length;
  return totalArmies + territoryCount + Math.ceil(territoryCount / 3) + 3;
}

/** true se il giocatore ha, in totale sulla mappa, abbastanza armate per eliminare del tutto
 *  il bersaglio in questo turno secondo la stima di `estimatedArmiesToEliminate`. */
function canLikelyEliminate(state: GameState, playerId: string, targetPlayerId: string): boolean {
  const ownArmies = ownedIds(state, playerId).reduce((sum, id) => sum + state.territories[id].armies, 0);
  return ownArmies >= estimatedArmiesToEliminate(state, targetPlayerId);
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

function totalArmies(state: GameState, playerId: string): number {
  return ownedIds(state, playerId).reduce((sum, id) => sum + state.territories[id].armies, 0);
}

function isHumanControlled(state: GameState, playerId: string): boolean {
  return state.players.find((p) => p.id === playerId)?.kind === "human";
}

/** Individua il rivale vivo più debole (meno armate totali, a parità meno territori): il bersaglio
 *  naturale della "modalità esecutore", equivalente al WP (weakest player) delle IA storiche che
 *  ordinavano i rivali per forza (RankSort) per scegliere chi finire per primo. */
function weakestAlivePlayerId(state: GameState, excludeId: string): string | null {
  let best: { id: string; armies: number; territories: number } | null = null;
  for (const p of state.players) {
    if (!p.alive || p.id === excludeId) continue;
    const owned = ownedIds(state, p.id);
    const armies = owned.reduce((sum, id) => sum + state.territories[id].armies, 0);
    if (!best || armies < best.armies || (armies === best.armies && owned.length < best.territories)) {
      best = { id: p.id, armies, territories: owned.length };
    }
  }
  return best?.id ?? null;
}

/** true se le proprie armate totali superano già di `finisherThreshold` volte quelle del rivale più
 *  forte rimasto: equivale al rilevamento "sto vincendo alla grande" delle IA storiche
 *  (PArmiesCount(PMe) > soglia * avversario), che le faceva smettere di giocare in modo prudente e
 *  passare alla modalità esecutore contro il rivale più debole per chiudere in fretta la partita. */
function isFinisherMode(state: GameState, playerId: string, personality: AiPersonality): boolean {
  const own = totalArmies(state, playerId);
  let strongestOther = 0;
  for (const p of state.players) {
    if (!p.alive || p.id === playerId) continue;
    strongestOther = Math.max(strongestOther, totalArmies(state, p.id));
  }
  if (strongestOther === 0) return true;
  return own > strongestOther * personality.finisherThreshold;
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
    .filter((b): b is { id: string; score: number } => b.score !== null)
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
  const finisher = isFinisherMode(state, playerId, personality);
  const weakestId = weakestAlivePlayerId(state, playerId);
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

  // le armate appena acquistate non sono ancora in riserva: diventano disponibili
  // solo dall'inizio della fase di attacco (quindi dal prossimo turno utile)
  let reserve = player.reserve;
  const owned = ownedIds(state, playerId);
  const borders = owned
    .map((id) => {
      const score = borderScore(state, playerId, id);
      if (score === null) return null;
      // priorità di rinforzo basata sulla probabilità REALE che il fronte regga a un attacco
      // totale del vicino più forte, non su un semplice conteggio di armate
      const urgency = (1 - holdProbability(state, playerId, id)) * 10;
      let priority = urgency + continentProgress(state, playerId, id) * personality.continentFocus * 3;

      // i fronti che affacciano sul rivale designato (il più debole, o un umano) ricevono
      // priorità extra: è lì che va ammassata la forza per aprire e sostenere il varco,
      // l'equivalente del calcolo del percorso più economico (TWeakestPath) delle IA storiche
      const adjacentEnemies = TERRITORY_MAP[id].adjacent
        .map((adj) => state.territories[adj].owner)
        .filter((o): o is string => !!o && o !== playerId);
      if (weakestId && adjacentEnemies.includes(weakestId)) {
        priority += personality.huntWeakBias * (finisher ? 6 : 3);
      }
      if (adjacentEnemies.some((o) => isHumanControlled(state, o))) {
        priority += personality.vsHumanBias * (finisher ? 4 : 2);
      }
      return { id, score: priority };
    })
    .filter((b): b is { id: string; score: number } => b !== null)
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

// Quanto si abbassa la soglia minima di probabilità di vittoria per ogni turno di
// inattività militare consecutiva: anche il condottiero più prudente, prima o poi, attacca.
const IMPATIENCE_PROB_STEP = 0.02;
const IMPATIENCE_PROB_FLOOR = 0.3;
const IMPATIENCE_ARMIES_STEP_TURNS = 8; // ogni N turni di inattività, il presidio minimo richiesto scende di 1

// oltre questa probabilità di vittoria, l'IA si impegna a fondo (attacco "fino alla morte")
// invece di rivalutare il bersaglio migliore a ogni singolo round
const COMMIT_UNTIL_DEATH_PROBABILITY = 0.75;

// bonus di punteggio per un attacco che eliminerebbe del tutto un avversario
// (ne eredita riserva e Risikon): vale per qualsiasi personalità, è buon senso strategico
const ELIMINATION_BONUS = 4;

/** Restituisce la prossima mossa di attacco dell'IA, o null se ha finito. */
export function decideNextAttack(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId)!;
  const personality = personalityById(player.personalityId);
  const owned = ownedIds(state, playerId);
  const leaderId = leaderPlayerId(state);
  const finisher = isFinisherMode(state, playerId, personality);
  const weakestId = weakestAlivePlayerId(state, playerId);

  // Più turni passano senza che questo giocatore attacchi, più diventa disposto a rischiare.
  const inactivity = player.turnsSinceLastAttack;
  let minWinProbability = Math.max(
    IMPATIENCE_PROB_FLOOR,
    personality.minWinProbability - inactivity * IMPATIENCE_PROB_STEP
  );
  // in modalità esecutore anche il condottiero più prudente smette di trattenersi:
  // ha già la partita in pugno, ora si tratta solo di chiuderla in fretta
  if (finisher) minWinProbability = Math.min(minWinProbability, IMPATIENCE_PROB_FLOOR);
  const minArmiesToKeepAttacking = Math.max(
    1,
    personality.minArmiesToKeepAttacking - Math.floor(inactivity / IMPATIENCE_ARMIES_STEP_TURNS)
  );

  const candidates: { from: string; to: string; fromArmies: number; winProbability: number; score: number }[] =
    [];

  for (const fromId of owned) {
    const from = state.territories[fromId];
    if (from.armies < 2) continue;
    if (from.armies <= minArmiesToKeepAttacking) continue;

    const territory = TERRITORY_MAP[fromId];
    for (const toId of territory.adjacent) {
      const to = state.territories[toId];
      if (!to.owner || to.owner === playerId) continue;

      const winProbability = attackerWinProbability(from.armies, to.armies);
      if (winProbability < minWinProbability) continue;

      let score = winProbability;
      score += continentCompletionBonus(state, playerId, toId) * personality.continentFocus * 3;
      score += continentDenialBonus(state, to.owner, toId) * personality.continentFocus * 2;
      if (leaderId && to.owner === leaderId) score += personality.targetLeaderBias * 2;
      if (isHumanControlled(state, to.owner)) {
        // contro un avversario umano alcuni condottieri alzano la guardia (e l'aggressività)
        // molto più che contro un'altra IA, specie una volta in modalità esecutore
        score += personality.vsHumanBias * (finisher ? 3 : 1.5);
      }
      if (ownedIds(state, to.owner).length === 1) {
        score += ELIMINATION_BONUS;
      } else if (canLikelyEliminate(state, playerId, to.owner)) {
        // il bersaglio è abbastanza debole da poter essere eliminato del tutto in questo
        // turno: alcuni condottieri (stile "Vexer") danno priorità a finirlo per il bottino
        score += personality.huntWeakBias * 3;
      }
      if (finisher && to.owner === weakestId) {
        // modalità esecutore: il rivale più debole rimasto è il bersaglio designato,
        // lo si insegue anche se non è ancora eliminabile in questo turno
        score += personality.huntWeakBias * 4 + 2;
      }

      candidates.push({ from: fromId, to: toId, fromArmies: from.armies, winProbability, score });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const chosen = pickWithRandomness(candidates, personality.randomness);
  const dice = Math.min(3, chosen.fromArmies - 1);
  const untilDeath = chosen.winProbability >= COMMIT_UNTIL_DEATH_PROBABILITY;
  return { type: "ATTACK", playerId, from: chosen.from, to: chosen.to, dice, untilDeath };
}

// una pila interna più grande di questa soglia va svuotata quasi sempre,
// indipendentemente dalla personalità: nessun comandante lascia marcire le riserve nell'entroterra
const URGENT_INTERIOR_STOCKPILE = 10;

/** Trova, tra i territori indicati, il più vicino raggiungibile da `start` passando solo per territori propri. */
function nearestReachableAmong(
  state: GameState,
  playerId: string,
  start: string,
  targets: Set<string>
): string | null {
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const adj of TERRITORY_MAP[current].adjacent) {
      if (visited.has(adj)) continue;
      if (state.territories[adj]?.owner !== playerId) continue;
      if (targets.has(adj)) return adj;
      visited.add(adj);
      queue.push(adj);
    }
  }
  return null;
}

/** Decide un eventuale spostamento di rinforzo: svuota i territori interni (senza confini nemici)
 *  verso il fronte raggiungibile più vicino, così le armate non restano intrappolate nell'entroterra. */
export function decideFortify(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId)!;
  if (player.currency < state.settings.fortifyCostR) return null;

  const personality = personalityById(player.personalityId);
  const finisher = isFinisherMode(state, playerId, personality);
  const weakestId = weakestAlivePlayerId(state, playerId);
  const owned = ownedIds(state, playerId);
  const scored = owned.map((id) => ({ id, score: borderScore(state, playerId, id) }));

  const frontIds = new Set(scored.filter((s) => s.score !== null).map((s) => s.id));
  if (frontIds.size === 0) return null;

  // in modalità esecutore, i fronti che affacciano sul bersaglio designato (il rivale più
  // debole, o l'unico umano rimasto) hanno sempre la precedenza sugli altri
  const targetFrontIds = finisher
    ? new Set(
        [...frontIds].filter((id) =>
          TERRITORY_MAP[id].adjacent.some((adj) => {
            const owner = state.territories[adj].owner;
            return owner === weakestId || (!!owner && owner !== playerId && isHumanControlled(state, owner));
          })
        )
      )
    : frontIds;
  const fortifyTargets = targetFrontIds.size > 0 ? targetFrontIds : frontIds;

  const interior = scored
    .filter((s) => s.score === null && state.territories[s.id].armies > 1)
    .sort((a, b) => state.territories[b.id].armies - state.territories[a.id].armies);

  for (const candidate of interior) {
    const spare = state.territories[candidate.id].armies - 1;
    const urgent = spare >= URGENT_INTERIOR_STOCKPILE || finisher;
    // sotto la soglia critica, i condottieri meno difensivi a volte preferiscono continuare
    // a espandersi piuttosto che ritirare truppe; oltre la soglia si muovono quasi sempre
    if (!urgent && Math.random() > 0.5 + personality.defensiveBias * 0.5) continue;

    const nearestFront = nearestReachableAmong(state, playerId, candidate.id, fortifyTargets);
    if (!nearestFront) continue;

    const intensity = finisher ? 0.9 : urgent ? 0.7 : 0.4 + 0.6 * personality.defensiveBias;
    const count = Math.min(5, Math.max(1, Math.round(spare * intensity)));
    return { type: "FORTIFY", playerId, from: candidate.id, to: nearestFront, count };
  }
  return null;
}
