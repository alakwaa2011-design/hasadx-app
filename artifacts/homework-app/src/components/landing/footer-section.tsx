import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function FooterSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#173a28] text-white pt-16 pb-8" dir={dir}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img src="/images/logo-mark-transparent.png" alt="Hasaad Logo" className="h-10 w-auto" />
              <span className="text-2xl font-black tracking-wider font-display">H A S A A D X</span>
            </div>
            <p className="text-emerald-100/80 max-w-sm font-medium leading-relaxed mb-6">
              {isAr 
                ? "منصة عربية متكاملة للتعليم التفاعلي. نوفر أدوات ذكية لمساعدة المعلم على إعداد دروسه وتقديمها بطريقة ممتعة وفعالة."
                : "An integrated Arabic platform for interactive education. We provide smart tools to help teachers prepare and present lessons effectively."}
            </p>
            <div className="flex items-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground font-bold rounded-lg hover:bg-secondary/90 transition-colors">
                {isAr ? "سجل مجاناً كمعلم" : "Register Free as Teacher"}
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Link>
            </div>
          </div>

          {/* Links 1 */}
          <div>
            <h4 className="text-secondary font-bold text-lg mb-4">{isAr ? "المنصة" : "Platform"}</h4>
            <ul className="space-y-3 font-medium">
              <li><Link href="/" className="text-emerald-100/70 hover:text-white transition-colors">{isAr ? "الرئيسية" : "Home"}</Link></li>
              <li><Link href="/public/games" className="text-emerald-100/70 hover:text-white transition-colors">{isAr ? "مكتبة الأنشطة" : "Activities Library"}</Link></li>
              <li><Link href="/game/join" className="text-emerald-100/70 hover:text-white transition-colors">{isAr ? "الانضمام للعبة" : "Join Game"}</Link></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div>
            <h4 className="text-secondary font-bold text-lg mb-4">{isAr ? "دعم ومساعدة" : "Support"}</h4>
            <ul className="space-y-3 font-medium">
              <li><Link href="/faq" className="text-emerald-100/70 hover:text-white transition-colors">{isAr ? "الأسئلة الشائعة" : "FAQ"}</Link></li>
              <li><Link href="/privacy" className="text-emerald-100/70 hover:text-white transition-colors">{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</Link></li>
              <li><Link href="/terms" className="text-emerald-100/70 hover:text-white transition-colors">{isAr ? "شروط الاستخدام" : "Terms of Use"}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-emerald-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-emerald-100/50 text-sm font-medium">
          <p>© {year} Hasaad X. {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}</p>
          <div className="flex gap-4">
            <a href="https://twitter.com/hasaadx" target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors">Twitter</a>
            <a href="mailto:support@hasaad.com" className="hover:text-secondary transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
