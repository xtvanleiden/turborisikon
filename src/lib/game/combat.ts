/**
 * Regole italiane del Risiko: l'attaccante lancia fino a 3 dadi, il difensore
 * lancia fino a 3 dadi (non 2 come nella versione Risk americana). Il numero
 * di dadi è comunque limitato dal numero di armate presenti.
 */

export function rollDice(count: number): number[] {
  const dice: number[] = [];
  for (let i = 0; i < count; i++) {
    dice.push(1 + Math.floor(Math.random() * 6));
  }
  return dice.sort((a, b) => b - a);
}

export function maxAttackerDice(attackerArmies: number): number {
  // deve rimanere almeno 1 armata nel territorio di partenza
  return Math.max(0, Math.min(3, attackerArmies - 1));
}

export function maxDefenderDice(defenderArmies: number): number {
  return Math.max(0, Math.min(3, defenderArmies));
}

export interface CombatResult {
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
}

export function resolveCombat(
  attackerDiceCount: number,
  defenderDiceCount: number
): CombatResult {
  const attackerDice = rollDice(attackerDiceCount);
  const defenderDice = rollDice(defenderDiceCount);

  let attackerLosses = 0;
  let defenderLosses = 0;

  const comparisons = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < comparisons; i++) {
    if (attackerDice[i] > defenderDice[i]) {
      defenderLosses++;
    } else {
      // il difensore vince i pareggi (parità)
      attackerLosses++;
    }
  }

  return { attackerDice, defenderDice, attackerLosses, defenderLosses };
}

// ****************************************************************
// * PROBABILITÀ ESATTA DI VITTORIA (per le decisioni dell'IA)     *
// * Enumerazione completa degli esiti dei dadi, non simulazione. *
// ****************************************************************

interface RoundOutcome {
  attackerLosses: number;
  defenderLosses: number;
  probability: number;
}

function rollCombination(index: number, diceCount: number): number[] {
  const values: number[] = [];
  let remainder = index;
  for (let i = 0; i < diceCount; i++) {
    values.push((remainder % 6) + 1);
    remainder = Math.floor(remainder / 6);
  }
  return values.sort((a, b) => b - a);
}

function computeRoundOutcomes(attackerDiceCount: number, defenderDiceCount: number): RoundOutcome[] {
  const tally = new Map<string, number>();
  const attackerCombos = 6 ** attackerDiceCount;
  const defenderCombos = 6 ** defenderDiceCount;
  const comparisons = Math.min(attackerDiceCount, defenderDiceCount);

  for (let ai = 0; ai < attackerCombos; ai++) {
    const attackerDice = rollCombination(ai, attackerDiceCount);
    for (let di = 0; di < defenderCombos; di++) {
      const defenderDice = rollCombination(di, defenderDiceCount);
      let attackerLosses = 0;
      let defenderLosses = 0;
      for (let k = 0; k < comparisons; k++) {
        if (attackerDice[k] > defenderDice[k]) defenderLosses++;
        else attackerLosses++;
      }
      const key = `${attackerLosses}:${defenderLosses}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }

  const total = attackerCombos * defenderCombos;
  return Array.from(tally.entries()).map(([key, count]) => {
    const [attackerLosses, defenderLosses] = key.split(":").map(Number);
    return { attackerLosses, defenderLosses, probability: count / total };
  });
}

// [dadi attaccante][dadi difensore] -> distribuzione degli esiti di un singolo scontro
const ROUND_OUTCOMES: RoundOutcome[][][] = [[], [], [], []];
for (let ad = 1; ad <= 3; ad++) {
  ROUND_OUTCOMES[ad] = [[]];
  for (let dd = 1; dd <= 3; dd++) {
    ROUND_OUTCOMES[ad][dd] = computeRoundOutcomes(ad, dd);
  }
}

const winProbabilityCache = new Map<number, number>();

/**
 * Probabilità che l'attaccante, lanciando sempre il massimo dei dadi finché possibile
 * ("fino alla morte"), conquisti alla fine il territorio, date le armate attuali dei due
 * schieramenti. Calcolata per enumerazione esatta degli esiti dei dadi (con memoizzazione),
 * non per simulazione: è la stessa logica delle tabelle di probabilità usate dai giocatori
 * esperti di Risiko per valutare se un attacco conviene davvero.
 */
export function attackerWinProbability(attackerArmies: number, defenderArmies: number): number {
  if (defenderArmies <= 0) return 1;
  if (attackerArmies <= 1) return 0;

  const cacheKey = attackerArmies * 100000 + defenderArmies;
  const cached = winProbabilityCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const attackerDiceCount = Math.min(3, attackerArmies - 1);
  const defenderDiceCount = Math.min(3, defenderArmies);
  const outcomes = ROUND_OUTCOMES[attackerDiceCount][defenderDiceCount];

  let probability = 0;
  for (const outcome of outcomes) {
    const nextAttacker = attackerArmies - outcome.attackerLosses;
    const nextDefender = defenderArmies - outcome.defenderLosses;
    probability += outcome.probability * attackerWinProbability(nextAttacker, nextDefender);
  }

  winProbabilityCache.set(cacheKey, probability);
  return probability;
}
