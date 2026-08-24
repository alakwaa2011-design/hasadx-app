import { useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { useSeo } from "@/lib/seo";

type Item = { title: string; body: string };
type LinkItem = { href: string; label: string };

export interface FeaturePageContent {
  seoTitle: string;
  seoDescription: string;
  schemaName: string;
  schemaDescription: string;
  badge: string;
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  secondaryHref: string;
  overviewTitle: string;
  overview: string[];
  featuresTitle: string;
  features: Item[];
  usesTitle: string;
  uses: Item[];
  linksTitle: string;
  links: LinkItem[];
  ctaTitle: string;
  ctaBody: string;
  finalSecondary: string;
  finalSecondaryHref: string;
}

interface Props {
  content: FeaturePageContent;
  canonicalPath: string;
  schemaId: string;
  schemaType?: "WebPage" | "SoftwareApplication";
  language: string;
  direction: "rtl" | "ltr";
  badgeIcon: ReactNode;
  featureIcons: ReactNode[];
  useIcons?: ReactNode[];
}

export function FeaturePageTemplate({
  content,
  canonicalPath,
  schemaId,
  schemaType = "SoftwareApplication",
  language,
  direction,
  badgeIcon,
  featureIcons,
  useIcons,
}: Props) {
  useSeo({
    title: content.seoTitle,
    description: content.seoDescription,
    canonicalPath,
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: content.schemaName,
      ...(schemaType === "SoftwareApplication" && {
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
      }),
      inLanguage: language,
      description: content.schemaDescription,
      url: `https://hasaadx.com${canonicalPath}`,
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: schemaId,
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById(schemaId)?.remove(); };
  }, [canonicalPath, content, language, schemaId, schemaType]);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={direction}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              {badgeIcon}{content.badge}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">{content.title}</h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">{content.intro}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                {content.primaryCta}<ArrowLeft aria-hidden="true" className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </Link>
              <Link href={content.secondaryHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {content.secondaryCta}
              </Link>
            </div>
          </header>

          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">{content.overviewTitle}</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              {content.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">{content.featuresTitle}</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {content.features.map(({ title, body }, index) => (
                <li key={title} className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm list-none">
                  <div aria-hidden="true" className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">{featureIcons[index]}</div>
                  <div><h3 className="font-bold text-emerald-900 mb-1">{title}</h3><p className="text-sm text-slate-700 leading-relaxed">{body}</p></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">{content.usesTitle}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {content.uses.map(({ title, body }, index) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <div aria-hidden="true" className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                    {useIcons?.[index] ?? <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">{content.linksTitle}</h2>
            <div className="flex flex-wrap gap-3">
              {content.links.map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">{label}</Link>
              ))}
            </div>
          </section>

          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{content.ctaTitle}</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">{content.ctaBody}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {content.primaryCta}<ArrowLeft aria-hidden="true" className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </Link>
              <Link href={content.finalSecondaryHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">{content.finalSecondary}</Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}