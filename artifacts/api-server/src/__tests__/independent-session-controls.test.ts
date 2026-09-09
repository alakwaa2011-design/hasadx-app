import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import {
  addPlayer,
  createGame,
  deleteGame,
  type GameQuestion,
} from "../game/manager";
import { coordinateFullGameSave, setupGameSocket } from "../game/socket-handlers";
import { trustedDetailedGameResults } from "../lib/wameeth-game-history";
import { finalizeWameethGameForReplay } from "../lib/wameeth-full-save";

type SocketEventHandler = (...args: any[]) => void;

class TestSocket {
  readonly request = {};
  readonly data: Record<string, unknown> = {};
  readonly join = vi.fn();
  readonly emit = vi.fn();
  private readonly handlers = new Map<string, SocketEventHandler>();

  constructor(readonly id: string) {}

  on(event: string, handler: SocketEventHandler): this {
    this.handlers.set(event, handler);
    return this;
  }

  trigger(event: string, ...args: any[]): unknown {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`No handler registered for ${event}`);
    return handler(...args);
  }
}

function makeSocketServer() {
  let onConnection: ((socket: TestSocket) => void) | undefined;
  const roomEmit = vi.fn();
  const io = {
    on: vi.fn((event: string, handler: (socket: TestSocket) => void) => {
      if (event === "connection") onConnection = handler;
      return io;
    }),
    to: vi.fn(() => ({ emit: roomEmit })),
  };

  setupGameSocket(io as unknown as Server);

  return {
    roomEmit,
    connect(socket: TestSocket) {
      if (!onConnection) throw new Error("Socket connection handler was not registered");
      onConnection(socket);
    },
  };
}

const createdPins: string[] = [];

function makeIndependentGame() {
  const questions = [
    {
      id: 1,
      text: "Question 1",
      questionType: "mcq",
      optionA: "A",
      optionB: "B",
      correctAnswer: "A",
    },
    {
      id: 2,
      text: "Question 2",
      questionType: "mcq",
      optionA: "A",
      optionB: "B",
      correctAnswer: "B",
    },
  ] as GameQuestion[];
  const game = createGame(1, "Direct game", "guest", 0, questions, 20, true, "solo");
  game.independentSession = true;
  game.independentControllerToken = "controller-token";
  createdPins.push(game.pin);
  return game;
}

afterEach(() => {
  while (createdPins.length) deleteGame(createdPins.pop()!);
});

describe("Independent Wameeth controls", () => {
  it("does not renew or clear a finished run while its final save is in flight",async()=>{
    const game=makeIndependentGame();
    const player=addPlayer(game.pin,"paused-player","Paused","🎯")!;
    player.score=44;
    game.state="finished";
    const oldRunId=game.gameRunId;
    let release!:(value:{id:number;replayed:boolean})=>void;
    const pending=finalizeWameethGameForReplay(game,()=>new Promise(resolve=>{release=resolve;}));
    await Promise.resolve();
    expect(game).toMatchObject({gameRunId:oldRunId,state:"finished"});
    expect(player.score).toBe(44);
    release({id:1,replayed:false});
    await pending;
    expect(game.gameRunId).not.toBe(oldRunId);
    expect(game.state).toBe("lobby");
    expect(player.score).toBe(0);
  });

  it("coordinates full saves per run rather than per reused PIN", async () => {
    let persists=0,accountIncrements=0;
    const run={gameRunId:`same-${Date.now()}`,pin:"123456"};
    const persist=async()=>{persists++; await Promise.resolve(); return {replayed:false};};
    const increment=async()=>{accountIncrements++;};
    await Promise.all([
      coordinateFullGameSave(run,persist,increment),
      coordinateFullGameSave(run,persist,increment),
    ]);
    expect({persists,accountIncrements}).toEqual({persists:1,accountIncrements:1});

    const other={gameRunId:`other-${Date.now()}`,pin:"123456"};
    await coordinateFullGameSave(other,async()=>({replayed:false}),increment);
    expect(accountIncrements).toBe(2);
    await coordinateFullGameSave({gameRunId:`replay-${Date.now()}`},async()=>({replayed:true}),increment);
    expect(accountIncrements).toBe(2);
  });

  it("protects trusted same-name reconnects from unauthenticated and different-account takeover", () => {
    const game=makeIndependentGame();
    const original=addPlayer(game.pin,"socket-1","Player","🎯",41,51)!;
    original.score=90;
    expect(addPlayer(game.pin,"spoof-1","Player","🎯",null,null)).toBeNull();
    expect(addPlayer(game.pin,"spoof-2","Player","🎯",42,52)).toBeNull();
    expect(game.players.get("socket-1")).toBe(original);
    const reconnected=addPlayer(game.pin,"socket-2","Player","🎯",41,51);
    expect(reconnected).toBe(original);
    expect(reconnected).toMatchObject({socketId:"socket-2",score:90,studentId:41,studentAccountId:51});
    const guest=addPlayer(game.pin,"guest-1","Guest","🦁",null,null)!;
    guest.score=70;
    expect(addPlayer(game.pin,"guest-takeover","Guest","🦁",61,71)).toBeNull();
    expect(game.players.get("guest-1")).toMatchObject({score:70,studentId:null,studentAccountId:null});
    expect(trustedDetailedGameResults(game).find(player=>player.name==="Guest")).not.toHaveProperty("studentId");
    const accountOnly=addPlayer(game.pin,"account-1","Account only","🐯",null,81)!;
    accountOnly.score=33;
    expect(addPlayer(game.pin,"account-guest","Account only","🐯",null,null)).toBeNull();
    expect(addPlayer(game.pin,"account-other","Account only","🐯",null,82)).toBeNull();
    expect(addPlayer(game.pin,"account-2","Account only","🐯",null,81)).toBe(accountOnly);
    expect(accountOnly).toMatchObject({socketId:"account-2",score:33,studentId:null,studentAccountId:81});
    expect(trustedDetailedGameResults(game).find(player=>player.name==="Account only")).not.toHaveProperty("studentId");
  });

  it("lets only the sole direct-session player pause, resume, and close without evidence when no play remains", async () => {
    const sockets = makeSocketServer();
    const player = new TestSocket("independent-player");
    const stranger = new TestSocket("stranger");
    sockets.connect(player);
    sockets.connect(stranger);

    const game = makeIndependentGame();
    addPlayer(game.pin, player.id, "Player", "🎯");
    game.independentPlayerSocketId = player.id;
    game.state = "question";
    game.currentQuestionIndex = 0;
    game.questionStartTime = Date.now();
    game.currentTimeoutId = setTimeout(() => {}, 20_000);

    const rejected = vi.fn();
    stranger.trigger("independent:pause-game", { pin: game.pin }, rejected);
    expect(rejected).toHaveBeenCalledWith({ error: "غير مصرح بالتحكم في هذه اللعبة" });
    expect(game.paused).toBe(false);

    const paused = vi.fn();
    player.trigger("independent:pause-game", { pin: game.pin }, paused);
    expect(paused).toHaveBeenCalledWith({ ok: true });
    expect(game.paused).toBe(true);
    expect(game.currentTimeoutId).toBeNull();
    expect(sockets.roomEmit).toHaveBeenCalledWith("game:paused", { state: "question" });

    const resumed = vi.fn();
    player.trigger("independent:resume-game", { pin: game.pin }, resumed);
    expect(resumed).toHaveBeenCalledWith({ ok: true });
    expect(game.paused).toBe(false);
    expect(game.currentTimeoutId).not.toBeNull();
    expect(sockets.roomEmit).toHaveBeenCalledWith(
      "game:resumed",
      expect.objectContaining({ state: "question" }),
    );

    game.state="lobby";
    game.currentQuestionIndex=-1;
    const ended = vi.fn();
    await player.trigger("independent:end-game", { pin: game.pin }, ended);
    expect(ended).toHaveBeenCalledWith({ ok: true,saved:false,reason:"no_play" });
    expect(game.state).toBe("finished");
    expect(sockets.roomEmit).toHaveBeenCalledWith(
      "game:finished",
      expect.objectContaining({ totalQuestions: 2 }),
    );
  });

  it("rejects controls when the server did not create an independent session", () => {
    const sockets = makeSocketServer();
    const player = new TestSocket("regular-player");
    sockets.connect(player);

    const game = makeIndependentGame();
    game.independentSession = false;
    addPlayer(game.pin, player.id, "Player", "🎯");

    const result = vi.fn();
    player.trigger("independent:pause-game", { pin: game.pin }, result);

    expect(result).toHaveBeenCalledWith({ error: "غير مصرح بالتحكم في هذه اللعبة" });
    expect(game.paused).toBe(false);
  });

  it("requires the per-session capability and prevents a name-based socket takeover", async () => {
    const sockets = makeSocketServer();
    const player = new TestSocket("authorized-player");
    const attacker = new TestSocket("attacker");
    sockets.connect(player);
    sockets.connect(attacker);
    const game = makeIndependentGame();

    const rejectedJoin = vi.fn();
    await attacker.trigger(
      "student:join-game",
      {
        pin: game.pin,
        name: "Player",
        avatar: "🎯",
        independentControlToken: "wrong-token",
      },
      rejectedJoin,
    );
    expect(rejectedJoin).toHaveBeenCalledWith({ error: "جلسة اللعب غير صالحة" });
    expect(game.players.size).toBe(0);

    const acceptedJoin = vi.fn();
    await player.trigger(
      "student:join-game",
      {
        pin: game.pin,
        name: "Player",
        avatar: "🎯",
        independentControlToken: "controller-token",
      },
      acceptedJoin,
    );
    expect(acceptedJoin).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(game.players.size).toBe(1);
    expect(game.independentPlayerSocketId).toBe(player.id);

    const takeover = vi.fn();
    await attacker.trigger(
      "student:join-game",
      {
        pin: game.pin,
        name: "Player",
        avatar: "🎯",
        independentControlToken: "wrong-token",
      },
      takeover,
    );
    expect(takeover).toHaveBeenCalledWith({ error: "جلسة اللعب غير صالحة" });
    expect(game.players.has(player.id)).toBe(true);
    expect(game.players.has(attacker.id)).toBe(false);
    expect(game.independentPlayerSocketId).toBe(player.id);
  });

  it("preserves an authenticated account when no teacher roster identity is available",async()=>{
    const sockets=makeSocketServer();
    const first=new TestSocket("account-only-first");
    const sameAccount=new TestSocket("account-only-second");
    const guest=new TestSocket("account-only-guest");
    (first.request as any).session={studentAccountId:81};
    (sameAccount.request as any).session={studentAccountId:81};
    sockets.connect(first);
    sockets.connect(sameAccount);
    sockets.connect(guest);
    const game=makeIndependentGame();
    const data={pin:game.pin,name:"Account Player",avatar:"🐯",independentControlToken:"controller-token"};
    const joined=vi.fn();
    await first.trigger("student:join-game",data,joined);
    expect(joined).toHaveBeenCalledWith(expect.objectContaining({success:true}));
    expect(game.players.get(first.id)).toMatchObject({studentId:null,studentAccountId:81});
    const rejected=vi.fn();
    await guest.trigger("student:join-game",data,rejected);
    expect(rejected).toHaveBeenCalledWith({error:"لا يمكن استعادة هذا اللاعب بحساب طالب مختلف"});
    const rejoined=vi.fn();
    await sameAccount.trigger("student:join-game",data,rejoined);
    expect(rejoined).toHaveBeenCalledWith(expect.objectContaining({success:true}));
    expect(game.players.get(sameAccount.id)).toMatchObject({studentId:null,studentAccountId:81});
  });

  it("resumes the server timeout with only the time that remained at pause", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
      const sockets = makeSocketServer();
      const player = new TestSocket("timed-player");
      sockets.connect(player);
      const game = makeIndependentGame();
      addPlayer(game.pin, player.id, "Player", "🎯");
      game.independentPlayerSocketId = player.id;
      game.autoAdvance = false;
      game.state = "question";
      game.currentQuestionIndex = 0;
      game.questionStartTime = Date.now() - 8_000;
      game.currentTimeoutId = setTimeout(() => {}, 12_000);

      player.trigger("independent:pause-game", { pin: game.pin }, vi.fn());
      expect(game.pausedQuestionRemainingMs).toBe(12_000);

      vi.advanceTimersByTime(5_000);
      player.trigger("independent:resume-game", { pin: game.pin }, vi.fn());
      expect(sockets.roomEmit).toHaveBeenCalledWith(
        "game:resumed",
        expect.objectContaining({ state: "question", remainingMs: 12_000 }),
      );

      vi.advanceTimersByTime(11_999);
      expect(game.state).toBe("question");
      vi.advanceTimersByTime(2);
      expect(game.state).not.toBe("question");
    } finally {
      vi.useRealTimers();
    }
  });
});