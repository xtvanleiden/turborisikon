"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socketClient";
import { TERRITORY_MAP } from "@/lib/game/board";
import { maxArmiesPurchasable } from "@/lib/game/economy";
import { maxAttackerDice, maxDefenderDice } from "@/lib/game/combat";
import { currentPlayerId } from "@/lib/game/engine";
import { personalityById } from "@/lib/game/personalities";
import { GameState, Player } from "@/lib/game/types";
import Board from "@/components/Board";

interface RoomPlayer extends Player {
  connected: boolean;
}

interface RoomInfo {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  status: "lobby" | "playing" | "finished";
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = (params.roomId as string).toUpperCase();

  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [nameInput, setNameInput] = useState("");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [placeCount, setPlaceCount] = useState(1);
  const [buyCount, setBuyCount] = useState(0);
  const [diceCount, setDiceCount] = useState(3);
  const [moveCount, setMoveCount] = useState(1);
  const [conquerCount, setConquerCount] = useState(1);

  useEffect(() => {
    const socket = getSocket();
    const raw = localStorage.getItem(`risikon:${roomId}`);
    if (raw) {
      const saved = JSON.parse(raw);
      socket.emit("room:rejoin", { roomId, playerId: saved.playerId }, (res: any) => {
        if (res.ok) {
          setMyId(res.playerId);
          setMyName(saved.name);
        }
      });
    }

    function onRoomState(r: RoomInfo) {
      setRoom(r);
    }
    function onGameState(g: GameState) {
      setGame(g);
    }
    socket.on("room:state", onRoomState);
    socket.on("game:state", onGameState);
    return () => {
      socket.off("room:state", onRoomState);
      socket.off("game:state", onGameState);
    };
  }, [roomId]);

  function joinExisting() {
    if (!nameInput.trim()) return;
    const socket = getSocket();
    socket.emit("room:join", { roomId, name: nameInput.trim() }, (res: any) => {
      if (!res.ok) return setError(res.error);
      localStorage.setItem(`risikon:${roomId}`, JSON.stringify({ playerId: res.playerId, name: nameInput.trim() }));
      setMyId(res.playerId);
      setMyName(nameInput.trim());
    });
  }

  function addAi() {
    const socket = getSocket();
    socket.emit("room:addAi", { roomId, playerId: myId });
  }

  function removePlayer(targetId: string) {
    const socket = getSocket();
    socket.emit("room:removePlayer", { roomId, playerId: myId, targetId });
  }

  function startGame() {
    const socket = getSocket();
    socket.emit("room:start", { roomId, playerId: myId }, (res: any) => {
      if (!res.ok) setError(res.error);
    });
  }

  function dispatch(action: any) {
    const socket = getSocket();
    setError(null);
    socket.emit("game:action", { roomId, action }, (res: any) => {
      if (!res.ok) setError(res.error);
    });
  }

  const me = room?.players.find((p) => p.id === myId) ?? null;
  const isMyTurn = Boolean(
    game && game.status === "playing" && currentPlayerId(game) === myId
  );
  const currentPlayer = game ? game.players.find((p) => p.id === currentPlayerId(game)) : null;

  const validTargets = useMemo(() => {
    const set = new Set<string>();
    if (!game || !myId) return set;
    if ((game.phase === "reinforce" || game.phase === "setup") && !selectedFrom) {
      for (const [id, t] of Object.entries(game.territories)) {
        if (t.owner === myId) set.add(id);
      }
      return set;
    }
    if (game.phase === "attack" && !selectedFrom) {
      for (const [id, t] of Object.entries(game.territories)) {
        if (t.owner === myId && t.armies >= 2) set.add(id);
      }
      return set;
    }
    if (game.phase === "attack" && selectedFrom) {
      const territory = TERRITORY_MAP[selectedFrom];
      for (const adj of territory.adjacent) {
        const t = game.territories[adj];
        if (t.owner && t.owner !== myId) set.add(adj);
      }
      return set;
    }
    if (game.phase === "fortify" && !selectedFrom) {
      for (const [id, t] of Object.entries(game.territories)) {
        if (t.owner === myId && t.armies >= 2) set.add(id);
      }
      return set;
    }
    if (game.phase === "fortify" && selectedFrom) {
      for (const [id, t] of Object.entries(game.territories)) {
        if (id !== selectedFrom && t.owner === myId) set.add(id);
      }
      return set;
    }
    return set;
  }, [game, myId, selectedFrom]);

  function onTerritoryClick(id: string) {
    if (!game || !isMyTurn) return;
    const t = game.territories[id];

    if (game.phase === "reinforce") {
      if (t.owner !== myId) return;
      const player = game.players.find((p) => p.id === myId)!;
      const count = Math.min(placeCount, player.reserve);
      if (count <= 0) return;
      dispatch({ type: "PLACE_ARMIES", playerId: myId, territoryId: id, count });
      return;
    }

    if (game.phase === "setup") {
      if (t.owner !== myId) return;
      const player = game.players.find((p) => p.id === myId)!;
      const remaining = 3 - game.setupPlacedThisTurn;
      const count = Math.min(placeCount, player.reserve, remaining);
      if (count <= 0) return;
      dispatch({ type: "PLACE_ARMIES", playerId: myId, territoryId: id, count });
      return;
    }

    if (game.phase === "attack") {
      if (!selectedFrom) {
        if (t.owner === myId && t.armies >= 2) setSelectedFrom(id);
        return;
      }
      if (id === selectedFrom) {
        setSelectedFrom(null);
        return;
      }
      if (validTargets.has(id)) {
        setSelectedTo(id);
      } else if (t.owner === myId && t.armies >= 2) {
        setSelectedFrom(id);
        setSelectedTo(null);
      }
      return;
    }

    if (game.phase === "fortify") {
      if (!selectedFrom) {
        if (t.owner === myId && t.armies >= 2) setSelectedFrom(id);
        return;
      }
      if (id === selectedFrom) {
        setSelectedFrom(null);
        return;
      }
      if (t.owner === myId) {
        setSelectedTo(id);
      }
      return;
    }
  }

  useEffect(() => {
    setSelectedFrom(null);
    setSelectedTo(null);
  }, [game?.phase, game?.currentPlayerIndex]);

  useEffect(() => {
    if (game?.phase === "conquer" && game.pendingConquest) {
      setConquerCount(game.pendingConquest.min);
    }
  }, [game?.phase, game?.pendingConquest?.to]);

  if (!myId) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ width: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Entra nella stanza {roomId}</h2>
          <input
            className="input"
            placeholder="Il tuo nome"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button className="btn btn-primary" onClick={joinExisting}>
            Entra
          </button>
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Connessione alla stanza...</p>
      </main>
    );
  }

  if (room.status === "lobby") {
    const isHost = room.hostId === myId;
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ width: 480, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Sala d&apos;attesa</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Codice stanza: <strong style={{ color: "var(--accent)", letterSpacing: 2 }}>{roomId}</strong> — condividilo con
              gli amici.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {room.players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--panel-2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color }} />
                <span
                  style={{ flex: 1 }}
                  title={p.kind === "ai" ? personalityById(p.personalityId).tagline : undefined}
                >
                  {p.name} {p.id === room.hostId && <span style={{ color: "var(--accent)" }}>(host)</span>}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {p.kind === "ai" ? "IA" : p.connected ? "online" : "offline"}
                </span>
                {isHost && p.id !== room.hostId && (
                  <button className="btn btn-danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => removePlayer(p.id)}>
                    Rimuovi
                  </button>
                )}
              </div>
            ))}
          </div>

          {isHost && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={addAi} disabled={room.players.length >= 6}>
                + Aggiungi IA
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={startGame}
                disabled={room.players.length < 2}
              >
                Avvia partita ({room.players.length}/6)
              </button>
            </div>
          )}
          {!isHost && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>In attesa che l&apos;host avvii la partita...</p>}
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Caricamento partita...</p>
      </main>
    );
  }

  const myPlayer = game.players.find((p) => p.id === myId);
  const fromArmies = selectedFrom ? game.territories[selectedFrom].armies : 0;
  const toArmies = selectedTo ? game.territories[selectedTo].armies : 0;
  const maxDice = Math.min(maxAttackerDice(fromArmies), 3);

  return (
    <main style={{ minHeight: "100vh", padding: 20, display: "flex", gap: 20, maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Board
          state={game}
          players={game.players}
          selectedFrom={selectedFrom}
          validTargets={validTargets}
          onTerritoryClick={onTerritoryClick}
        />
      </div>

      <aside style={{ width: 340, display: "flex", flexDirection: "column", gap: 14, flexShrink: 0 }}>
        {game.status === "finished" && (
          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <h3 style={{ margin: 0 }}>Partita conclusa</h3>
            <p>
              Vincitore:{" "}
              <strong style={{ color: "var(--accent)" }}>
                {game.players.find((p) => p.id === game.winnerId)?.name}
              </strong>
            </p>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 15 }}>Giocatori</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {game.players.map((p) => {
              const territoryCount = Object.values(game.territories).filter((t) => t.owner === p.id).length;
              const isTurn = currentPlayer?.id === p.id;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: isTurn ? "var(--panel-2)" : "transparent",
                    opacity: p.alive ? 1 : 0.4,
                    fontSize: 13,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
                  <span
                    style={{ flex: 1 }}
                    title={p.kind === "ai" ? personalityById(p.personalityId).tagline : undefined}
                  >
                    {p.name} {isTurn && "▶"}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>{territoryCount} terr.</span>
                  <span style={{ color: "var(--accent)" }}>{p.currency}R</span>
                  <span style={{ color: "var(--ok)" }}>res:{p.reserve}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 15 }}>
            Fase: {phaseLabel(game.phase)} — Turno {game.turn}
          </h3>
          {!isMyTurn && (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              In attesa di <strong>{currentPlayer?.name}</strong>...
            </p>
          )}

          {isMyTurn && game.phase === "setup" && myPlayer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
                Piazzamento iniziale — Riserva: <strong style={{ color: "var(--ok)" }}>{myPlayer.reserve}</strong>{" "}
                armate. Puoi piazzarne ancora{" "}
                <strong style={{ color: "var(--accent)" }}>
                  {Math.min(3 - game.setupPlacedThisTurn, myPlayer.reserve)}
                </strong>{" "}
                in questo turno.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Quantità da piazzare:</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={Math.max(1, Math.min(3 - game.setupPlacedThisTurn, myPlayer.reserve))}
                  value={placeCount}
                  onChange={(e) => setPlaceCount(Number(e.target.value))}
                  style={{ width: 70 }}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                Clicca un tuo territorio sulla mappa per piazzare la quantità indicata. Ogni giocatore piazza al
                massimo 3 armate a turno, in ordine inverso rispetto all&apos;ordine di gioco, finché tutte le
                riserve non sono esaurite.
              </p>
            </div>
          )}

          {isMyTurn && game.phase === "conquer" && game.pendingConquest && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, margin: 0 }}>
                Territorio conquistato:{" "}
                <strong style={{ color: "var(--accent)" }}>{TERRITORY_MAP[game.pendingConquest.to].name}</strong>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                Devi spostare almeno <strong>{game.pendingConquest.min}</strong> armate (tante quante i dadi
                dell&apos;ultimo lancio vincente). Puoi spostarne fino a{" "}
                <strong>{game.pendingConquest.max}</strong>, lasciando almeno 1 armata nel territorio di partenza.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="input"
                  type="number"
                  min={game.pendingConquest.min}
                  max={game.pendingConquest.max}
                  value={conquerCount}
                  onChange={(e) => setConquerCount(Number(e.target.value))}
                  style={{ width: 70 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    dispatch({
                      type: "MOVE_IN_ARMIES",
                      playerId: myId,
                      count: Math.min(
                        game.pendingConquest!.max,
                        Math.max(game.pendingConquest!.min, conquerCount)
                      ),
                    })
                  }
                >
                  Conferma spostamento
                </button>
              </div>
            </div>
          )}

          {isMyTurn && game.phase === "reinforce" && myPlayer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
                Riserva: <strong style={{ color: "var(--ok)" }}>{myPlayer.reserve}</strong> armate — Risikon:{" "}
                <strong style={{ color: "var(--accent)" }}>{myPlayer.currency}R</strong>
              </p>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={maxArmiesPurchasable(myPlayer.currency, game.settings.armyCostR)}
                  value={buyCount}
                  onChange={(e) => setBuyCount(Number(e.target.value))}
                  style={{ width: 70 }}
                />
                <button
                  className="btn"
                  onClick={() => dispatch({ type: "BUY_ARMIES", playerId: myId, count: buyCount })}
                  disabled={buyCount <= 0}
                >
                  Compra armate ({game.settings.armyCostR}R cad.)
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Quantità da piazzare:</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={Math.max(1, myPlayer.reserve)}
                  value={placeCount}
                  onChange={(e) => setPlaceCount(Number(e.target.value))}
                  style={{ width: 70 }}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                Clicca un tuo territorio sulla mappa per piazzare la quantità indicata. Non sei obbligato a
                piazzare tutta la riserva: ciò che resta si porta al turno successivo.
              </p>

              <button className="btn btn-primary" onClick={() => dispatch({ type: "END_REINFORCE", playerId: myId })}>
                Fine rinforzi
              </button>
            </div>
          )}

          {isMyTurn && game.phase === "attack" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                Seleziona un tuo territorio con almeno 2 armate, poi un territorio nemico adiacente (evidenziato in
                giallo).
              </p>
              {selectedFrom && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Da <strong>{TERRITORY_MAP[selectedFrom].name}</strong> ({fromArmies} armate)
                  {selectedTo && (
                    <>
                      {" "}
                      → <strong>{TERRITORY_MAP[selectedTo].name}</strong> ({toArmies} armate, difende con{" "}
                      {maxDefenderDice(toArmies)} dadi)
                    </>
                  )}
                </p>
              )}
              {selectedFrom && selectedTo && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>Dadi:</span>
                  {[1, 2, 3].map((d) => (
                    <button
                      key={d}
                      className="btn"
                      style={{
                        padding: "6px 10px",
                        background: diceCount === d ? "var(--accent)" : undefined,
                        color: diceCount === d ? "#1a1200" : undefined,
                      }}
                      disabled={d > maxDice}
                      onClick={() => setDiceCount(d)}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    className="btn btn-danger"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      dispatch({
                        type: "ATTACK",
                        playerId: myId,
                        from: selectedFrom,
                        to: selectedTo,
                        dice: Math.min(diceCount, maxDice),
                      });
                      setSelectedTo(null);
                    }}
                  >
                    Attacca!
                  </button>
                </div>
              )}
              {game.lastBattle && (
                <BattleResult battle={game.lastBattle} players={game.players} />
              )}
              <button className="btn btn-primary" onClick={() => dispatch({ type: "END_ATTACK", playerId: myId })}>
                Fine attacchi
              </button>
            </div>
          )}

          {isMyTurn && game.phase === "fortify" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                Sposta armate tra due tuoi territori collegati da una catena di territori tuoi. Un solo movimento
                per turno.
              </p>
              {selectedFrom && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Da <strong>{TERRITORY_MAP[selectedFrom].name}</strong> ({fromArmies} armate)
                  {selectedTo && (
                    <>
                      {" "}
                      → <strong>{TERRITORY_MAP[selectedTo].name}</strong>
                    </>
                  )}
                </p>
              )}
              {selectedFrom && selectedTo && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={Math.max(1, fromArmies - 1)}
                    value={moveCount}
                    onChange={(e) => setMoveCount(Number(e.target.value))}
                    style={{ width: 70 }}
                  />
                  <button
                    className="btn"
                    onClick={() => {
                      dispatch({
                        type: "FORTIFY",
                        playerId: myId,
                        from: selectedFrom,
                        to: selectedTo,
                        count: moveCount,
                      });
                      setSelectedFrom(null);
                      setSelectedTo(null);
                    }}
                  >
                    Sposta
                  </button>
                </div>
              )}
              <button className="btn btn-primary" onClick={() => dispatch({ type: "END_FORTIFY", playerId: myId })}>
                Fine turno
              </button>
            </div>
          )}

          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>

        <div className="card" style={{ flex: 1, overflowY: "auto", maxHeight: 260 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Registro</h3>
          <div style={{ display: "flex", flexDirection: "column-reverse", gap: 4 }}>
            {[...game.log]
              .slice(-40)
              .reverse()
              .map((entry) => (
                <div key={entry.id} style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {entry.message}
                </div>
              ))}
          </div>
        </div>
      </aside>
    </main>
  );
}

function phaseLabel(phase: GameState["phase"]) {
  switch (phase) {
    case "setup":
      return "Piazzamento iniziale";
    case "reinforce":
      return "Rinforzo";
    case "attack":
      return "Attacco";
    case "conquer":
      return "Conquista";
    case "fortify":
      return "Spostamento";
    case "gameover":
      return "Fine partita";
    default:
      return phase;
  }
}

function BattleResult({ battle, players }: { battle: NonNullable<GameState["lastBattle"]>; players: Player[] }) {
  const attacker = players.find((p) => p.id === battle.attackerId);
  const defender = players.find((p) => p.id === battle.defenderId);
  return (
    <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: 10, fontSize: 12 }}>
      <div>
        <strong style={{ color: attacker?.color }}>{attacker?.name}</strong> [{battle.attackerDice.join(", ")}] vs{" "}
        <strong style={{ color: defender?.color }}>{defender?.name}</strong> [{battle.defenderDice.join(", ")}]
      </div>
      <div style={{ color: "var(--text-dim)", marginTop: 4 }}>
        Perdite attaccante: {battle.attackerLosses} — Perdite difensore: {battle.defenderLosses}
        {battle.conquered && <span style={{ color: "var(--accent)" }}> — Territorio conquistato!</span>}
      </div>
    </div>
  );
}
