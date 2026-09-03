import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const generatorContracts = [
  {
    name: "Smart Board",
    path: "src/pages/teacher/smart-board-new.tsx",
    sourceState: /const \[sourceText, setSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*sourceText\.trim\(\)\s*\|\|\s*undefined/,
    alternativeGuard: /!topic\.trim\(\)\s*&&\s*!sourceText\.trim\(\)/,
  },
  {
    name: "Wheel",
    path: "src/pages/game/wheel-create.tsx",
    sourceState: /const \[aiSourceText, setAiSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*aiSourceText\.trim\(\)/,
    alternativeGuard: /!aiTopic\.trim\(\)\s*&&\s*!aiSourceText\.trim\(\)/,
  },
  {
    name: "Wameeth",
    path: "src/pages/game/wameeth-create.tsx",
    sourceState: /const \[aiSourceText, setAiSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*aiSourceText\.trim\(\)/,
    alternativeGuard: /!aiTopic\.trim\(\)\s*&&\s*!aiSourceText\.trim\(\)/,
  },
  {
    name: "Maraqui",
    path: "src/pages/game/maraqui-create.tsx",
    sourceState: /const \[aiSourceText, setAiSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*aiSourceText\.trim\(\)/,
    alternativeGuard: /!aiTopic\.trim\(\)\s*&&\s*!aiSourceText\.trim\(\)/,
  },
  {
    name: "Unified game source flow",
    path: "src/components/game/unified-question-source-flow.tsx",
    sourceState: /const \[aiSourceText, setAiSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*aiSourceText\.trim\(\)/,
    alternativeGuard: /!aiTopic\.trim\(\)\s*&&\s*!aiSourceText\.trim\(\)/,
  },
  {
    name: "Arena setup",
    path: "src/pages/game/arena-setup.tsx",
    sourceState: /const \[aiSourceText, setAiSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*aiSourceText\.trim\(\)/,
    alternativeGuard: /!aiTopic\.trim\(\)\s*&&\s*!aiSourceText\.trim\(\)/,
  },
  {
    name: "Arena content manager",
    path: "src/pages/teacher/arena-content.tsx",
    sourceState: /const \[sourceText, setSourceText\] = useState\(""\)/,
    payload: /sourceText:\s*sourceText\.trim\(\)/,
    alternativeGuard: /!topic\.trim\(\)\s*&&\s*!sourceText\.trim\(\)/,
  },
  {
    name: "Quick challenge",
    path: "src/components/teacher/QuickChallengeModal.tsx",
    sourceState: /const \[sourceText, setSourceText\] = useState\(""\)/,
    payload: /JSON\.stringify\(\{\s*questionType,\s*topic,\s*sourceText,\s*language:\s*lang\s*\}\)/,
    alternativeGuard: /!topic\.trim\(\)\s*&&\s*!sourceText\.trim\(\)/,
  },
] as const;

describe("teacher-facing AI generators accept pasted source text", () => {
  for (const contract of generatorContracts) {
    it(`${contract.name} supports source-only generation with the unified limit`, () => {
      const source = readFileSync(resolve(process.cwd(), contract.path), "utf8");

      expect(source).toMatch(contract.sourceState);
      expect(source).toMatch(contract.payload);
      expect(source).toMatch(contract.alternativeGuard);
      expect(source).toMatch(/maxLength=\{(?:MAX_SOURCE_TEXT_LENGTH|12000)\}/);
    });
  }

  it("never promotes pasted Smart Board or Wheel source text into the trusted topic field", () => {
    const smartBoard = readFileSync(
      resolve(process.cwd(), "src/pages/teacher/smart-board-new.tsx"),
      "utf8",
    );
    const wheel = readFileSync(
      resolve(process.cwd(), "src/pages/game/wheel-create.tsx"),
      "utf8",
    );

    expect(smartBoard).toMatch(/topic:\s*topic\.trim\(\)/);
    expect(smartBoard).not.toMatch(/topic:\s*fallbackTitle/);
    expect(wheel).toMatch(/topic:\s*aiTopic\.trim\(\)/);
    expect(wheel).not.toMatch(/topic:\s*fallbackTitle/);
  });
});