import { AlignLeft, Brain, Gamepad2, Globe, Smartphone, Trophy, Users } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { useEffect } from "react";

const LINK_HREFS = ["/features/wameeth", "/features/escape-room", "/features/presentations-ai", "/features/worksheet-ai", "/features/interactive-video"];
const SHARED_ICONS = [Smartphone, Globe, Users, Trophy, Brain, AlignLeft];

export default function FeatureGames() {
  const { t, lang, dir } = useI18n();
  const p = t.featurePages.games;
  useSeo({ title: p.seoTitle, description: p.seoDescription, canonicalPath: "/features/games", ogImage: "/opengraph.jpg" });
  useEffect(() => {
    const schema = { "@context": "https://schema.org", "@type": "WebPage", name: p.schemaName, description: p.schemaDescription, url: "https://hasaadx.com/features/games", inLanguage: lang, about: { "@type": "Thing", name: p.schemaAbout } };
    const el = Object.assign(document.createElement("script"), { type: "application/ld+json", id: "games-feature-schema", textContent: JSON.stringify(schema) });
    document.head.appendChild(el);
    return () => { document.getElementById("games-feature-schema")?.remove(); };
  }, [lang, p]);
  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4"><Gamepad2 aria-hidden="true" className="w-4 h-4" />{p.badge}</div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">{p.title}</h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">{p.intro}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/games" className="px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">{p.browseNow}</Link>
              <Link href="/register" className="px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">{t.featurePages.common.createFree}</Link>
            </div>
          </header>
          <section className="mb-14"><h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">{p.whyTitle}</h2><div className="prose prose-lg max-w-none text-slate-700 leading-loose"><p>{p.whyP1}</p><p>{p.whyP2}</p></div></section>
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">{p.availableTitle}</h2>
            <div className="grid md:grid-cols-2 gap-3">{p.games.map(({ name, desc, href }) => <Link key={name} href={href} className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm hover:border-emerald-300 hover:shadow-md transition group"><div aria-hidden="true" className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Gamepad2 className="w-5 h-5" /></div><div><h3 className="font-bold text-emerald-900 mb-0.5 group-hover:text-emerald-700 transition">{name}</h3><p className="text-sm text-slate-600 leading-relaxed">{desc}</p></div></Link>)}</div>
          </section>
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">{p.sharedTitle}</h2>
            <ul className="space-y-3">{p.shared.map((text, index) => { const Icon = SHARED_ICONS[index]; return <li key={text} className="flex items-center gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm"><div aria-hidden="true" className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div><span className="text-slate-700 leading-relaxed">{text}</span></li>; })}</ul>
          </section>
          <section className="mb-14"><h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">{t.featurePages.common.otherTools}</h2><div className="flex flex-wrap gap-3">{p.links.map((label, index) => <Link key={LINK_HREFS[index]} href={LINK_HREFS[index]} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">{label}</Link>)}</div></section>
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12"><h2 className="text-2xl md:text-3xl font-bold mb-3">{p.ctaTitle}</h2><p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">{p.ctaBody}</p><div className="flex flex-wrap items-center justify-center gap-3"><Link href="/register" className="px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">{t.featurePages.common.startFree}</Link><Link href="/games" className="px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">{p.browse}</Link></div></section>
        </div>
      </main>
    </Layout>
  );
}