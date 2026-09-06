"use client";

import { CONTINENTS, TERRITORIES, TERRITORY_MAP } from "@/lib/game/board";
import { ContinentId, GameState, Player } from "@/lib/game/types";

const CONTINENT_COLORS: Record<ContinentId, string> = {
  nord_america: "#f97316",
  sud_america: "#eab308",
  europa: "#38bdf8",
  africa: "#a3e635",
  asia: "#f472b6",
  oceania: "#c084fc",
  antartide: "#94a3b8",
};

const W = 1000;
const H = 620;

// collegamenti che "avvolgono" la mappa (i due territori sono ai lati opposti):
// invece di una linea diretta lunghissima, si disegnano due tratti verso il bordo esterno
const WRAP_EDGES = new Set(["alaska|kamchatka", "hawaii|usa_ovest"]);

interface Props {
  state: GameState;
  players: Player[];
  selectedFrom: string | null;
  validTargets: Set<string>;
  onTerritoryClick: (id: string) => void;
}

export default function Board({ state, players, selectedFrom, validTargets, onTerritoryClick }: Props) {
  const playerById = new Map(players.map((p) => [p.id, p]));

  const edgesDrawn = new Set<string>();
  const edges: [string, string][] = [];
  const wrapEdges: [string, string][] = [];
  for (const t of TERRITORIES) {
    for (const adj of t.adjacent) {
      const key = [t.id, adj].sort().join("|");
      if (edgesDrawn.has(key)) continue;
      edgesDrawn.add(key);
      if (WRAP_EDGES.has(key)) {
        wrapEdges.push([t.id, adj]);
      } else {
        edges.push([t.id, adj]);
      }
    }
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        {CONTINENTS.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: CONTINENT_COLORS[c.id],
                display: "inline-block",
              }}
            />
            {c.name} (+{c.bonus})
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "#0d1730", borderRadius: 12, border: "1px solid var(--border)" }}>
        {edges.map(([a, b]) => {
          const ta = TERRITORY_MAP[a];
          const tb = TERRITORY_MAP[b];
          return (
            <line
              key={`${a}-${b}`}
              x1={ta.x * W}
              y1={ta.y * H}
              x2={tb.x * W}
              y2={tb.y * H}
              stroke="#2a3a63"
              strokeWidth={1.5}
            />
          );
        })}
        {wrapEdges.flatMap(([a, b]) => {
          const ta = TERRITORY_MAP[a];
          const tb = TERRITORY_MAP[b];
          return [ta, tb].map((t) => (
            <line
              key={`wrap-${t.id}`}
              x1={t.x * W}
              y1={t.y * H}
              x2={t.x < 0.5 ? 0 : W}
              y2={t.y * H}
              stroke="#2a3a63"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ));
        })}
        {TERRITORIES.map((t) => {
          const ts = state.territories[t.id];
          if (!ts) return null;
          const owner = ts.owner ? playerById.get(ts.owner) : null;
          const isSelected = selectedFrom === t.id;
          const isValidTarget = validTargets.has(t.id);
          const cx = t.x * W;
          const cy = t.y * H;
          return (
            <g
              key={t.id}
              transform={`translate(${cx},${cy})`}
              onClick={() => onTerritoryClick(t.id)}
              style={{ cursor: "pointer" }}
            >
              <title>{t.name}</title>
              {isValidTarget && <circle r={20} fill="none" stroke="var(--accent)" strokeWidth={3} opacity={0.9} />}
              <circle r={16} fill={owner ? owner.color : "#555"} stroke={isSelected ? "#fff" : CONTINENT_COLORS[t.continent]} strokeWidth={isSelected ? 3 : 2} />
              <text textAnchor="middle" dy={4} fontSize={12} fontWeight={700} fill="#0a0f1c">
                {ts.armies}
              </text>
              <text textAnchor="middle" dy={30} fontSize={9} fill="var(--text-dim)">
                {t.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
