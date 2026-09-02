import { CONTINENTS } from "./board";
import { GameState } from "./types";

export const DEFAULT_SETTINGS = {
  armyCostR: 100,
  incomePerTerritory: 50,
};

export function territoriesOwnedBy(state: GameState, playerId: string): string[] {
  return Object.entries(state.territories)
    .filter(([, t]) => t.owner === playerId)
    .map(([id]) => id);
}

/** Armate da rinforzo guadagnate: territori/3 (minimo 3) + bonus continenti completi */
export function computeReinforcementArmies(state: GameState, playerId: string): number {
  const owned = new Set(territoriesOwnedBy(state, playerId));
  const base = Math.max(3, Math.floor(owned.size / 3));

  let continentBonus = 0;
  for (const continent of CONTINENTS) {
    if (continent.territories.every((tid) => owned.has(tid))) {
      continentBonus += continent.bonus;
    }
  }

  return base + continentBonus;
}

/** Risikon guadagnati questo turno: 50R per ogni territorio posseduto */
export function computeIncome(state: GameState, playerId: string): number {
  const owned = territoriesOwnedBy(state, playerId).length;
  return owned * state.settings.incomePerTerritory;
}

export function maxArmiesPurchasable(currency: number, armyCostR: number): number {
  return Math.floor(currency / armyCostR);
}
