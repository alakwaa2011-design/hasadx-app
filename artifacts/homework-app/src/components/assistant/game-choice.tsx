import { trackAssistantGameStage } from "./game-analytics";

export type AssistantGameType = "solo" | "wameeth_class" | "tug" | "xo" | "wheel" | "rocket" | "hack" | "self";

const games = [
  { id: "solo", ar: "وميض فردي — على الأجهزة", en: "Wameeth individual — on devices", descriptionAr: "كل طالب يلعب ويجيب فرديًا من جهازه.", descriptionEn: "Each student plays and answers individually on their own device." },
  { id: "wameeth_class", ar: "وميض الصف — فريقان", en: "Wameeth classroom — two teams", descriptionAr: "فريقان يتنافسان على شاشة الصف المشتركة.", descriptionEn: "Two teams compete on the shared classroom screen." },
  { id: "tug", ar: "شد الحبل", en: "Tug of war", descriptionAr: "فريقان يتنافسان بالإجابات الصحيحة لسحب الحبل.", descriptionEn: "Two teams pull the rope by answering correctly." },
  { id: "xo", ar: "إكس أو", en: "XO", descriptionAr: "فريقان يتنافسان على الشبكة؛ 9 أسئلة على الأقل.", descriptionEn: "Two teams compete on the grid; at least 9 questions." },
  { id: "wheel", ar: "عجلة التحدي", en: "Challenge wheel", descriptionAr: "عجلة أسئلة للصف؛ من سؤالين إلى 16 سؤالًا.", descriptionEn: "A classroom question wheel with 2–16 questions." },
  { id: "rocket", ar: "سباق الصواريخ", en: "Rocket race", descriptionAr: "يتسابق الطلاب بالإجابات الصحيحة من أجهزتهم.", descriptionEn: "Students race by answering correctly on their devices." },
  { id: "hack", ar: "لعبة الاختراق", en: "Hack game", descriptionAr: "منافسة كلمات سر وأسئلة؛ تُجهّز للمراجعة قبل التشغيل.", descriptionEn: "A password-and-question competition, prepared for review before launch." },
  { id: "self", ar: "مسابقة ذاتية", en: "Self-paced challenge", descriptionAr: "مسابقة يفتحها الطالب ويكملها في وقته.", descriptionEn: "A challenge students open and complete at their own pace." },
] as const;

/** Detect a new game request, not a game mentioned inside a worksheet request. */
export function requestsAssistantGame(message: string) {
  return /^(?:(?:أريد|اريد|أحتاج|احتاج|أنشئ|انشئ|اصنع|اعمل|أعد|اعد|جهز|حضر|بدلها|غيرها|حولها|create|make|prepare|I want|I need)\s+)?(?:(?:أن|ان)\s+)?(?:(?:تنشئ|تصنع|تجهز|تعد)\s+)?(?:(?:لي|me)\s+)?(?:(?:إلى|الى|to|a|an)\s+)?(?:لعبة|game)(?=\s|$|[،,.!؟?:])/i.test(message.replace(/[\u064B-\u065F\u0670]/g, "").trim());
}

export function AssistantGameChoice({ ar, selected, disabled, onSelect }: {
  ar: boolean;
  selected: AssistantGameType | null;
  disabled: boolean;
  onSelect: (game: AssistantGameType) => void;
}) {
  return <section className="rounded-xl border border-border bg-card p-3 space-y-2 text-start" data-testid="panel-assistant-game-choice">
    <h3 className="text-xs font-bold">{ar ? "اختر اللعبة أولًا" : "Choose a game first"}</h3>
    <p className="text-[11px] text-muted-foreground">{ar ? "سأصيغ المحتوى حسب اللعبة التي تختارها، دون تشغيلها تلقائيًا." : "I'll tailor the content to your choice, without starting the game."}</p>
    <div className="space-y-1.5" role="group" aria-label={ar ? "اللعبة المختارة" : "Selected game"}>
      {games.map(game => <button key={game.id} type="button" disabled={disabled} aria-pressed={selected === game.id}
        onClick={() => {
          onSelect(game.id);
          if (selected !== game.id) trackAssistantGameStage(game.id, "selected");
        }} data-testid={`button-assistant-game-${game.id}`}
        className={`w-full flex items-center gap-2.5 rounded-lg border p-2.5 text-start transition-colors disabled:opacity-50 ${selected === game.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
        <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${selected === game.id ? "border-primary" : "border-muted-foreground/40"}`}>
          {selected === game.id && <span className="h-2 w-2 rounded-full bg-primary" />}
        </span>
        <span className="min-w-0"><span className="block text-xs font-bold">{ar ? game.ar : game.en}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">{ar ? game.descriptionAr : game.descriptionEn}</span>
        </span>
      </button>)}
    </div>
    {!selected && <p className="text-[10px] text-muted-foreground" role="status">{ar ? "اختر لعبة، ثم أرسل الموضوع والصف." : "Choose a game, then send the topic and grade."}</p>}
  </section>;
}
