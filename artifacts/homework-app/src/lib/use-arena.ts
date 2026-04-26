import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";

export interface ArenaOpponent {
  name: string;
  score: number;
  finished: boolean;
  isBot: boolean;
}

export interface ArenaState {
  isArenaMode: boolean;
  arenaPin: string;
  myName: string;
  opponents: ArenaOpponent[];
  results: Array<{ rank: number; name: string; score: number; isBot: boolean }> | null;
  updateScore: (score: number) => void;
  finishArena: (finalScore: number) => void;
  leaveArena: () => void;
}

type PlayerData = { name: string; score: number; finished: boolean; isBot: boolean };

function buildOpponents(players: PlayerData[], myName: string): ArenaOpponent[] {
  return players
    .filter(p => p.name !== myName)
    .map(p => ({ name: p.name, score: p.score, finished: p.finished, isBot: p.isBot ?? false }));
}

export function useArena(_gameId: string): ArenaState {
  const params = new URLSearchParams(window.location.search);
  const arenaPin = params.get("arena") || "";
  const myName = params.get("arenaName") || "لاعب";

  const [opponents, setOpponents] = useState<ArenaOpponent[]>([]);
  const [results, setResults] = useState<Array<{ rank: number; name: string; score: number; isBot: boolean }> | null>(null);

  const lastScoreRef = useRef(-1);
  const joinedRef = useRef(false);

  const isArenaMode = !!arenaPin;

  useEffect(() => {
    if (!isArenaMode || joinedRef.current) return;
    joinedRef.current = true;

    const socket = getSocket();

    socket.emit("arena:join", { pin: arenaPin, playerName: myName }, (res: { success?: boolean; players?: PlayerData[]; error?: string }) => {
      if (res?.error) {
        console.warn("Arena join error:", res.error);
        return;
      }
      if (res?.players) {
        setOpponents(buildOpponents(res.players, myName));
      }
    });

    socket.on("arena:opponent_update", (data: { name: string; score: number; isBot: boolean }) => {
      setOpponents(prev => {
        const exists = prev.find(p => p.name === data.name);
        if (exists) {
          return prev.map(p => p.name === data.name
            ? { ...p, score: data.score, isBot: data.isBot ?? false }
            : p
          );
        }
        return [...prev, { name: data.name, score: data.score, finished: false, isBot: data.isBot ?? false }];
      });
    });

    socket.on("arena:opponent_finished", (data: { name: string; score: number; isBot: boolean }) => {
      setOpponents(prev => {
        const exists = prev.find(p => p.name === data.name);
        if (exists) {
          return prev.map(p => p.name === data.name
            ? { ...p, score: data.score, finished: true, isBot: data.isBot ?? false }
            : p
          );
        }
        return [...prev, { name: data.name, score: data.score, finished: true, isBot: data.isBot ?? false }];
      });
    });

    socket.on("arena:game_start", (data: { players?: PlayerData[] }) => {
      if (data.players) {
        setOpponents(buildOpponents(data.players, myName));
      }
    });

    socket.on("arena:player_joined", (data: { players?: PlayerData[] }) => {
      if (data.players) {
        setOpponents(buildOpponents(data.players, myName));
      }
    });

    socket.on("arena:results", (data: { rankings: Array<{ rank: number; name: string; score: number; isBot: boolean }> }) => {
      setResults(data.rankings);
    });

    return () => {
      socket.off("arena:opponent_update");
      socket.off("arena:opponent_finished");
      socket.off("arena:game_start");
      socket.off("arena:player_joined");
      socket.off("arena:results");
    };
  }, [isArenaMode, arenaPin, myName]);

  const updateScore = useCallback((score: number) => {
    if (!isArenaMode) return;
    if (score === lastScoreRef.current) return;
    lastScoreRef.current = score;
    getSocket().emit("arena:score", { score });
  }, [isArenaMode]);

  const finishArena = useCallback((finalScore: number) => {
    if (!isArenaMode) return;
    getSocket().emit("arena:finish", { finalScore });
  }, [isArenaMode]);

  const leaveArena = useCallback(() => {
    if (!isArenaMode) return;
    getSocket().emit("arena:leave", {});
    joinedRef.current = false;
  }, [isArenaMode]);

  return {
    isArenaMode,
    arenaPin,
    myName,
    opponents,
    results,
    updateScore,
    finishArena,
    leaveArena,
  };
}
