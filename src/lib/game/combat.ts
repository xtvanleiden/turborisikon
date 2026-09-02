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
