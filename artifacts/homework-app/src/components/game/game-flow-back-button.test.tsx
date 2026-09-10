import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const i18n = vi.hoisted(() => ({ lang: "ar" as "ar" | "en" }));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: i18n.lang }),
}));

import { GameFlowBackButton } from "./game-flow-back-button";

const ACTIVE_GAME_SETUP_SCREENS = [
  "arena-setup.tsx",
  "capitals-setup.tsx",
  "color-setup.tsx",
  "escape-create.tsx",
  "flags-setup.tsx",
  "hack-setup.tsx",
  "hotseat-create.tsx",
  "letrly-create.tsx",
  "letrly-setup.tsx",
  "maraqui-create.tsx",
  "maraqui-setup.tsx",
  "memory-create.tsx",
  "memory-setup.tsx",
  "million-setup.tsx",
  "multiply-setup.tsx",
  "rocket-create.tsx",
  "scramble-create.tsx",
  "scramble-setup.tsx",
  "secret-setup.tsx",
  "stroop-create.tsx",
  "stroop-setup.tsx",
  "tug-create.tsx",
  "wameeth-create.tsx",
  "wheel-create.tsx",
  "xo-create.tsx",
] as const;

const MULTI_STEP_BACK_CONTRACTS = [
  ["arena-setup.tsx", ["if (step > 1) goPrev();", 'else setLocation("/");']],
  ["capitals-setup.tsx", ['setPhase("config")', 'setPhase("mode")', 'setLocation("/")']],
  ["escape-create.tsx", ['onBack={() => setLocation("/")}', 'onBack={() => setSetupStep("questions")}']],
  ["flags-setup.tsx", ['setPhase("config")', 'setPhase("mode")', 'setLocation("/")']],
  ["letrly-setup.tsx", ['setTab("play")', 'setLocation("/")']],
  ["million-setup.tsx", ["setSetupTab(steps[currentIndex - 1])", 'setLocation("/")']],
  ["rocket-create.tsx", ['setStep("questions")', 'setLocation("/")']],
  ["tug-create.tsx", ['setSetupStep("questions")', 'setLocation("/")']],
  ["wameeth-create.tsx", ['step === "mode" ? setStep("prepare") : setLocation("/")']],
  ["wheel-create.tsx", ['setupStep === "settings" ? returnToQuestions() : setLocation("/")']],
  ["xo-create.tsx", ['setSetupStep("questions")', 'useSmartBack("/games")']],
] as const;

function gamePageSource(fileName: string) {
  return readFileSync(resolve(import.meta.dirname, "../../pages/game", fileName), "utf8");
}

describe("game setup back-button contract", () => {
  it.each(ACTIVE_GAME_SETUP_SCREENS)(
    "keeps the shared back control visible on %s",
    (fileName) => {
      const source = gamePageSource(fileName);
      expect(source).toContain(
        'import { GameFlowBackButton } from "@/components/game/game-flow-back-button";',
      );
      expect(source).toMatch(/<GameFlowBackButton\b/);
      expect(source).toMatch(/(?:setLocation|navigate)\("\/"\)|useSmartBack\("\/games"\)/);
    },
  );

  it("keeps prepared XO questions when returning from settings", () => {
    const source = gamePageSource("xo-create.tsx");
    const backHandler = source.match(/const handleFlowBack = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";

    expect(backHandler).toContain('setSetupStep("questions")');
    expect(backHandler).not.toContain("setQuestions([])");
    expect(source).toContain("onBackFromMenu={handleFlowBack}");
    expect(source).toContain('backLabel={ar ? "رجوع" : "Back"}');
    expect(source).toContain('label={ar ? "رجوع" : "Back"}');
  });

  it.each(MULTI_STEP_BACK_CONTRACTS)(
    "returns to the previous setup step before home in %s",
    (fileName, requiredActions) => {
      const source = gamePageSource(fileName);
      for (const action of requiredActions) {
        expect(source).toContain(action);
      }
    },
  );
});

describe("GameFlowBackButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each([
    ["ar", "رجوع", "رجوع خطوة", "lucide-chevron-right"],
    ["en", "Back", "Back one step", "lucide-chevron-left"],
  ] as const)(
    "renders and works in %s",
    async (lang, ariaLabel, visibleLabel, iconClass) => {
      i18n.lang = lang;
      const onBack = vi.fn();

      await act(async () => {
        root.render(<GameFlowBackButton onBack={onBack} />);
      });

      const button = container.querySelector("button");
      expect(button).not.toBeNull();
      expect(button?.getAttribute("type")).toBe("button");
      expect(button?.getAttribute("aria-label")).toBe(ariaLabel);
      expect(button?.textContent).not.toContain(visibleLabel);
      expect(button?.querySelector(`.${iconClass}`)).not.toBeNull();

      await act(async () => button?.click());
      expect(onBack).toHaveBeenCalledOnce();
    },
  );
});