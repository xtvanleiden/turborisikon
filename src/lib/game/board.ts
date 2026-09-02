import { Continent, ContinentId, Territory } from "./types";

interface RawTerritory {
  id: string;
  name: string;
  continent: ContinentId;
  x: number;
  y: number;
}

const RAW_TERRITORIES: RawTerritory[] = [
  // Nord America
  { id: "alaska", name: "Alaska", continent: "nord_america", x: 0.06, y: 0.12 },
  { id: "nord_ovest", name: "Territori del Nord Ovest", continent: "nord_america", x: 0.16, y: 0.1 },
  { id: "groenlandia", name: "Groenlandia", continent: "nord_america", x: 0.32, y: 0.05 },
  { id: "alberta", name: "Alberta", continent: "nord_america", x: 0.14, y: 0.22 },
  { id: "ontario", name: "Ontario", continent: "nord_america", x: 0.22, y: 0.22 },
  { id: "quebec", name: "Quebec", continent: "nord_america", x: 0.3, y: 0.2 },
  { id: "usa_ovest", name: "Stati Uniti Occidentali", continent: "nord_america", x: 0.14, y: 0.34 },
  { id: "usa_est", name: "Stati Uniti Orientali", continent: "nord_america", x: 0.24, y: 0.34 },
  { id: "america_centrale", name: "America Centrale", continent: "nord_america", x: 0.16, y: 0.46 },
  // Sud America
  { id: "venezuela", name: "Venezuela", continent: "sud_america", x: 0.22, y: 0.56 },
  { id: "peru", name: "Perù", continent: "sud_america", x: 0.2, y: 0.68 },
  { id: "brasile", name: "Brasile", continent: "sud_america", x: 0.28, y: 0.66 },
  { id: "argentina", name: "Argentina", continent: "sud_america", x: 0.22, y: 0.82 },
  // Europa
  { id: "islanda", name: "Islanda", continent: "europa", x: 0.38, y: 0.08 },
  { id: "gran_bretagna", name: "Gran Bretagna", continent: "europa", x: 0.38, y: 0.18 },
  { id: "scandinavia", name: "Scandinavia", continent: "europa", x: 0.46, y: 0.08 },
  { id: "europa_nord", name: "Europa Settentrionale", continent: "europa", x: 0.46, y: 0.18 },
  { id: "europa_ovest", name: "Europa Occidentale", continent: "europa", x: 0.38, y: 0.28 },
  { id: "europa_sud", name: "Europa Meridionale", continent: "europa", x: 0.46, y: 0.28 },
  { id: "ucraina", name: "Ucraina", continent: "europa", x: 0.54, y: 0.14 },
  // Africa
  { id: "africa_nord", name: "Africa del Nord", continent: "africa", x: 0.4, y: 0.42 },
  { id: "egitto", name: "Egitto", continent: "africa", x: 0.48, y: 0.42 },
  { id: "africa_est", name: "Africa Orientale", continent: "africa", x: 0.5, y: 0.54 },
  { id: "congo", name: "Congo", continent: "africa", x: 0.44, y: 0.56 },
  { id: "sud_africa", name: "Sud Africa", continent: "africa", x: 0.44, y: 0.7 },
  { id: "madagascar", name: "Madagascar", continent: "africa", x: 0.52, y: 0.68 },
  // Asia
  { id: "medio_oriente", name: "Medio Oriente", continent: "asia", x: 0.56, y: 0.32 },
  { id: "afghanistan", name: "Afghanistan", continent: "asia", x: 0.62, y: 0.26 },
  { id: "ural", name: "Ural", continent: "asia", x: 0.62, y: 0.14 },
  { id: "siberia", name: "Siberia", continent: "asia", x: 0.7, y: 0.1 },
  { id: "yakutia", name: "Jacuzia", continent: "asia", x: 0.78, y: 0.06 },
  { id: "irkutsk", name: "Irkutsk", continent: "asia", x: 0.76, y: 0.16 },
  { id: "mongolia", name: "Mongolia", continent: "asia", x: 0.76, y: 0.24 },
  { id: "kamchatka", name: "Kamchatka", continent: "asia", x: 0.88, y: 0.1 },
  { id: "giappone", name: "Giappone", continent: "asia", x: 0.9, y: 0.24 },
  { id: "cina", name: "Cina", continent: "asia", x: 0.72, y: 0.32 },
  { id: "india", name: "India", continent: "asia", x: 0.64, y: 0.4 },
  { id: "vietnam", name: "Vietnam", continent: "asia", x: 0.76, y: 0.4 },
  // Oceania
  { id: "indonesia", name: "Indonesia", continent: "oceania", x: 0.76, y: 0.52 },
  { id: "nuova_guinea", name: "Nuova Guinea", continent: "oceania", x: 0.86, y: 0.52 },
  { id: "australia_ovest", name: "Australia Occidentale", continent: "oceania", x: 0.8, y: 0.68 },
  { id: "australia_est", name: "Australia Orientale", continent: "oceania", x: 0.88, y: 0.68 },
];

const EDGES: [string, string][] = [
  ["alaska", "nord_ovest"],
  ["alaska", "alberta"],
  ["alaska", "kamchatka"],
  ["nord_ovest", "alberta"],
  ["nord_ovest", "ontario"],
  ["nord_ovest", "groenlandia"],
  ["groenlandia", "ontario"],
  ["groenlandia", "quebec"],
  ["groenlandia", "islanda"],
  ["alberta", "ontario"],
  ["alberta", "usa_ovest"],
  ["ontario", "quebec"],
  ["ontario", "usa_ovest"],
  ["ontario", "usa_est"],
  ["quebec", "usa_est"],
  ["usa_ovest", "usa_est"],
  ["usa_ovest", "america_centrale"],
  ["usa_est", "america_centrale"],
  ["america_centrale", "venezuela"],
  ["venezuela", "brasile"],
  ["venezuela", "peru"],
  ["peru", "brasile"],
  ["peru", "argentina"],
  ["brasile", "argentina"],
  ["brasile", "africa_nord"],
  ["islanda", "gran_bretagna"],
  ["islanda", "scandinavia"],
  ["gran_bretagna", "scandinavia"],
  ["gran_bretagna", "europa_nord"],
  ["gran_bretagna", "europa_ovest"],
  ["scandinavia", "europa_nord"],
  ["scandinavia", "ucraina"],
  ["europa_nord", "ucraina"],
  ["europa_nord", "europa_sud"],
  ["europa_nord", "europa_ovest"],
  ["europa_ovest", "europa_sud"],
  ["europa_ovest", "africa_nord"],
  ["europa_sud", "ucraina"],
  ["europa_sud", "medio_oriente"],
  ["europa_sud", "egitto"],
  ["europa_sud", "africa_nord"],
  ["ucraina", "medio_oriente"],
  ["ucraina", "afghanistan"],
  ["ucraina", "ural"],
  ["africa_nord", "egitto"],
  ["africa_nord", "africa_est"],
  ["africa_nord", "congo"],
  ["egitto", "medio_oriente"],
  ["egitto", "africa_est"],
  ["africa_est", "congo"],
  ["africa_est", "sud_africa"],
  ["africa_est", "madagascar"],
  ["africa_est", "medio_oriente"],
  ["congo", "sud_africa"],
  ["sud_africa", "madagascar"],
  ["medio_oriente", "afghanistan"],
  ["medio_oriente", "india"],
  ["afghanistan", "india"],
  ["afghanistan", "ural"],
  ["afghanistan", "cina"],
  ["ural", "cina"],
  ["ural", "siberia"],
  ["siberia", "cina"],
  ["siberia", "mongolia"],
  ["siberia", "irkutsk"],
  ["siberia", "yakutia"],
  ["yakutia", "irkutsk"],
  ["yakutia", "kamchatka"],
  ["irkutsk", "kamchatka"],
  ["irkutsk", "mongolia"],
  ["kamchatka", "mongolia"],
  ["kamchatka", "giappone"],
  ["mongolia", "giappone"],
  ["mongolia", "cina"],
  ["cina", "india"],
  ["cina", "vietnam"],
  ["india", "vietnam"],
  ["vietnam", "indonesia"],
  ["indonesia", "nuova_guinea"],
  ["indonesia", "australia_ovest"],
  ["nuova_guinea", "australia_ovest"],
  ["nuova_guinea", "australia_est"],
  ["australia_ovest", "australia_est"],
];

const CONTINENT_META: Record<ContinentId, { name: string; bonus: number }> = {
  nord_america: { name: "Nord America", bonus: 5 },
  sud_america: { name: "Sud America", bonus: 2 },
  europa: { name: "Europa", bonus: 5 },
  africa: { name: "Africa", bonus: 3 },
  asia: { name: "Asia", bonus: 7 },
  oceania: { name: "Oceania", bonus: 2 },
};

const adjacencyMap = new Map<string, Set<string>>();
for (const t of RAW_TERRITORIES) adjacencyMap.set(t.id, new Set());
for (const [a, b] of EDGES) {
  adjacencyMap.get(a)!.add(b);
  adjacencyMap.get(b)!.add(a);
}

export const TERRITORIES: Territory[] = RAW_TERRITORIES.map((t) => ({
  id: t.id,
  name: t.name,
  continent: t.continent,
  x: t.x,
  y: t.y,
  adjacent: Array.from(adjacencyMap.get(t.id)!).sort(),
}));

export const TERRITORY_MAP: Record<string, Territory> = Object.fromEntries(
  TERRITORIES.map((t) => [t.id, t])
);

export const CONTINENTS: Continent[] = (Object.keys(CONTINENT_META) as ContinentId[]).map(
  (id) => ({
    id,
    name: CONTINENT_META[id].name,
    bonus: CONTINENT_META[id].bonus,
    territories: TERRITORIES.filter((t) => t.continent === id).map((t) => t.id),
  })
);

export function areAdjacent(a: string, b: string): boolean {
  return adjacencyMap.get(a)?.has(b) ?? false;
}
