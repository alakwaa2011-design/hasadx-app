const base = import.meta.env.BASE_URL;

export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg" dir="rtl">
      <img
        src={`${base}hero-harvest.png`}
        crossOrigin="anonymous"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/95 to-bg" />

      <div className="absolute top-[6vh] right-[6vw] flex items-center gap-[1vw]">
        <div className="w-[0.6vw] h-[5vh] bg-accent" />
        <span className="font-display text-[1.3vw] text-primary font-bold tracking-wide">
          ٠٥ · الخاتمة
        </span>
      </div>
      <div className="absolute top-[7vh] left-[6vw] font-body text-[1.1vw] text-muted font-light">
        ٠٦ / ٠٦
      </div>

      <div className="absolute top-[28vh] right-[6vw] left-[6vw]">
        <div className="font-display text-[1.4vw] text-accent font-bold tracking-widest mb-[2vh]">
          والآن… دورك
        </div>
        <h2 className="font-display text-[7vw] leading-[0.95] font-black text-primary tracking-tight text-balance">
          ابدأ صفّك الأول
          <span className="block text-accent mt-[1vh]">على حصاد اليوم.</span>
        </h2>
        <p className="font-body text-[1.9vw] text-text mt-[4vh] font-light leading-relaxed max-w-[55vw] text-pretty">
          سجّل دخولك، أنشئ صفك، وجرّب أوّل واجب أو مسابقة وميض —
          وستجد أن إدارة الصف لم تكن يومًا بهذه السهولة.
        </p>
      </div>

      <div className="absolute bottom-[10vh] right-[6vw] left-[6vw] flex justify-between items-end">
        <div>
          <div className="font-display text-[1.2vw] text-muted font-medium tracking-widest">
            للدعم والتدريب
          </div>
          <div className="font-display text-[2.4vw] text-primary font-bold mt-[0.5vh]">
            تواصل معنا عبر المنصة
          </div>
        </div>
        <div>
          <div className="font-display text-[1.2vw] text-muted font-medium tracking-widest">
            شكرًا لكم
          </div>
          <div className="font-display text-[2.4vw] text-primary font-bold mt-[0.5vh]">
            معلّمي حصاد
          </div>
        </div>
      </div>
    </div>
  );
}
