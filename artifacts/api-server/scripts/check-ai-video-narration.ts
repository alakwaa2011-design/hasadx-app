/**
 * Opt-in live text/audio check. Uses billed AI calls, never fal motion or the DB.
 * Run: pnpm exec tsx scripts/check-ai-video-narration.ts --live-audio
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openai } from "@workspace/integrations-openai-ai-server";
import { openai as audioClient } from "../../../lib/integrations-openai-ai-server/src/audio/client";
import { storyboardPrompt } from "../src/lib/ai-video-storyboard-prompt";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { aiVideoBriefSchema, sanitizeStoryboard, type AiVideoStoryboard } from "../src/lib/ai-video-schemas";
import { prepareAiVideoNarration, reflowNarration } from "../src/lib/ai-video-narration-preflight";
import { fitAiVideoNarration, probeAudioSeconds } from "../src/lib/ai-video-timing";

if (!process.argv.includes("--live-audio")) {
  throw new Error("Opt-in required: --live-audio uses billed text/audio requests; no video generation.");
}

const dir = await mkdtemp(join(tmpdir(), "hasaad-duration-live-check-"));
const deadline = Date.now() + 360_000;
const calls = { text: 0, audio: 0 };
const trace: unknown[] = [];
// Audio uses a separate SDK client: both must be bounded and observed.
for (const client of [openai, audioClient]) {
  const create = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = (async (body: { model: string; messages: unknown[] }, opts: Record<string, unknown> = {}) => {
    const kind = body.model === "gpt-audio" ? "audio" : "text";
    if ((calls.text >= 3 && kind === "text") || (calls.audio >= 10 && kind === "audio") || Date.now() > deadline) {
      throw new Error("Live verification call/time budget reached");
    }
    calls[kind] += 1;
    console.log(JSON.stringify({ event: "provider_call", kind, count: calls[kind] }));
    const response = await create(body as Parameters<typeof create>[0], {
      ...opts, timeout: Math.min(90_000, deadline - Date.now()), maxRetries: 0,
    }) as Awaited<ReturnType<typeof client.chat.completions.create>> & {
      choices?: { message: { content?: string; audio?: { transcript?: string } } }[];
    };
    // This script uses a fixed public demo topic, never teacher project content.
    trace.push({
      kind, request: body.messages,
      text: response.choices?.[0]?.message.content,
      transcript: response.choices?.[0]?.message.audio?.transcript,
    });
    await writeFile(join(dir, "trace.json"), JSON.stringify(trace, null, 2));
    return response;
  }) as typeof client.chat.completions.create;
}

const brief = aiVideoBriefSchema.parse({
  title: "دورة الماء",
  topic: "شرح مبسط لدورة الماء: التبخر ثم التكاثف والمطر وعودة الماء إلى الأنهار.",
  language: "ar", durationSeconds: 30, aspectRatio: "16:9",
  visualStyle: "educational", voice: "nova", music: false, captions: true,
  prompt: "", sourceImages: [], idempotencyKey: "duration-live-check",
});

try {
  let initial: unknown;
  const cachedAudio = new Map<string, Buffer>();
  const replayDir = process.argv.find(arg => arg.startsWith("--replay="))?.slice("--replay=".length);
  if (replayDir) {
    // Reuse a completed measured batch from this fixed demo, not a teacher project.
    const prior = JSON.parse(await readFile(join(replayDir, "trace.json"), "utf8")) as {
      kind: string; text?: string; request?: { content: string }[];
    }[];
    const lastAudioIndex = prior.findLastIndex(item => item.kind === "audio");
    const lastPlanIndex = prior.findLastIndex((item, index) => item.kind === "text" && index < lastAudioIndex);
    const plan = JSON.parse(prior[lastPlanIndex]?.text ?? "") as AiVideoStoryboard;
    const spoken = new Set(prior.slice(lastPlanIndex + 1, lastAudioIndex + 1)
      .filter(item => item.kind === "audio")
      .map(item => item.request?.at(-1)?.content.replace(/^Repeat the following text verbatim: /, "")));
    if (plan.scenes.length !== 5 || plan.scenes.some(scene => !spoken.has(scene.narration))) {
      throw new Error("Replay requires a completely recorded five-scene demo batch");
    }
    for (const [index, scene] of plan.scenes.entries()) {
      cachedAudio.set(scene.narration, await readFile(join(replayDir, `audio-${index}.wav`)));
    }
    initial = {
      title: brief.title, version: 1,
      scenes: plan.scenes.map(scene => ({
        id: scene.id, objective: scene.objective, narration: scene.narration,
        onScreenText: scene.onScreenText, visualPrompt: scene.visualPrompt,
        durationSeconds: 6, transition: "dissolve", sourceImage: null,
      })),
    };
  } else {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini", reasoning_effort: "minimal", max_completion_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You create safe educational video storyboards. Return JSON only." },
        { role: "user", content: storyboardPrompt(brief) },
      ],
    });
    initial = JSON.parse(response.choices[0]!.message.content ?? "");
  }
  const storyboard = sanitizeStoryboard(
    initial, brief, { expectedSceneCount: 5 },
  );
  console.log(JSON.stringify({
    event: "initial_storyboard",
    scenes: storyboard.scenes.map(scene => ({
      id: scene.id, words: scene.narration.split(/\s+/).length, seconds: scene.durationSeconds,
    })),
  }));
  const result = await prepareAiVideoNarration({
    brief, storyboard, dir, deadline, voice: "nova",
    assertActive: async () => {
      if (Date.now() > deadline) throw new Error("Live verification deadline reached");
    },
  }, {
    fit: options => fitAiVideoNarration(options, {
      speak: (text, voice, timeoutMs) => {
        const cached = cachedAudio.get(text);
        return cached ? Promise.resolve(cached) : textToSpeech(text, voice, "wav", timeoutMs);
      },
      write: writeFile, probe: probeAudioSeconds,
      rewrite: async () => { throw new Error("The whole-script coordinator must own rewriting"); },
    }),
    reflow: reflowNarration, probe: probeAudioSeconds,
  });
  const report = {
    success: true, targetSeconds: 30,
    totalSeconds: result.storyboard.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    calls, scenes: result.storyboard.scenes, motionCalls: 0,
  };
  await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ...report,
    scenes: report.scenes.map(scene => ({
      id: scene.id, durationSeconds: scene.durationSeconds, audioDurationSeconds: scene.audioDurationSeconds,
      narrationStartTime: scene.narrationStartTime, narrationEndTime: scene.narrationEndTime,
    })),
    reportPath: join(dir, "report.json"),
  }));
} catch (error) {
  console.error(JSON.stringify({
    success: false, error: error instanceof Error ? error.message : "Unknown verification error",
    calls, dir, motionCalls: 0,
  }));
  process.exitCode = 1;
}