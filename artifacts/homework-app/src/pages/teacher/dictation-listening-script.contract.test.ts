import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/teacher/dictation-create.tsx"), "utf8");

describe("listening script generator contract", () => {
  it("keeps the Arabic activity title and placeholder right-aligned", () => {
    expect(source).toContain('dir={lang === "ar" ? "rtl" : "ltr"}');
    expect(source).toContain('"text-right placeholder:text-right placeholder:text-[#94a3ab]"');
    expect(source).toContain('value.trim() ? "auto" : (lang === "ar" ? "rtl" : "ltr")');
    expect(source).toContain("dir={fieldDirection(audioText)}");
    expect(source).toContain("dir={fieldDirection(generatorTopic)}");
    expect(source).toContain('dir={generatedLanguage === "en" ? "ltr" : "rtl"}');
  });

  it("generates inside the existing listening activity flow", () => {
    expect(source).toContain('data-testid="button-open-listening-script-generator"');
    expect(source).toContain('"أنشئ النص بالذكاء"');
    expect(source).toContain("min-h-[52px] w-full");
    expect(source).toContain("bg-[#1E4D35]");
    expect(source).toContain('creditAwareFetch(`${API_BASE}/api/listening-script/generate`');
    expect(source).toContain('"x-idempotency-key": createClientRequestId()');
    expect(source).toContain("refreshCreditsBalance()");
    expect(source).toContain('data-testid="dialog-listening-script-generator"');
  });

  it("only adopts a reviewed script through the real audioText state", () => {
    expect(source).toContain("setAudioText(generatedScript.slice(0, MAX_CHARS))");
    expect(source).toContain('listeningAudioText: audioText.trim()');
    expect(source).toContain('previewTts("main-audio", audioText, audioSpeed, audioVoice)');
  });

  it("keeps ambiguous-word diacritics as the default", () => {
    expect(source).toContain('useState<ScriptDiacritics>("ambiguous")');
  });

  it("places the action row after the card and reveals Next after entering a title", () => {
    expect(source).not.toContain('"fixed bottom-0 inset-x-0');
    expect(source).toContain("{(step !== 1 || title.trim()) && (");
    expect(source).toContain('data-testid="button-listening-wizard-primary"');
    expect(source).toContain("flex-nowrap items-center");
  });
});