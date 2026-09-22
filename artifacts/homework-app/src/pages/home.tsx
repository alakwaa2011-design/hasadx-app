import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { HeroSection } from "@/components/landing/hero-section";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { PresentSection } from "@/components/landing/present-section";
import { ToolsSection } from "@/components/landing/tools-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ReportsSection } from "@/components/landing/reports-section";
import { JoinGameSection } from "@/components/landing/join-game-section";
import { GamesSection } from "@/components/landing/games-section";
import { CTASection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";
import { InstallAppButton } from "@/components/install-app-button";

export default function Home() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  useSeo({
    title: isAr
      ? "حصاد - منصة عربية متكاملة لتعليم تفاعلي مبدع"
      : "Hasaad - Integrated Arabic Platform for Interactive Education",
    description: isAr
      ? "خطط، أنشئ، اعرض وتفاعل من مكان واحد. أدوات ذكية تساعد المعلم على إعداد درسه وصناعة الألعاب والمحتوى والأنشطة التفاعلية."
      : "Plan, create, present and interact from one place. Smart tools to help teachers prepare lessons and create interactive games and activities.",
  });

  return (
    <Layout>
      <main className="flex-1 bg-background flex flex-col min-h-screen">
        <HeroSection />
        <BenefitsSection />
        <PresentSection />
        <ToolsSection />
        <HowItWorksSection />
        <ReportsSection />
        <JoinGameSection />
        <GamesSection />
        <CTASection />
      </main>

      <FooterSection />
      <InstallAppButton />
    </Layout>
  );
}