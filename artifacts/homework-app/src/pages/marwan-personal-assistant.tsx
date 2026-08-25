import { CalendarDays, LockKeyhole, MessageCircleOff, ShieldCheck } from "lucide-react";
import { useSeo } from "@/lib/seo";

const colors = {
  green: "#0B4B35",
  gold: "#D9AA25",
  ivory: "#FBF8EF",
  ink: "#173C2D",
  muted: "#5F6E64",
  border: "#E8E1D2",
};

export default function MarwanPersonalAssistantPage() {
  useSeo({
    title: "Marwan Personal Assistant",
    description: "مساعد شخصي خاص لمروان الأكوع لتنظيم المواعيد والتواصل الشخصي.",
    canonicalPath: "/marwan-personal-assistant",
  });

  return (
    <div
      data-testid="marwan-assistant-page"
      lang="ar"
      dir="rtl"
      className="min-h-screen overflow-hidden"
      style={{
        backgroundColor: colors.ivory,
        color: colors.ink,
        fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
      }}
    >
      <div className="relative isolate min-h-screen">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(217,170,37,0.13)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(11,75,53,0.10)" }}
        />

        <main
          aria-labelledby="marwan-assistant-title"
          className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-12 sm:px-8 lg:px-12"
        >
          <div className="w-full">
            <header className="mx-auto max-w-2xl text-center">
              <div
                className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
                style={{
                  backgroundColor: colors.green,
                  boxShadow: "0 14px 32px rgba(11,75,53,0.18)",
                }}
                aria-hidden="true"
              >
                <span className="text-3xl font-black" style={{ color: colors.gold }}>
                  M
                </span>
              </div>
              <p
                className="mb-4 text-xs font-bold uppercase tracking-[0.24em]"
                style={{ color: colors.gold }}
              >
                Private personal assistant
              </p>
              <h1
                id="marwan-assistant-title"
                data-testid="text-marwan-assistant-title"
                className="text-3xl font-black tracking-tight sm:text-5xl"
                style={{ color: colors.green }}
              >
                Marwan Personal Assistant
              </h1>
              <p
                data-testid="text-marwan-assistant-description"
                className="mx-auto mt-5 max-w-xl text-base leading-8 sm:text-lg"
                style={{ color: colors.muted }}
              >
                مساعد شخصي خاص لمروان الأكوع لتنظيم المواعيد والتواصل الشخصي.
              </p>
            </header>

            <section
              aria-label="معلومات الصفحة"
              className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3"
            >
              <InfoCard
                icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
                text="تنظيم المواعيد"
              />
              <InfoCard
                icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
                text="وحدة خاصة وآمنة"
              />
              <InfoCard
                icon={<MessageCircleOff aria-hidden="true" className="h-5 w-5" />}
                text="لا رسائل مفعّلة"
              />
            </section>

            <section
              data-testid="marwan-assistant-information"
              className="mx-auto mt-6 max-w-3xl rounded-3xl border bg-white/75 p-6 shadow-[0_18px_50px_rgba(23,60,45,0.08)] backdrop-blur-sm sm:p-9"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(217,170,37,0.16)", color: colors.green }}
                  aria-hidden="true"
                >
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div className="space-y-6 leading-8">
                  <div>
                    <h2 className="text-lg font-extrabold" style={{ color: colors.green }}>
                      صفحة تعريفية فقط
                    </h2>
                    <p className="mt-2 text-sm sm:text-base" style={{ color: colors.muted }}>
                      هذه الصفحة تعريفية فقط، ولا تتضمن تسجيل دخول أو نماذج تواصل أو جمع بيانات أو تفعيل رسائل أو ذكاء اصطناعي.
                    </p>
                  </div>
                  <div className="border-t pt-5" style={{ borderColor: colors.border }}>
                    <h2 className="text-lg font-extrabold" style={{ color: colors.green }}>
                      الخصوصية
                    </h2>
                    <p
                      data-testid="text-marwan-assistant-privacy"
                      className="mt-2 text-sm sm:text-base"
                      style={{ color: colors.muted }}
                    >
                      لا يتم جمع أو مشاركة أي معلومات شخصية عبر هذه الصفحة.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <p
              data-testid="text-marwan-assistant-footer-note"
              className="mt-8 text-center text-xs font-medium"
              style={{ color: "#849187" }}
            >
              صفحة مستقلة للتعريف بالخدمة الخاصة
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      data-testid={`info-card-${text}`}
      className="flex items-center justify-center gap-2 rounded-2xl border bg-white/55 px-4 py-4 text-sm font-bold shadow-sm"
      style={{ borderColor: colors.border, color: colors.green }}
    >
      <span style={{ color: colors.gold }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}