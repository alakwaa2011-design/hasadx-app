/**
 * Unit tests for whiteboard boardActions normalisation logic.
 *
 * The LLM sometimes emits wrapped actions like {"showLocation": {...}} without
 * a top-level "type" field.  normalizeActions() unwraps them and applies
 * field-level validation so the renderer never receives malformed data.
 */

import { describe, it, expect } from "vitest";
import { normalizeActions, actionsWithFallback } from "../routes/whiteboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convenience: run normalizeActions and assert a single action comes out. */
function single(raw: any[]) {
  const result = normalizeActions(raw);
  expect(result).toHaveLength(1);
  return result[0];
}

// ── Well-formed actions (pass-through) ────────────────────────────────────────

describe("well-formed actions", () => {
  it("passes through a normal typed bullet", () => {
    const a = single([{ type: "bullet", content: "Hello world", color: "white" }]);
    expect(a.type).toBe("bullet");
    expect(a.content).toBe("Hello world");
  });

  it("passes through a normal typed showLocation", () => {
    const a = single([{ type: "showLocation", name: "الرياض", country: "السعودية" }]);
    expect(a.type).toBe("showLocation");
    expect(a.name).toBe("الرياض");
  });

  it("passes through a normal typed showChart with valid data", () => {
    const a = single([{
      type: "showChart",
      description: "speed comparison",
      data: [{ label: "light", value: 300000 }, { label: "sound", value: 0.343 }],
    }]);
    expect(a.type).toBe("showChart");
    expect(a.data).toHaveLength(2);
    expect(a.data[0].value).toBe(300000);
  });
});

// ── Wrapped actions (the core bug) ────────────────────────────────────────────

describe("wrapped actions — model emits {typeName: payload} without 'type' field", () => {
  it('unwraps {"showLocation": {...}}', () => {
    const a = single([{ showLocation: { name: "القاهرة", country: "مصر", description: "على النيل" } }]);
    expect(a.type).toBe("showLocation");
    expect(a.name).toBe("القاهرة");
    expect(a.country).toBe("مصر");
  });

  it('unwraps {"bullet": {...}}', () => {
    const a = single([{ bullet: { content: "نقطة مهمة", color: "yellow" } }]);
    expect(a.type).toBe("bullet");
    expect(a.content).toBe("نقطة مهمة");
    expect(a.color).toBe("yellow");
  });

  it('unwraps {"writeMath": {...}}', () => {
    const a = single([{ writeMath: { content: "x^2 + y^2 = r^2", color: "green" } }]);
    expect(a.type).toBe("writeMath");
    expect(a.content).toBe("x^2 + y^2 = r^2");
  });

  it('unwraps {"showChart": {...}} with object payload', () => {
    const a = single([{
      showChart: {
        description: "مقارنة",
        data: [{ label: "أ", value: 10 }, { label: "ب", value: 20 }],
      },
    }]);
    expect(a.type).toBe("showChart");
    expect(a.data).toHaveLength(2);
  });

  it('unwraps string-value form {"bullet": "some text"}', () => {
    const a = single([{ bullet: "نقطة مختصرة" }]);
    expect(a.type).toBe("bullet");
    expect(a.content).toBe("نقطة مختصرة");
  });

  it('unwraps {"drawConnector": {...}}', () => {
    const a = single([{ drawConnector: { from: "الحرارة", to: "التمدد", label: "تسبب" } }]);
    expect(a.type).toBe("drawConnector");
    expect(a.from).toBe("الحرارة");
    expect(a.to).toBe("التمدد");
  });
});

// ── Actions missing "type" entirely (no wrapper key match) ────────────────────

describe("actions missing type entirely", () => {
  it("drops an object with no type and no recognisable wrapper key", () => {
    const result = normalizeActions([{ content: "some text", color: "white" }]);
    expect(result).toHaveLength(0);
  });

  it("drops null entries", () => {
    const result = normalizeActions([null, undefined, 42, "string"]);
    expect(result).toHaveLength(0);
  });

  it("drops an empty object", () => {
    expect(normalizeActions([{}])).toHaveLength(0);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeActions(null)).toHaveLength(0);
    expect(normalizeActions(undefined)).toHaveLength(0);
    expect(normalizeActions("not an array")).toHaveLength(0);
    expect(normalizeActions({ boardActions: [] })).toHaveLength(0);
  });
});

// ── showLocation field validation ─────────────────────────────────────────────

describe("showLocation field validation", () => {
  it("keeps showLocation when name is a non-empty string", () => {
    const a = single([{ type: "showLocation", name: "Riyadh" }]);
    expect(a.type).toBe("showLocation");
  });

  it("drops showLocation when name is missing", () => {
    expect(normalizeActions([{ type: "showLocation", country: "Saudi Arabia" }])).toHaveLength(0);
  });

  it("drops showLocation when name is an empty string", () => {
    expect(normalizeActions([{ type: "showLocation", name: "   " }])).toHaveLength(0);
  });

  it("drops showLocation when name is a non-string", () => {
    expect(normalizeActions([{ type: "showLocation", name: 42 }])).toHaveLength(0);
  });
});

// ── showChart data validation and normalisation ───────────────────────────────

describe("showChart data validation", () => {
  it("coerces string values to numbers", () => {
    const a = single([{
      type: "showChart",
      description: "test",
      data: [{ label: "A", value: "50" }, { label: "B", value: "30" }],
    }]);
    expect(a.data[0].value).toBe(50);
    expect(a.data[1].value).toBe(30);
  });

  it("drops rows with non-numeric value", () => {
    const a = single([{
      type: "showChart",
      description: "test",
      data: [
        { label: "valid", value: 10 },
        { label: "bad string", value: "not a number" },
        { label: "bad NaN", value: NaN },
      ],
    }]);
    expect(a.data).toHaveLength(1);
    expect(a.data[0].label).toBe("valid");
  });

  it("drops showChart entirely when data is empty array", () => {
    expect(normalizeActions([{ type: "showChart", description: "x", data: [] }])).toHaveLength(0);
  });

  it("drops showChart entirely when data is missing", () => {
    expect(normalizeActions([{ type: "showChart", description: "x" }])).toHaveLength(0);
  });

  it("drops showChart entirely when data is not an array", () => {
    expect(normalizeActions([{ type: "showChart", description: "x", data: "oops" }])).toHaveLength(0);
  });

  it("drops showChart when all rows are malformed", () => {
    expect(normalizeActions([{
      type: "showChart", description: "x",
      data: [{ label: "bad", value: "NaN" }, null],
    }])).toHaveLength(0);
  });

  it("caps data at 10 entries", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({ label: `item${i}`, value: i }));
    const a = single([{ type: "showChart", description: "many", data }]);
    expect(a.data).toHaveLength(10);
  });
});

// ── drawConnector field validation ────────────────────────────────────────────

describe("drawConnector validation", () => {
  it("keeps drawConnector with from and to", () => {
    const a = single([{ type: "drawConnector", from: "A", to: "B" }]);
    expect(a.type).toBe("drawConnector");
  });

  it("drops drawConnector missing 'from'", () => {
    expect(normalizeActions([{ type: "drawConnector", to: "B" }])).toHaveLength(0);
  });

  it("drops drawConnector missing 'to'", () => {
    expect(normalizeActions([{ type: "drawConnector", from: "A" }])).toHaveLength(0);
  });
});

// ── showImage field validation ────────────────────────────────────────────────

describe("showImage validation", () => {
  it("keeps showImage with a non-empty imageQuery", () => {
    const a = single([{ type: "showImage", imageQuery: "Cairo Egypt", description: "القاهرة" }]);
    expect(a.type).toBe("showImage");
  });

  it("drops showImage with empty imageQuery", () => {
    expect(normalizeActions([{ type: "showImage", imageQuery: "   ", description: "test" }])).toHaveLength(0);
  });

  it("drops showImage missing imageQuery", () => {
    expect(normalizeActions([{ type: "showImage", description: "test" }])).toHaveLength(0);
  });
});

// ── normalizeActions: empty input ─────────────────────────────────────────────

describe("empty boardActions (normalizeActions only)", () => {
  it("returns empty array for [] input (fallback applied separately)", () => {
    expect(normalizeActions([])).toHaveLength(0);
  });

  it("returns empty array when all entries are invalid", () => {
    const result = normalizeActions([
      { unknownKey: "value" },
      null,
      { type: "showChart", data: [] },
      { type: "showLocation", name: "" },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ── actionsWithFallback ───────────────────────────────────────────────────────

describe("actionsWithFallback", () => {
  it("returns a single writeText when actions are empty and voiceText has content", () => {
    const result = actionsWithFallback([], "الرياضيات علم رائع");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "writeText", content: "الرياضيات علم رائع", color: "white" });
  });

  it("trims leading/trailing whitespace from voiceText in the fallback", () => {
    const result = actionsWithFallback([], "  trimmed content  ");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("trimmed content");
  });

  it("leaves non-empty actions unchanged even when voiceText is present", () => {
    const actions = [{ type: "bullet", content: "نقطة", color: "white" }];
    const result = actionsWithFallback(actions, "some voice text");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("bullet");
  });

  it("leaves non-empty actions unchanged when voiceText is empty", () => {
    const actions = [{ type: "highlight", content: "مفهوم", color: "yellow" }];
    const result = actionsWithFallback(actions, "");
    expect(result).toBe(actions); // same reference — no copy
  });

  it("returns empty array (no fallback) when actions empty and voiceText is empty string", () => {
    expect(actionsWithFallback([], "")).toHaveLength(0);
  });

  it("returns empty array (no fallback) when actions empty and voiceText is whitespace only", () => {
    expect(actionsWithFallback([], "   ")).toHaveLength(0);
  });

  it("normalizeActions → actionsWithFallback pipeline: all-invalid actions + voiceText → writeText", () => {
    // Simulates the full route pipeline: model returns bad actions + a voiceText
    const actions = normalizeActions([{ type: "showLocation", name: "" }, null]);
    const result = actionsWithFallback(actions, "التفاضل والتكامل");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "writeText", content: "التفاضل والتكامل", color: "white" });
  });

  it("normalizeActions → actionsWithFallback pipeline: valid actions + voiceText → actions pass through", () => {
    const actions = normalizeActions([{ type: "bullet", content: "نقطة", color: "white" }]);
    const result = actionsWithFallback(actions, "some text");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("bullet");
  });
});

// ── Mixed valid + invalid arrays ──────────────────────────────────────────────

describe("mixed valid and invalid arrays", () => {
  it("keeps only the valid items from a mixed array", () => {
    const result = normalizeActions([
      { type: "bullet", content: "good" },
      null,
      { type: "showLocation", name: "" },          // dropped: empty name
      { showLocation: { name: "Mecca", country: "KSA" } },  // unwrapped + kept
      { unknownKey: { foo: "bar" } },               // dropped: unknown type
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("bullet");
    expect(result[1].type).toBe("showLocation");
    expect(result[1].name).toBe("Mecca");
  });
});
