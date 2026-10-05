import { expect, it } from "vitest";
import { validateHeaderValue } from "node:http";
import { presentationCsvDisposition } from "../lib/presentation-csv";

it.each(["session", "students"] as const)("exports Arabic titles with a valid %s HTTP filename", kind => {
  const title = "تقرير حصاد";
  const header = presentationCsvDisposition(title, 7, kind);
  expect(() => validateHeaderValue("Content-Disposition", header)).not.toThrow();
  expect(header).toContain(`filename="presentation-${kind}-7.csv"`);
  expect(decodeURIComponent(header.split("UTF-8''")[1])).toContain(title);
});
it("escapes reserved characters without allowing header injection", () => {
  const header = presentationCsvDisposition("A \"title\" / (x) 'test'\r\n", 7, "session");
  expect(() => validateHeaderValue("Content-Disposition", header)).not.toThrow();
  expect(header).not.toMatch(/[\r\n]/);
  expect(header.split("UTF-8''")[1]).not.toMatch(/[!'()*]/);
});
