import { describe, expect, it } from "vitest";
import { buildNativeDialogueScenePrompt, videoDimensions } from "../lib/ai-video-composition";
import {
  requireRenderableDialogueStoryboard,
  type AiVideoBrief,
  type AiVideoStoryboard,
} from "../lib/ai-video-schemas";

const brief: AiVideoBrief = {
  title: "دورة الماء",
  topic: "التبخر والتكاثف",
  sourceImages: [],
  prompt: "",
  language: "ar",
  durationSeconds: 30,
  aspectRatio: "9:16",
  visualStyle: "cinematic",
  voice: "legacy-unused",
  music: false,
  captions: false,
  idempotencyKey: "native-dialogue-test",
};

function dialogueStoryboard(): AiVideoStoryboard {
  const teacherText = "ماذا يحدث للماء عند تسخينه؟";
  const studentText = "يتحول الماء إلى بخار.";
  return {
    title: brief.title,
    version: 1,
    characters: [
      {
        id: "teacher",
        role: "teacher",
        displayName: "الأستاذة سارة",
        appearance: "معلمة عربية في الأربعين، شعر أسود مربوط، سترة كحلية وقميص أبيض.",
        voice: "صوت نسائي عربي بالغ دافئ ومنخفض، فصيح، هادئ وواضح وبإيقاع متزن.",
      },
      {
        id: "student",
        role: "student",
        displayName: "الطالب عمر",
        appearance: "طالب عربي في الحادية عشرة، شعر بني مجعد، كنزة مدرسية خضراء.",
        voice: "صوت صبي عربي يافع مشرق ومتوسط الحدة، فصيح وفضولي وبإيقاع أسرع.",
      },
    ],
    scenes: Array.from({ length: 5 }, (_, index) => {
      const isTeacher = index % 2 === 0;
      const text = isTeacher ? teacherText : studentText;
      return {
        id: `scene-${index + 1}`,
        objective: "شرح تغير حالة الماء",
        narration: text,
        onScreenText: "",
        visualPrompt: "لقطة متوسطة في مختبر صفّي، ينظر المتحدث إلى الآخر.",
        durationSeconds: 6,
        transition: "cut",
        sourceImage: null,
        visibleCharacterIds: ["teacher", "student"],
        dialogue: [{
          speakerId: isTeacher ? "teacher" : "student",
          text,
          delivery: isTeacher ? "تسأل بلطف." : "يجيب بثقة.",
        }],
      };
    }),
  };
}

describe("native dialogue composition contract", () => {
  it("passes the unchanged character and voice bible with exact turns to every provider scene", () => {
    const storyboard = requireRenderableDialogueStoryboard(dialogueStoryboard(), brief);
    const prompt = buildNativeDialogueScenePrompt(brief, storyboard, 0);
    expect(prompt).toContain("Exact duration: 6 seconds");
    expect(prompt).toContain("Native output: 1080p");
    expect(prompt).toContain(storyboard.characters[0]!.appearance);
    expect(prompt).toContain(storyboard.characters[0]!.voice);
    expect(prompt).toContain(storyboard.characters[1]!.appearance);
    expect(prompt).toContain(storyboard.characters[1]!.voice);
    expect(prompt).toContain(`teacher: "${storyboard.scenes[0]!.dialogue[0]!.text}"`);
    expect(prompt).toContain("accurate lip synchronization");
    expect(prompt).toContain("No unseen narrator, voice-over, dubbing");
    expect(prompt).toContain("never cut, omit, rewrite, or speed up speech");
  });

  it("targets native 1080p output for every supported aspect ratio", () => {
    expect(videoDimensions("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(videoDimensions("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(videoDimensions("1:1")).toEqual({ width: 1080, height: 1080 });
  });
});