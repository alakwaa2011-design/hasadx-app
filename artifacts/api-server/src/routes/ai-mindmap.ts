import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const MAX_TOPIC_LENGTH = 400;

const BRANCH_COLORS = [
  "#4F46E5",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#EA580C",
  "#0284C7",
];

router.post("/ai/generate-mindmap", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const { topic, lang = "ar", depth = "standard" } = req.body;

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({ message: "يجب إدخال موضوع الخريطة الذهنية" });
    return;
  }

  if (topic.trim().length > MAX_TOPIC_LENGTH) {
    res.status(400).json({
      message: `الموضوع طويل جداً (الحد الأقصى ${MAX_TOPIC_LENGTH} حرف)`,
    });
    return;
  }

  const isAr = lang !== "en";
  const branchRange = depth === "detailed" ? "6 إلى 8" : "4 إلى 6";
  const childRange = depth === "detailed" ? "3 إلى 5" : "2 إلى 4";

  const systemPrompt = isAr
    ? `أنت خبير تعليمي متخصص في بناء الخرائط الذهنية. مهمتك إنشاء خرائط ذهنية منظمة وشاملة.
قواعد صارمة:
- أجب بـ JSON صالح فقط — لا نص إضافي خارج JSON
- العناوين مختصرة وواضحة (2-5 كلمات لكل عنصر)
- الفروع متنوعة تغطي جوانب مختلفة من الموضوع
- اختر رمزاً تعبيرياً (emoji) مناسباً لكل فرع رئيسي`
    : `You are an expert educational mind map creator. Create structured, comprehensive mind maps.
Strict rules:
- Respond with valid JSON ONLY — no text outside JSON
- Labels are concise (2-5 words per item)
- Branches are diverse and cover different aspects
- Choose an appropriate emoji for each main branch`;

  const userPrompt = isAr
    ? `أنشئ خريطة ذهنية تعليمية شاملة عن: "${topic.trim()}"
تحتوي على ${branchRange} فروع رئيسية، وكل فرع يحتوي على ${childRange} أفكار فرعية.

أعد JSON بهذا الشكل بالضبط:
{
  "center": "عنوان مختصر للموضوع",
  "branches": [
    {
      "label": "اسم الفرع",
      "icon": "🔤",
      "children": ["فكرة 1", "فكرة 2", "فكرة 3"]
    }
  ]
}`
    : `Create a comprehensive educational mind map about: "${topic.trim()}"
Include ${branchRange} main branches, each with ${childRange} sub-ideas.

Return ONLY this exact JSON:
{
  "center": "Short Topic Title",
  "branches": [
    {
      "label": "Branch Name",
      "icon": "🔤",
      "children": ["idea 1", "idea 2", "idea 3"]
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1800,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      req.log.error({ raw }, "Mind map: invalid JSON from AI");
      res.status(500).json({ message: "خطأ في تنسيق الاستجابة، يرجى المحاولة مجدداً" });
      return;
    }

    const rawBranches = Array.isArray(parsed.branches) ? parsed.branches : [];
    const branches = rawBranches.slice(0, 8).map((b: unknown, i: number) => {
      const branch = b as Record<string, unknown>;
      return {
        label: String(branch.label ?? ""),
        icon: String(branch.icon ?? ""),
        color: BRANCH_COLORS[i % BRANCH_COLORS.length],
        children: (Array.isArray(branch.children) ? branch.children : [])
          .slice(0, 5)
          .map(String)
          .filter((s) => s.trim().length > 0),
      };
    }).filter((b) => b.label.trim().length > 0);

    res.json({
      center: String(parsed.center ?? topic.trim()).slice(0, 60),
      branches,
    });
  } catch (err) {
    req.log.error({ err }, "Mind map generation failed");
    res.status(500).json({ message: "فشل توليد الخريطة الذهنية، يرجى المحاولة مجدداً" });
  }
});

export default router;
