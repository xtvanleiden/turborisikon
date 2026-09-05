export type ContinentId =
  | "nord_america"
  | "sud_america"
  | "europa"
  | "africa"
  | "asia"
  | "oceania";

export interface Continent {
  id: ContinentId;
  name: string;
  bonus: number;
  territories: string[];
}

export interface Territory {
  id: string;
  name: string;
  continent: ContinentId;
  adjacent: string[];
  /** 0-1 normalized coordinates for the node-graph map layout */
  x: number;
  y: number;
}

export type PlayerKind = "human" | "ai";

export type Phase =
  | "lobby"
  | "setup"
  | "reinforce"
  | "attack"
  | "conquer"
  | "fortify"
  | "gameover";

export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
  color: string;
  alive: boolean;
  /** Risikon currency balance */
  currency: number;
  /** Armies bought or earned but not yet placed on the board */
  reserve: number;
  /** identità storica dell'IA (vedi personalities.ts); null per i giocatori umani */
  personalityId: string | null;
  /** turni consecutivi (propri) senza aver tentato nemmeno un attacco: alimenta l'"impazienza" dell'IA */
  turnsSinceLastAttack: number;
}

export interface TerritoryState {
  owner: string | null; // player id
  armies: number;
}

export interface PendingBattle {
  from: string;
  to: string;
  attackerId: string;
  defenderId: string;
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  /** numero di scontri (lanci di dadi) avvenuti in questo attacco: >1 se eseguito "fino alla morte" */
  rounds: number;
  conquered: boolean;
}

export interface PendingConquest {
  from: string;
  to: string;
  /** minimo obbligatorio: numero di dadi usati nel lancio finale vincente */
  min: number;
  /** massimo consentito: armate disponibili nel territorio di partenza meno 1 */
  max: number;
}

export interface LogEntry {
  id: string;
  turn: number;
  message: string;
}

export interface GameSettings {
  armyCostR: number; // Risikon cost per reserve army purchased
  incomePerTerritory: number; // Risikon earned per owned territory per turn
}

export interface GameState {
  status: "lobby" | "playing" | "finished";
  players: Player[];
  turnOrder: string[];
  /** ordine di piazzamento della fase di setup iniziale: inverso rispetto a turnOrder */
  setupOrder: string[];
  /** armate già piazzate dal giocatore corrente nel turno di setup in corso (max 3) */
  setupPlacedThisTurn: number;
  currentPlayerIndex: number;
  turn: number;
  phase: Phase;
  territories: Record<string, TerritoryState>;
  settings: GameSettings;
  lastBattle: PendingBattle | null;
  pendingConquest: PendingConquest | null;
  /** true se il giocatore in turno ha già tentato almeno un attacco in questa fase di attacco */
  attackedThisTurn: boolean;
  log: LogEntry[];
  winnerId: string | null;
}

export type GameAction =
  | { type: "START_GAME" }
  | { type: "BUY_ARMIES"; playerId: string; count: number }
  | { type: "PLACE_ARMIES"; playerId: string; territoryId: string; count: number }
  | { type: "END_REINFORCE"; playerId: string }
  | {
      type: "ATTACK";
      playerId: string;
      from: string;
      to: string;
      dice: number;
      /** se true, attacca ripetutamente lo stesso territorio (dadi sempre massimi) finché non lo conquista
       *  o non gli restano abbastanza armate per continuare */
      untilDeath?: boolean;
    }
  | { type: "MOVE_IN_ARMIES"; playerId: string; count: number }
  | { type: "END_ATTACK"; playerId: string }
  | {
      type: "FORTIFY";
      playerId: string;
      from: string;
      to: string;
      count: number;
    }
  | { type: "END_FORTIFY"; playerId: string };
