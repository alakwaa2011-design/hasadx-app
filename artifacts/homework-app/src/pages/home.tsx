import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { HeroSection } from "@/components/landing/hero-section";
import { JoinGameSection } from "@/components/landing/join-game-section";
import { ToolsSection } from "@/components/landing/tools-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { VideoPreviewSection } from "@/components/landing/video-preview-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { GamesSection } from "@/components/landing/games-section";
import { PublicQuizzesSection } from "@/components/landing/public-quizzes-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { CTASection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";
import { InstallAppButton } from "@/components/install-app-button";
import { QuickChallengeModal } from "@/components/teacher/QuickChallengeModal";
import { useState } from "react";

export default function Home() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [showQuickStart, setShowQuickStart] = useState(false);

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
        <HeroSection onQuickStart={() => setShowQuickStart(true)} />
        <JoinGameSection />

        {/* Core Product Offering */}
        <ToolsSection />

        {/* Creation Workflow & Real Stats */}
        <HowItWorksSection />

        {/* Interactive Present Experience */}
        <VideoPreviewSection />

        {/* Additional Features Summary */}
        <FeaturesSection />

        {/* Interactive Games */}
        <GamesSection />

        {/* Public Content Exchange */}
        <PublicQuizzesSection />

        {/* Real Dynamic Pricing / Plans */}
        <PricingSection />

        {/* Social Proof & Clarity */}
        <FAQSection />

        {/* Strong Close */}
        <CTASection />
      </main>

      <FooterSection />
      <InstallAppButton />

      {showQuickStart && (
        <QuickChallengeModal
          onClose={() => setShowQuickStart(false)}
        />
      )}
    </Layout>
  );
}
