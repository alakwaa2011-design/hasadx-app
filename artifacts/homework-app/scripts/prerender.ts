#!/usr/bin/env node
/**
 * prerender.ts — build-time static HTML generator for public pages.
 *
 * Runs after `vite build` and creates per-route index.html files under
 * dist/public/<route>/index.html.  Each file has:
 *   - Route-specific <title>, <meta description>, <link rel="canonical">
 *   - Route-specific Open Graph / Twitter tags
 *   - Route-specific JSON-LD structured data
 *   - Rich HTML content inside <div id="root"> that AI bots and crawlers
 *     (GPTBot, ClaudeBot, OAI-SearchBot, Perplexity, Googlebot lite) can
 *     read directly without executing JavaScript.
 *
 * React replaces the static #root content at runtime — regular users are
 * never affected.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist/public");
const TEMPLATE_PATH = path.join(DIST_DIR, "index.html");

const SITE = "https://hasadx.com";

// ---------------------------------------------------------------------------
// Shared layout helpers
// ---------------------------------------------------------------------------

const COMMON_STYLE = `
  font-family:'Tajawal','IBM Plex Sans Arabic',system-ui,sans-serif;
  direction:rtl;text-align:right;color:#0f172a;line-height:1.9;
`.trim();

const H1 = (text: string) =>
  `<h1 style="font-size:2rem;font-weight:900;color:#14532d;margin:0 0 .75rem">${text}</h1>`;
const H2 = (text: string) =>
  `<h2 style="font-size:1.4rem;font-weight:800;color:#14532d;margin:2rem 0 .6rem">${text}</h2>`;
const P = (text: string) =>
  `<p style="font-size:1rem;color:#374151;margin:.4rem 0">${text}</p>`;
const UL = (items: string[]) =>
  `<ul style="padding-inline-start:1.25rem;color:#374151;margin:.4rem 0">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const NAV_LINKS = `
<nav style="margin-top:2rem;display:flex;flex-wrap:wrap;gap:.75rem">
  <a href="${SITE}/" style="color:#14532d;font-weight:600">الرئيسية</a>
  <a href="${SITE}/about" style="color:#14532d;font-weight:600">عن المنصة</a>
  <a href="${SITE}/faq" style="color:#14532d;font-weight:600">الأسئلة الشائعة</a>
  <a href="${SITE}/games" style="color:#14532d;font-weight:600">الألعاب</a>
  <a href="${SITE}/islamic" style="color:#14532d;font-weight:600">المسابقات الإسلامية</a>
  <a href="${SITE}/register" style="color:#14532d;font-weight:600">إنشاء حساب</a>
</nav>`.trim();

function wrapRoot(innerHtml: string): string {
  return `<div style="max-width:800px;margin:3rem auto;padding:1.5rem 2rem;${COMMON_STYLE}">${innerHtml}${NAV_LINKS}</div>`;
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

interface Route {
  path: string; // relative URL path — "" means root
  title: string;
  description: string;
  canonicalPath: string; // e.g. "/about"
  ogTitle?: string;
  ogDescription?: string;
  jsonLd?: object[];
  bodyHtml: string; // injected inside #root
}

const routes: Route[] = [
  // ── Home ─────────────────────────────────────────────────────────────────
  {
    path: "",
    title:
      "منصة حصاد | HasadX — عروض تفاعلية ومسابقات تعليمية وواجبات وأنشطة",
    description:
      "منصة حصاد (HasadX) منصة تعليم تفاعلي عربية للمعلمين والمدارس: أنشئ عروضًا تفاعلية ومسابقات تعليمية وواجبات وأنشطة، وأنشئ عروضًا بالذكاء الاصطناعي بسهولة وسرعة.",
    canonicalPath: "/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${SITE}/`,
        url: `${SITE}/`,
        name: "منصة حصاد التعليمية — HasadX",
        description:
          "منصة تعليم تفاعلي عربية للمعلمين: عروض، مسابقات، واجبات، وذكاء اصطناعي.",
        inLanguage: "ar",
      },
    ],
    bodyHtml: wrapRoot(`
      ${H1("منصة حصاد التعليمية — HasadX")}
      ${P("<strong>منصة حصاد</strong> منصة تعليم تفاعلي عربية موجّهة للمعلمين والمدارس. تُتيح إنشاء <strong>عروض تفاعلية</strong> و<strong>مسابقات تعليمية</strong> و<strong>واجبات وأنشطة</strong> ومشاركتها فوراً عبر رمز دخول مكوّن من 6 أرقام — بدون حساب للطالب.")}

      ${H2("ما الذي تقدمه منصة حصاد؟")}
      ${UL([
        "<strong>عروض تفاعلية مباشرة:</strong> شرائح تفاعلية يستجيب فيها الطلاب بأجهزتهم في الوقت الفعلي.",
        "<strong>مسابقات تعليمية جماعية:</strong> وميض، أرينا حصاد، شد الحبل، هاك، سباق الصواريخ، عجلة التحدي، ومن سيربح المليون.",
        "<strong>واجبات وأنشطة:</strong> أسئلة متنوعة (اختيار من متعدد، ملء الفراغ، كتابة حرة) مع لوحة نتائج فورية.",
        "<strong>ذكاء اصطناعي:</strong> توليد أسئلة وعروض تفاعلية وخطط دروس من موضوع أو ملف واحد.",
        "<strong>محتوى إسلامي:</strong> مسابقات قرآن وسيرة وفقه وتاريخ إسلامي بشهادات إلكترونية ولوحة متصدرين.",
        "<strong>تكاملات:</strong> Google Classroom وMicrosoft Teams لاستيراد الطلاب ومزامنة الدرجات.",
      ])}

      ${H2("من يستخدم المنصة؟")}
      ${UL([
        "<strong>المعلم:</strong> يُنشئ الأنشطة ويُشاركها ويتابع النتائج في لحظتها.",
        "<strong>منظم الفعاليات:</strong> يُدير مسابقات حية أمام جمهور بلوحات نتائج مباشرة.",
        "<strong>الطالب / المشارك:</strong> يدخل بالرمز ويُجيب فوراً بدون حساب.",
      ])}

      ${H2("كيف تبدأ؟")}
      ${P(`سجّل حساباً مجانياً على <a href="${SITE}/register" style="color:#14532d">hasadx.com/register</a>، أنشئ نشاطك الأول، وشارك الرمز مع طلابك.`)}
    `),
  },

  // ── About ─────────────────────────────────────────────────────────────────
  {
    path: "about",
    title: "عن منصة حصاد التعليمية | HasadX",
    description:
      "تعرّف على منصة حصاد (HasadX): منصة تعليم تفاعلي عربية للمعلمين، تدعم العروض التفاعلية، المسابقات التعليمية، الواجبات، وإنشاء المحتوى بالذكاء الاصطناعي.",
    canonicalPath: "/about",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "@id": `${SITE}/about`,
        url: `${SITE}/about`,
        name: "عن منصة حصاد التعليمية",
        description:
          "تعرّف على منصة حصاد التعليمية العربية: أدوات التعليم التفاعلي للمعلم العربي.",
        inLanguage: "ar",
        publisher: { "@type": "Organization", name: "منصة حصاد", alternateName: "HasadX" },
      },
    ],
    bodyHtml: wrapRoot(`
      ${H1("عن منصة حصاد التعليمية — HasadX")}
      ${P("منصة حصاد هي منصة تعليم تفاعلي عربية شاملة صُمِّمت خصيصاً للمعلم العربي والمدارس العربية. تجمع بين العروض التفاعلية المباشرة والمسابقات التعليمية والواجبات الإلكترونية وأدوات الذكاء الاصطناعي في بيئة واحدة متكاملة.")}

      ${H2("لماذا منصة حصاد؟")}
      ${UL([
        "واجهة عربية كاملة بدعم RTL أصيل — ليست ترجمة لمنصة أجنبية.",
        "ذكاء اصطناعي مدرَّب على المناهج العربية لتوليد الأسئلة والعروض والخطط.",
        "الطالب يدخل برمز 6 أرقام بدون حاجة لإنشاء حساب.",
        "يعمل على الحاسوب والجوال بدون تثبيت تطبيق.",
        "بيانات الطلاب مشفرة ولا تُشارك مع أطراف خارجية.",
        "تطوير مستمر بناءً على مقترحات المعلمين المستخدمين.",
      ])}

      ${H2("ما الذي تقدمه حصاد للمعلم؟")}
      ${UL([
        "<strong>العروض التفاعلية:</strong> شرائح تفاعلية مباشرة يستجيب فيها الطلاب لحظياً.",
        "<strong>المسابقات التعليمية:</strong> وميض، أرينا حصاد، هاك، من سيربح المليون، وغيرها.",
        "<strong>الواجبات والأنشطة:</strong> MCQ، صواب/خطأ، ملء الفراغ، كتابة حرة، مطابقة، صوتيات.",
        "<strong>منشئ العروض بالذكاء الاصطناعي:</strong> أنشئ عرضاً كاملاً من كلمة واحدة أو ملف.",
        "<strong>المساعد التعليمي الذكي:</strong> توليد خطة درس، ورقة عمل، خريطة ذهنية.",
        "<strong>لوحة التحكم والتقارير:</strong> تابع تقدم كل طالب وأداء الفصل بلحظة.",
      ])}

      ${H2("الجمهور المستهدف")}
      ${UL([
        "<strong>المعلمون:</strong> في المدارس الحكومية والخاصة والمعاهد التدريبية.",
        "<strong>المدارس والمؤسسات التعليمية:</strong> إدارة جماعية مع تقارير موحدة.",
        "<strong>منظمو الفعاليات:</strong> مسابقات حية أمام جمهور كبير.",
        "<strong>الطلاب والمشاركون:</strong> تجارب تعلم ممتعة وتنافسية.",
      ])}

      ${H2("تكاملات المنصة")}
      ${P("تدعم حصاد التكامل مع <strong>Google Classroom</strong> و<strong>Microsoft Teams</strong> لاستيراد قوائم الطلاب، نشر الأنشطة، ومزامنة الدرجات مباشرة.")}

      ${H2("ابدأ مجاناً")}
      ${P(`سجّل حساباً مجانياً على <a href="${SITE}/register" style="color:#14532d">hasadx.com/register</a> وابدأ أول نشاط تعليمي في دقائق.`)}
    `),
  },

  // ── FAQ ──────────────────────────────────────────────────────────────────
  {
    path: "faq",
    title: "الأسئلة الشائعة | منصة حصاد — HasadX",
    description:
      "أجوبة سريعة عن أكثر الأسئلة شيوعاً حول منصة حصاد: العروض التفاعلية، المسابقات التعليمية، الواجبات، وإنشاء العروض بالذكاء الاصطناعي.",
    canonicalPath: "/faq",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "كيف أنشئ واجباً جديداً؟",
            acceptedAnswer: {
              "@type": "Answer",
              text: "بعد تسجيل الدخول، انتقل إلى لوحة التحكم واضغط على 'واجب جديد'. يمكنك إضافة أسئلة متنوعة وتحديد موعد التسليم ومشاركة رابط الواجب مع طلابك.",
            },
          },
          {
            "@type": "Question",
            name: "كيف يصل الطالب إلى الواجب؟",
            acceptedAnswer: {
              "@type": "Answer",
              text: "يكفي أن تشارك الطالب رابط الواجب المباشر أو رمز الدخول المكوّن من 6 أرقام. لا يحتاج الطالب إلى إنشاء حساب.",
            },
          },
          {
            "@type": "Question",
            name: "ما أنواع الأسئلة المتاحة؟",
            acceptedAnswer: {
              "@type": "Answer",
              text: "تدعم المنصة أسئلة الاختيار من متعدد، والصواب والخطأ، وملء الفراغ، والكتابة الحرة، والمطابقة. يمكنك إضافة صور وملفات صوتية.",
            },
          },
          {
            "@type": "Question",
            name: "هل المنصة مجانية؟",
            acceptedAnswer: {
              "@type": "Answer",
              text: "تقدم منصة حصاد الميزات الأساسية مجاناً. للاستفسار عن الخطط المتقدمة تواصل معنا.",
            },
          },
          {
            "@type": "Question",
            name: "هل بيانات طلابي آمنة؟",
            acceptedAnswer: {
              "@type": "Answer",
              text: "نعم. تُشفَّر جميع البيانات ولا تُشارك مع أطراف خارجية. راجع سياسة الخصوصية لمزيد من التفاصيل.",
            },
          },
          {
            "@type": "Question",
            name: "ما هو وضع المسابقة الحية؟",
            acceptedAnswer: {
              "@type": "Answer",
              text: "يتيح لك وضع المسابقة الحية تحويل الواجب إلى لعبة تنافسية في الوقت الفعلي. يدخل الطلاب برمز الجلسة ويتنافسون على الإجابات السريعة والصحيحة مع لوحة متصدرين فورية.",
            },
          },
        ],
      },
    ],
    bodyHtml: wrapRoot(`
      ${H1("الأسئلة الشائعة — منصة حصاد")}

      ${H2("كيف أنشئ واجباً جديداً؟")}
      ${P("بعد تسجيل الدخول، انتقل إلى لوحة التحكم واضغط على 'واجب جديد'. أضف أسئلة متنوعة وحدد موعد التسليم وشارك الرابط مع طلابك.")}

      ${H2("كيف يصل الطالب إلى الواجب؟")}
      ${P("يكفي أن تشارك الطالب رابط الواجب المباشر أو رمز الدخول المكوّن من 6 أرقام. لا يحتاج الطالب إلى إنشاء حساب؛ يُدخل اسمه ويبدأ الإجابة مباشرة.")}

      ${H2("هل يمكنني متابعة نتائج الطلاب؟")}
      ${P("نعم، تجد في صفحة تفاصيل الواجب قسم 'النتائج' الذي يعرض جميع إجابات الطلاب وعلاماتهم وتاريخ التسليم في الوقت الفعلي.")}

      ${H2("ما أنواع الأسئلة المتاحة؟")}
      ${P("تدعم المنصة: <strong>الاختيار من متعدد، الصواب والخطأ، ملء الفراغ، الكتابة الحرة، المطابقة</strong>. يمكنك إضافة صور وملفات صوتية لأي سؤال.")}

      ${H2("ما هو وضع المسابقة الحية؟")}
      ${P("يُحوّل الواجب إلى لعبة تنافسية في الوقت الفعلي. يدخل الطلاب برمز الجلسة ويتنافسون على السرعة والدقة مع ظهور لوحة المتصدرين فوراً.")}

      ${H2("نسيت كلمة المرور — كيف أستعيدها؟")}
      ${P("اضغط 'نسيت كلمة المرور؟' في صفحة الدخول، أدخل بريدك أو رقم هاتفك، وستصلك تعليمات إعادة التعيين فوراً.")}

      ${H2("هل المنصة مجانية؟")}
      ${P("تقدم منصة حصاد الميزات الأساسية مجاناً. للاستفسار عن الخطط المتقدمة تواصل معنا عبر قسم التواصل.")}

      ${H2("هل بيانات طلابي آمنة؟")}
      ${P(`نعم. تُشفَّر جميع البيانات ولا تُشارك مع أطراف خارجية. راجع <a href="${SITE}/privacy" style="color:#14532d">سياسة الخصوصية</a> لمزيد من التفاصيل.`)}

      ${H2("لم تجد إجابة لسؤالك؟")}
      ${P(`تواصل معنا عبر <a href="${SITE}/feedback" style="color:#14532d">صفحة التواصل</a> وسنرد في أقرب وقت.`)}
    `),
  },

  // ── Games ─────────────────────────────────────────────────────────────────
  {
    path: "games",
    title: "الألعاب التعليمية | منصة حصاد — HasadX",
    description:
      "تعرّف على الألعاب التعليمية في منصة حصاد: وميض، أرينا حصاد، هاك، من سيربح المليون، شد الحبل، الكرسي الساخن، لترلي، مراقي، ولعبة الذاكرة وغيرها.",
    canonicalPath: "/games",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${SITE}/games`,
        url: `${SITE}/games`,
        name: "الألعاب التعليمية — منصة حصاد",
        description: "مجموعة ألعاب تعليمية تفاعلية جماعية وفردية باللغة العربية.",
        inLanguage: "ar",
      },
    ],
    bodyHtml: wrapRoot(`
      ${H1("الألعاب التعليمية — منصة حصاد")}
      ${P("تقدم منصة حصاد مجموعة متنوعة من الألعاب التعليمية الجماعية والفردية التي يمكن لعبها فوراً بدون تسجيل.")}

      ${H2("الألعاب الجماعية")}
      ${UL([
        "<strong>وميض / سباق المعرفة:</strong> أسئلة مباشرة على الشاشة الكبيرة والطلاب يُجيبون من هواتفهم. السرعة والدقة تحددان الفائز.",
        "<strong>أرينا حصاد (تحدي حصاد):</strong> لوحة مسابقات على شكل شبكة فئات (Jeopardy) لفريقين مع نقاط متدرجة ومساعدات استراتيجية وجمهور حي.",
        "<strong>هاك:</strong> ماراثون تنافسي سريع بأسلوب قرصنة — سرقة نقاط الخصم، صناديق غنائم، وتشويش.",
        "<strong>شد الحبل:</strong> فريقان يتنافسان بإجابات الأسئلة لتحريك الحبل.",
        "<strong>سباق الصواريخ:</strong> صواريخ الطلاب تتقدم بسرعة الإجابة ودقتها.",
        "<strong>الكرسي الساخن:</strong> طالب يُجيب على أسئلة مجهولة المصدر من زملائه والفصل يصوت.",
        "<strong>عجلة التحدي:</strong> عجلة تختار التحديات عشوائياً مع إمكانية التوليد بالذكاء الاصطناعي.",
        "<strong>اكتشف السر:</strong> أسئلة تتراكم لكشف سر مخفي — وضع تعاوني أو تنافسي مع مؤقت وصوت إنذار.",
        "<strong>من سيربح المليون؟:</strong> سلّم أسئلة تصاعدي بنقاط متزايدة ومساعدات (فردي أو فرق).",
        "<strong>الفيديو التفاعلي:</strong> فيديو يتوقف لطرح أسئلة تكوينية على الطلاب.",
      ])}

      ${H2("الألعاب الفردية")}
      ${UL([
        "<strong>مراقي:</strong> سلّم ثقافي تصاعدي بفئات متنوعة — تصاعد مستوى الصعوبة مع كل سؤال.",
        "<strong>لترلي (WORDLE عربي):</strong> خمّن الكلمة السرية من 5 أحرف بتلميحات الألوان — قابل للمشاركة اليومي.",
        "<strong>مسابقة الأعلام:</strong> اختبر معرفتك بأعلام دول العالم.",
        "<strong>عواصم العالم:</strong> تحدي جغرافي عن عواصم دول العالم.",
        "<strong>المطابقة:</strong> لعبة ذاكرة بتقليب البطاقات.",
        "<strong>لعبة الضرب:</strong> تقوية جدول الضرب بطريقة ممتعة.",
        "<strong>ستروب:</strong> لعبة تركيز وتحدٍّ للدماغ.",
        "<strong>الكلمة المبعثرة:</strong> رتّب الحروف لتكوين الكلمة.",
      ])}

      ${H2("الألعاب العامة المشتركة")}
      ${P(`يمكن لأي شخص لعب ألعاب من <a href="${SITE}/public/games" style="color:#14532d">مكتبة الأنشطة العامة</a> بدون تسجيل. الأنشطة التي ينشرها المعلمون عاماً متاحة للجميع.`)}

      ${H2("كيف تلعب مع طلابك؟")}
      ${P("سجّل حساباً، أنشئ جلسة من النشاط الذي تريده، وشارك الطلاب رمز الدخول المكوّن من 6 أرقام. يبدأ الطلاب اللعب من هواتفهم فوراً.")}
    `),
  },

  // ── Islamic ──────────────────────────────────────────────────────────────
  {
    path: "islamic",
    title: "المسابقات الإسلامية | منصة حصاد — HasadX",
    description:
      "مسابقات إسلامية في منصة حصاد: قرآن كريم، سيرة نبوية، فقه، تاريخ إسلامي، رمضان. مع شهادات إلكترونية، لوحة متصدرين، وتحديات بين الأصدقاء.",
    canonicalPath: "/islamic",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${SITE}/islamic`,
        url: `${SITE}/islamic`,
        name: "المسابقات الإسلامية — منصة حصاد",
        description:
          "مسابقات إسلامية تفاعلية: قرآن، سيرة، فقه، تاريخ إسلامي — مع شهادات ولوحة متصدرين.",
        inLanguage: "ar",
        about: [
          { "@type": "Thing", name: "القرآن الكريم" },
          { "@type": "Thing", name: "السيرة النبوية" },
          { "@type": "Thing", name: "الفقه الإسلامي" },
          { "@type": "Thing", name: "التاريخ الإسلامي" },
        ],
      },
    ],
    bodyHtml: wrapRoot(`
      ${H1("المسابقات الإسلامية — منصة حصاد")}
      ${P("قسم متخصص في منصة حصاد للمسابقات الإسلامية التفاعلية. يُتيح للمعلم إنشاء مسابقات في التربية الإسلامية، وللطالب التنافس واكتساب المعرفة بطريقة ممتعة وتنافسية.")}

      ${H2("المحتوى المتاح")}
      ${UL([
        "<strong>القرآن الكريم:</strong> حفظ، تجويد، تفسير، وأحكام التلاوة.",
        "<strong>السيرة النبوية:</strong> سيرة النبي محمد ﷺ، غزوات، صحابة، ومواقف.",
        "<strong>الفقه الإسلامي:</strong> عبادات، معاملات، وأحكام شرعية.",
        "<strong>التاريخ الإسلامي:</strong> الخلفاء الراشدون، الدولة الأموية، العباسية، والحضارة الإسلامية.",
        "<strong>رمضان والمناسبات الإسلامية:</strong> أحكام الصيام، ليلة القدر، والعبادات الموسمية.",
      ])}

      ${H2("مميزات قسم المسابقات الإسلامية")}
      ${UL([
        "مستويات متدرجة: أساسي، متقدم، خبراء — تفتح بالتدريج.",
        "سلسلة يومية (streak) لتشجيع الاستمرارية.",
        "شهادات إلكترونية عند إتمام المراحل.",
        "لوحة متصدرين محلية وعالمية.",
        "تحديات بين الأصدقاء وبطولات منظمة.",
        "نظام نجوم بناءً على السرعة والدقة.",
      ])}

      ${H2("كيف تبدأ؟")}
      ${P(`سجّل حساباً على <a href="${SITE}/register" style="color:#14532d">hasadx.com/register</a>، ادخل قسم المسابقات الإسلامية، واختر الفئة التي تريد البدء بها.`)}

      ${H2("للمعلمين")}
      ${P("يمكن للمعلمين إنشاء تحديات إسلامية مخصصة لطلابهم، ومتابعة تقدم كل طالب في المسابقات الإسلامية عبر لوحة التحكم.")}
    `),
  },
];

// ---------------------------------------------------------------------------
// HTML manipulation helpers
// ---------------------------------------------------------------------------

function setTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
}

function setMeta(html: string, attr: string, key: string, value: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(<meta\\s[^>]*${attr}="${escaped}"[^>]*content=")[^"]*("\\s*/?>)`, "i");
  const re2 = new RegExp(`(<meta\\s[^>]*content=")[^"]*("[^>]*${attr}="${escaped}"[^>]*>)`, "i");
  if (re.test(html)) return html.replace(re, `$1${value}$2`);
  if (re2.test(html)) return html.replace(re2, `$1${value}$2`);
  // Tag doesn't exist — append before </head>
  return html.replace(
    "</head>",
    `  <meta ${attr}="${key}" content="${value}">\n</head>`,
  );
}

function setCanonical(html: string, href: string): string {
  // Replace existing canonical or add one
  const re = /<link\s[^>]*rel="canonical"[^>]*>/i;
  const tag = `<link rel="canonical" href="${href}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n</head>`);
}

function injectJsonLd(html: string, schemas: object[]): string {
  if (!schemas.length) return html;
  const tags = schemas
    .map(
      (s) =>
        `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`,
    )
    .join("\n");
  // Inject before </head>
  return html.replace("</head>", `${tags}\n</head>`);
}

/**
 * Prepend static bot-readable HTML inside <div id="root"> without touching
 * the existing noscript fallback or the #hasad-splash loading screen.
 *
 * For regular users the splash overlay (position:fixed, z-index:9999) covers
 * the static content visually while the SPA boots, then React replaces all
 * children of #root on mount — so the static markup is never seen by humans.
 * AI crawlers that don't execute JS read the HTML directly and see the content.
 */
function injectRootContent(html: string, content: string): string {
  const marker = '<div id="root">';
  const idx = html.indexOf(marker);
  if (idx === -1) {
    console.warn("[prerender] WARNING: <div id=\"root\"> not found — skipping body injection.");
    return html;
  }
  const after = idx + marker.length;
  // Wrap in a visually-hidden (via inline style) div so it never flashes on
  // screen for real users.  CSS `display:none` hides it from the browser paint
  // but the raw HTML is still fully readable by crawlers.
  const wrapped = `\n<div data-prerender style="display:none" aria-hidden="true">\n${content}\n</div>`;
  return html.slice(0, after) + wrapped + html.slice(after);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(
      `[prerender] ERROR: ${TEMPLATE_PATH} not found. Run vite build first.`,
    );
    process.exit(1);
  }

  const templateHtml = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  console.log(`[prerender] Template loaded (${templateHtml.length} bytes)`);

  for (const route of routes) {
    let html = templateHtml;

    // ── Head ───────────────────────────────────────────────────────────────
    html = setTitle(html, route.title);
    html = setMeta(html, "name", "description", route.description);
    html = setCanonical(html, `${SITE}${route.canonicalPath}`);

    // OG
    const ogTitle = route.ogTitle ?? route.title;
    const ogDesc = route.ogDescription ?? route.description;
    const ogUrl = `${SITE}${route.canonicalPath}`;
    html = setMeta(html, "property", "og:title", ogTitle);
    html = setMeta(html, "property", "og:description", ogDesc);
    html = setMeta(html, "property", "og:url", ogUrl);

    // Twitter
    html = setMeta(html, "name", "twitter:title", ogTitle);
    html = setMeta(html, "name", "twitter:description", ogDesc);

    // JSON-LD
    if (route.jsonLd?.length) {
      html = injectJsonLd(html, route.jsonLd);
    }

    // ── Body ───────────────────────────────────────────────────────────────
    html = injectRootContent(html, route.bodyHtml);

    // ── Write ──────────────────────────────────────────────────────────────
    const outDir =
      route.path === ""
        ? DIST_DIR
        : path.join(DIST_DIR, route.path);

    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "index.html");
    fs.writeFileSync(outPath, html, "utf-8");

    const relPath = path.relative(process.cwd(), outPath);
    console.log(`[prerender] ✓ ${route.canonicalPath} → ${relPath}`);
  }

  console.log(`[prerender] Done — ${routes.length} routes pre-rendered.`);
}

main().catch((err) => {
  console.error("[prerender] Fatal:", err);
  process.exit(1);
});
