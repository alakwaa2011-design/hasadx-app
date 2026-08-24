import { CheckCircle2, Grid3x3, Lightbulb, Lock, Sparkles, Trophy, Unlock, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FeaturePageTemplate, type FeaturePageContent } from "./feature-page-template";

const LINK_HREFS = ["/features/wameeth", "/features/games", "/features/presentations-ai", "/features/worksheet-ai", "/features/lesson-plan-ai"];

export default function FeatureEscapeRoom() {
  const { t, lang, dir } = useI18n();
  const p = t.featurePages.escapeRoom;
  const content: FeaturePageContent = {
    ...p,
    primaryCta: p.try,
    secondaryCta: p.also,
    secondaryHref: "/features/wameeth",
    overviewTitle: p.howTitle,
    overview: [p.howP1, p.howP2],
    linksTitle: p.otherTitle,
    links: p.links.map((label, index) => ({ label, href: LINK_HREFS[index] })),
    finalSecondary: t.featurePages.common.browseGames,
    finalSecondaryHref: "/features/games",
  };
  return <FeaturePageTemplate content={content} canonicalPath="/features/escape-room" schemaId="escape-schema" language={lang} direction={dir} badgeIcon={<Lock aria-hidden="true" className="w-4 h-4" />} featureIcons={[<Sparkles />, <Grid3x3 />, <Users />, <Lock />, <Lightbulb />, <Trophy />]} useIcons={[<Unlock />, <CheckCircle2 />, <Users />]} />;
}