import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

interface AudienceTeam {
  id: string;
  name: string;
  color: string;
  emoji: string;
  score: number;
}

interface AudienceActiveQuestion {
  questionText: string;
  difficulty: number;
  subCategoryName: string;
}

interface ShuraVotes {
  a: number;
  b: number;
}

interface StoredSession {
  tournamentName: string;
  teams: AudienceTeam[];
  currentTurn: string;
  activeQuestion: AudienceActiveQuestion | null;
  ended: boolean;
  shuraActive: boolean;
  shuraVotes: ShuraVotes;
  /** Unique identifier for the current shura round; increments each time shura activates. */
  shuraRoundId: string;
  writeSecret: string;
  updatedAt: number;
}

const sessions = new Map<string, StoredSession>();
const TTL_MS = 10 * 60 * 1000;

function evictExpired() {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.updatedAt > TTL_MS) sessions.delete(code);
  }
}

const TeamSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  color: z.string().max(30),
  emoji: z.string().max(8),
  score: z.number().int(),
});

const ActiveQuestionSchema = z.object({
  questionText: z.string().max(500),
  difficulty: z.number().int().refine(v => [200, 400, 600, 800].includes(v)),
  subCategoryName: z.string().max(80),
});

const SessionBody = z.object({
  writeSecret: z.string().min(1).max(80),
  tournamentName: z.string().max(120),
  teams: z.array(TeamSchema).max(8),
  currentTurn: z.string().max(40),
  activeQuestion: ActiveQuestionSchema.nullable(),
  ended: z.boolean().optional().default(false),
  shuraActive: z.boolean().optional().default(false),
});

const VoteBody = z.object({
  choice: z.enum(["a", "b"]),
});

router.put("/arena/session/:code", (req, res) => {
  try {
    const code = req.params.code?.toUpperCase().slice(0, 12);
    if (!code) return res.status(400).json({ error: "Missing code" });

    const body = SessionBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid body" });

    evictExpired();

    const existing = sessions.get(code);
    if (existing && existing.writeSecret !== body.data.writeSecret) {
      return res.status(403).json({ error: "Wrong write secret" });
    }

    const { writeSecret, ...publicData } = body.data;
    const shuraActive = publicData.shuraActive ?? false;
    const ended = publicData.ended ?? false;

    // Auto-reset votes and generate a new round ID when shura transitions from inactive to active
    const prevShuraActive = existing?.shuraActive ?? false;
    const shuraTransitioned = shuraActive && !prevShuraActive;
    const shuraVotes: ShuraVotes = shuraTransitioned
      ? { a: 0, b: 0 }
      : (existing?.shuraVotes ?? { a: 0, b: 0 });
    const shuraRoundId: string = shuraTransitioned
      ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : (existing?.shuraRoundId ?? "");

    sessions.set(code, {
      ...publicData,
      shuraActive,
      shuraVotes,
      shuraRoundId,
      ended,
      writeSecret,
      updatedAt: Date.now(),
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "arena session put");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/arena/session/:code/vote", (req, res) => {
  try {
    const code = req.params.code?.toUpperCase().slice(0, 12);
    if (!code) return res.status(400).json({ error: "Missing code" });

    const body = VoteBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid body" });

    evictExpired();
    const session = sessions.get(code);
    if (!session) return res.status(404).json({ error: "Session not found or expired" });
    if (!session.shuraActive) return res.status(409).json({ error: "Shura voting is not active" });

    const { choice } = body.data;
    session.shuraVotes = {
      a: session.shuraVotes.a + (choice === "a" ? 1 : 0),
      b: session.shuraVotes.b + (choice === "b" ? 1 : 0),
    };
    session.updatedAt = Date.now();

    res.json({ ok: true, shuraVotes: session.shuraVotes });
  } catch (err) {
    req.log.error({ err }, "arena session vote");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/arena/session/:code", (req, res) => {
  try {
    const code = req.params.code?.toUpperCase().slice(0, 12);
    if (!code) return res.status(400).json({ error: "Missing code" });

    evictExpired();
    const session = sessions.get(code);
    if (!session) return res.status(404).json({ error: "Session not found or expired" });

    const { writeSecret: _secret, ...publicData } = session;
    res.json(publicData);
  } catch (err) {
    req.log.error({ err }, "arena session get");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
