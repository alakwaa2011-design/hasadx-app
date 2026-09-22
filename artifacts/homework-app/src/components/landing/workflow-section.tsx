import { useI18n } from "@/lib/i18n";
import { Pencil, Share2, PlayCircle } from "lucide-react";

export function WorkflowSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  
  return (
    <section className="py-16 md:py-28 bg-primary/5" dir={dir}>
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
            {isAr ? "أدوات تساعدك في كل خطوة" : "Tools to help you every step"}
          </h2>
        </div>
        
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-12 md:gap-4 relative">
          {/* Connector line for desktop */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border z-0" />
          
          <div className="flex flex-col items-center text-center relative z-10 w-full md:w-1/3">
            <div className="w-24 h-24 rounded-full bg-card border-4 border-background shadow-xl flex items-center justify-center mb-6 relative hover:scale-105 transition-transform duration-300">
              <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center text-sm shadow-md">1</span>
              <Pencil className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{isAr ? "أنشئ النشاط" : "Create Activity"}</h3>
            <p className="text-muted-foreground font-medium">{isAr ? "اختر قالباً أو استخدم الذكاء الاصطناعي" : "Choose a template or use AI"}</p>
          </div>
          
          <div className="flex flex-col items-center text-center relative z-10 w-full md:w-1/3">
            <div className="w-24 h-24 rounded-full bg-card border-4 border-background shadow-xl flex items-center justify-center mb-6 relative hover:scale-105 transition-transform duration-300">
              <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center text-sm shadow-md">2</span>
              <Share2 className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{isAr ? "شارك الرابط" : "Share Link"}</h3>
            <p className="text-muted-foreground font-medium">{isAr ? "أرسل الرمز أو الرابط لطلابك" : "Send the code or link to students"}</p>
          </div>
          
          <div className="flex flex-col items-center text-center relative z-10 w-full md:w-1/3">
            <div className="w-24 h-24 rounded-full bg-card border-4 border-background shadow-xl flex items-center justify-center mb-6 relative hover:scale-105 transition-transform duration-300">
              <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center text-sm shadow-md">3</span>
              <PlayCircle className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{isAr ? "إبدأ التفاعل" : "Start Interaction"}</h3>
            <p className="text-muted-foreground font-medium">{isAr ? "تابع إجاباتهم مباشرة على الشاشة" : "Watch their answers live on screen"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
