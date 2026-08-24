import { BarChart3, BookOpen, CheckCircle2, Clock, Eye, MessageSquare, PauseCircle, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FeaturePageTemplate, type FeaturePageContent } from "./feature-page-template";

const LINK_HREFS = ["/features/presentations-ai", "/features/smart-whiteboard", "/features/worksheet-ai", "/features/wameeth", "/features/lesson-plan-ai"];

export default function FeatureInteractiveVideo() {
  const { t, lang, dir } = useI18n();
  const p = t.featurePages.interactiveVideo;
  const content: FeaturePageContent = {
    ...p,
    primaryCta: p.try,
    secondaryCta: p.also,
    secondaryHref: "/features/presentations-ai",
    overviewTitle: p.problemTitle,
    overview: [p.problemP1, p.problemP2],
    linksTitle: t.featurePages.common.otherTools,
    links: p.links.map((label, index) => ({ label, href: LINK_HREFS[index] })),
    finalSecondary: p.learn,
    finalSecondaryHref: "/about",
  };
  return <FeaturePageTemplate content={content} canonicalPath="/features/interactive-video" schemaId="interactive-video-schema" language={lang} direction={dir} badgeIcon={<Play aria-hidden="true" className="w-4 h-4" />} featureIcons={[<PauseCircle />, <MessageSquare />, <Eye />, <BarChart3 />, <BookOpen />, <Clock />]} useIcons={[<Play />, <CheckCircle2 />, <Eye />]} />;
}