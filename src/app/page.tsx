"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSocket } from "@/lib/socketClient";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function saveIdentity(roomId: string, playerId: string) {
    localStorage.setItem(`risikon:${roomId}`, JSON.stringify({ playerId, name }));
  }

  function createRoom() {
    if (!name.trim()) return setError("Inserisci un nome");
    setError(null);
    setLoading(true);
    const socket = getSocket();
    socket.emit("room:create", { name: name.trim() }, (res: any) => {
      setLoading(false);
      if (!res.ok) return setError(res.error || "Errore");
      saveIdentity(res.roomId, res.playerId);
      router.push(`/room/${res.roomId}`);
    });
  }

  function joinRoom() {
    if (!name.trim()) return setError("Inserisci un nome");
    if (!joinCode.trim()) return setError("Inserisci il codice stanza");
    setError(null);
    setLoading(true);
    const socket = getSocket();
    socket.emit(
      "room:join",
      { roomId: joinCode.trim().toUpperCase(), name: name.trim() },
      (res: any) => {
        setLoading(false);
        if (!res.ok) return setError(res.error || "Errore");
        saveIdentity(res.roomId, res.playerId);
        router.push(`/room/${res.roomId}`);
      }
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 420, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, letterSpacing: 1 }}>
            RISIKO<span style={{ color: "var(--accent)" }}>N</span>
          </h1>
          <p style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 14 }}>
            Risiko con regole italiane (3 dadi in difesa), economia in Risikon (R) e riserva di
            armate. Gioca online con amici o contro l&apos;IA.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 13, color: "var(--text-dim)" }}>Il tuo nome</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Napoleone"
            maxLength={20}
          />
        </div>

        <button className="btn btn-primary" onClick={createRoom} disabled={loading}>
          Crea nuova partita
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-dim)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          oppure
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, textTransform: "uppercase" }}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Codice stanza"
            maxLength={5}
          />
          <button className="btn" onClick={joinRoom} disabled={loading}>
            Unisciti
          </button>
        </div>

        {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
      </div>
    </main>
  );
}
