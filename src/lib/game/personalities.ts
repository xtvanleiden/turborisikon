export interface AiPersonality {
  id: string;
  name: string;
  tagline: string;

  // --- economia / gestione dei Risikon ---
  /** R sempre tenuti da parte, mai spesi in armate (cuscinetto di sicurezza) */
  currencyReserve: number;
  /** se impostata, l'IA non compra nulla finché non accumula almeno questa cifra,
   *  poi la spende tutta in un colpo solo (l'"agguato"): null = compra regolarmente ogni turno */
  ambushThreshold: number | null;

  // --- aggressività / rischio in attacco ---
  /** rapporto minimo armate attaccante/difensore per considerare un attacco conveniente */
  attackRatioThreshold: number;
  /** non attacca mai da un territorio che ha meno (o uguale) di queste armate: quanto presidio minimo vuole sempre lasciarsi */
  minArmiesToKeepAttacking: number;
  /** 0..1: quanta casualità nella scelta del bersaglio tra le opzioni migliori (0 = sempre la scelta ottima) */
  randomness: number;

  // --- focus strategico ---
  /** 0..1: peso dato al completare/consolidare un continente */
  continentFocus: number;
  /** 0..1: peso dato all'attaccare il giocatore attualmente in testa alla partita */
  targetLeaderBias: number;
  /** 0..1: quota (tra il minimo obbligatorio e il massimo possibile) di armate spostate dopo una conquista */
  conquestOverstack: number;
  /** 0..1: quanta priorità dà al rinforzare i fronti deboli invece di espandersi liberamente */
  defensiveBias: number;
}

export const PERSONALITIES: AiPersonality[] = [
  {
    id: "alessandro",
    name: "Alessandro Magno",
    tagline: "Conquista tutto ciò che vede, senza mai fermarsi.",
    currencyReserve: 0,
    ambushThreshold: null,
    attackRatioThreshold: 1.2,
    minArmiesToKeepAttacking: 1,
    randomness: 0.1,
    continentFocus: 0.8,
    targetLeaderBias: 0.2,
    conquestOverstack: 0.8,
    defensiveBias: 0.2,
  },
  {
    id: "napoleone",
    name: "Napoleone Bonaparte",
    tagline: "Accumula risorse in silenzio, poi colpisce con forza schiacciante.",
    currencyReserve: 100,
    ambushThreshold: 700,
    attackRatioThreshold: 1.6,
    minArmiesToKeepAttacking: 2,
    randomness: 0.15,
    continentFocus: 0.5,
    targetLeaderBias: 0.6,
    conquestOverstack: 0.9,
    defensiveBias: 0.4,
  },
  {
    id: "gengis_khan",
    name: "Gengis Khan",
    tagline: "Non si ferma mai: ogni fronte è un'occasione per razziare.",
    currencyReserve: 0,
    ambushThreshold: null,
    attackRatioThreshold: 1.1,
    minArmiesToKeepAttacking: 1,
    randomness: 0.05,
    continentFocus: 0.3,
    targetLeaderBias: 0.1,
    conquestOverstack: 0.3,
    defensiveBias: 0.1,
  },
  {
    id: "sun_tzu",
    name: "Sun Tzu",
    tagline: "Attacca solo quando la vittoria è già certa.",
    currencyReserve: 200,
    ambushThreshold: 500,
    attackRatioThreshold: 2.5,
    minArmiesToKeepAttacking: 3,
    randomness: 0.05,
    continentFocus: 0.6,
    targetLeaderBias: 0.4,
    conquestOverstack: 0.5,
    defensiveBias: 0.7,
  },
  {
    id: "annibale",
    name: "Annibale Barca",
    tagline: "Aggira le difese e colpisce dove non te lo aspetti.",
    currencyReserve: 50,
    ambushThreshold: null,
    attackRatioThreshold: 1.3,
    minArmiesToKeepAttacking: 1,
    randomness: 0.35,
    continentFocus: 0.3,
    targetLeaderBias: 0.3,
    conquestOverstack: 0.4,
    defensiveBias: 0.3,
  },
  {
    id: "cesare",
    name: "Giulio Cesare",
    tagline: "Conquista con metodo, continente dopo continente.",
    currencyReserve: 100,
    ambushThreshold: null,
    attackRatioThreshold: 1.5,
    minArmiesToKeepAttacking: 2,
    randomness: 0.1,
    continentFocus: 0.9,
    targetLeaderBias: 0.7,
    conquestOverstack: 0.6,
    defensiveBias: 0.5,
  },
  {
    id: "rommel",
    name: "Erwin Rommel",
    tagline: "Sposta le sue truppe dove serve, prima che il nemico se ne accorga.",
    currencyReserve: 50,
    ambushThreshold: null,
    attackRatioThreshold: 1.4,
    minArmiesToKeepAttacking: 2,
    randomness: 0.25,
    continentFocus: 0.4,
    targetLeaderBias: 0.3,
    conquestOverstack: 0.5,
    defensiveBias: 0.8,
  },
  {
    id: "kutuzov",
    name: "Kutuzov",
    tagline: "Aspetta, si difende, e colpisce solo quando il nemico è sfinito.",
    currencyReserve: 300,
    ambushThreshold: 900,
    attackRatioThreshold: 2.2,
    minArmiesToKeepAttacking: 3,
    randomness: 0.05,
    continentFocus: 0.2,
    targetLeaderBias: 0.5,
    conquestOverstack: 0.8,
    defensiveBias: 0.9,
  },
  {
    id: "custer",
    name: "Custer",
    tagline: "Carica sempre, a qualunque costo.",
    currencyReserve: 0,
    ambushThreshold: null,
    attackRatioThreshold: 0.5,
    minArmiesToKeepAttacking: 1,
    randomness: 0.4,
    continentFocus: 0.1,
    targetLeaderBias: 0,
    conquestOverstack: 0.9,
    defensiveBias: 0,
  },
  {
    id: "vercingetorige",
    name: "Vercingetorige",
    tagline: "Difende la sua terra e si scaglia su chiunque diventi troppo forte.",
    currencyReserve: 100,
    ambushThreshold: null,
    attackRatioThreshold: 1.3,
    minArmiesToKeepAttacking: 2,
    randomness: 0.2,
    continentFocus: 0.2,
    targetLeaderBias: 0.9,
    conquestOverstack: 0.4,
    defensiveBias: 0.9,
  },
];

const DEFAULT_PERSONALITY: AiPersonality = {
  id: "recluta",
  name: "Recluta",
  tagline: "Un soldato senza scuola: gioca in modo prevedibile e bilanciato.",
  currencyReserve: 0,
  ambushThreshold: null,
  attackRatioThreshold: 1.5,
  minArmiesToKeepAttacking: 1,
  randomness: 0,
  continentFocus: 0,
  targetLeaderBias: 0,
  conquestOverstack: 0.3,
  defensiveBias: 0.5,
};

export function personalityById(id: string | null | undefined): AiPersonality {
  return PERSONALITIES.find((p) => p.id === id) ?? DEFAULT_PERSONALITY;
}

/** Sceglie una personalità storica non ancora usata nella stanza, se possibile. */
export function pickUnusedPersonality(usedIds: (string | null | undefined)[]): AiPersonality {
  const used = new Set(usedIds.filter(Boolean));
  const available = PERSONALITIES.filter((p) => !used.has(p.id));
  const pool = available.length > 0 ? available : PERSONALITIES;
  return pool[Math.floor(Math.random() * pool.length)];
}
