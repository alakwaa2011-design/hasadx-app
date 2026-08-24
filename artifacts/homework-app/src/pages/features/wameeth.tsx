import { BarChart3, Gamepad2, Globe, Smartphone, Timer, Trophy, Users, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FeaturePageTemplate, type FeaturePageContent } from "./feature-page-template";

const LINK_HREFS = ["/features/games", "/features/escape-room", "/features/presentations-ai", "/features/worksheet-ai", "/features/lesson-plan-ai"];

export default function FeatureWameeth() {
  const { t, lang, dir } = useI18n();
  const p = t.featurePages.wameeth;
  const content: FeaturePageContent = {
    ...p,
    primaryCta: p.try,
    secondaryCta: t.featurePages.common.browseGames,
    secondaryHref: "/games",
    overviewTitle: p.whatTitle,
    overview: [p.whatP1, p.whatP2],
    linksTitle: t.featurePages.common.otherTools,
    links: p.links.map((label, index) => ({ label, href: LINK_HREFS[index] })),
    finalSecondary: t.featurePages.common.learnPlatform,
    finalSecondaryHref: "/about",
  };
  return <FeaturePageTemplate content={content} canonicalPath="/features/wameeth" schemaId="wameeth-schema" language={lang} direction={dir} badgeIcon={<Zap aria-hidden="true" className="w-4 h-4" />} featureIcons={[<Zap />, <Smartphone />, <Timer />, <Trophy />, <Users />, <BarChart3 />, <Globe />, <Gamepad2 />]} />;
}