import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelfChallengeIcon, XoIcon } from "./game-icons";

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("الأيقونات الموحدة للألعاب", () => {
  it("يرسم أيقونتي إكس أو والمسابقة الذاتية كمكوّنات SVG صالحة", () => {
    expect(renderToStaticMarkup(<XoIcon size={56} />)).toContain("<svg");
    expect(renderToStaticMarkup(<SelfChallengeIcon size={56} />)).toContain("<svg");
  });

  it("يستخدم الأيقونات الموحدة في أهم مداخل اللعب", () => {
    const dashboard = readSource("src/pages/teacher/dashboard.tsx");
    const home = readSource("src/pages/home.tsx");
    const xoCreate = readSource("src/pages/game/xo-create.tsx");
    const overview = readSource("src/components/teacher/DashboardOverview.tsx");

    expect(dashboard).toContain("icon: <XoIcon size={56} />");
    expect(dashboard).toContain("icon: <SelfChallengeIcon size={56} />");
    expect(dashboard).toContain("icon: XoIcon");
    expect(home).toContain("icon: <XoIcon size={28} />");
    expect(home).toContain("icon: <SelfChallengeIcon size={28} />");
    expect(xoCreate).toContain("gameIcon={<XoIcon size={40} />}");
    expect(overview).toContain("icon: <SelfChallengeIcon size={32} />");

    expect(dashboard).not.toContain("icon: Grid3X3");
    expect(home).not.toContain('icon: \"✕◯\"');
    expect(home).not.toContain('icon: \"🎯\"');
  });
});