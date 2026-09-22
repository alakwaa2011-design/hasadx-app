import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));
vi.mock("@/lib/seo", () => ({ useSeo: vi.fn() }));
vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/landing/hero-section", () => ({
  HeroSection: () => <section data-section="hero" />,
}));
vi.mock("@/components/landing/benefits-section", () => ({
  BenefitsSection: () => <section data-section="benefits" />,
}));
vi.mock("@/components/landing/present-section", () => ({
  PresentSection: () => <section data-section="present" />,
}));
vi.mock("@/components/landing/tools-section", () => ({
  ToolsSection: () => <section data-section="tools" />,
}));
vi.mock("@/components/landing/how-it-works-section", () => ({
  HowItWorksSection: () => <section data-section="how-it-works" />,
}));
vi.mock("@/components/landing/reports-section", () => ({
  ReportsSection: () => <section data-section="reports" />,
}));
vi.mock("@/components/landing/motivation-section", () => ({
  MotivationSection: () => <section data-section="motivation" />,
}));
vi.mock("@/components/landing/join-game-section", () => ({
  JoinGameSection: () => <section data-section="join-game" />,
}));
vi.mock("@/components/landing/games-section", () => ({
  GamesSection: () => <section data-section="games" />,
}));
vi.mock("@/components/landing/cta-section", () => ({
  CTASection: () => <section data-section="cta" />,
}));
vi.mock("@/components/landing/footer-section", () => ({
  FooterSection: () => <section data-section="footer" />,
}));
vi.mock("@/components/install-app-button", () => ({ InstallAppButton: () => null }));

import Home from "./home";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("Home motivation section order", () => {
  it("يضع لوحة التحفيز بعد التقارير وقبل دخول المشاركين", async () => {
    await act(async () => {
      root.render(<Home />);
    });

    const sections = Array.from(
      container.querySelectorAll("main [data-section]"),
      element => element.getAttribute("data-section"),
    );

    expect(sections.indexOf("motivation")).toBe(sections.indexOf("reports") + 1);
    expect(sections.indexOf("join-game")).toBe(sections.indexOf("motivation") + 1);
  });
});