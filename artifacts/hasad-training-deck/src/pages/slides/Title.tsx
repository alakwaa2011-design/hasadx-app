const base = import.meta.env.BASE_URL;

export default function Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg" dir="rtl">
      <img
        src={`${base}hero-harvest.png`}
        crossOrigin="anonymous"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-[#1f5538]/85 via-[#1f5538]/55 to-[#1f5538]/15" />

      <div className="absolute top-[6vh] right-[6vw] flex items-center gap-[1.2vw]">
        <div className="w-[1.1vw] h-[1.1vw] rounded-full bg-accent" />
        <span className="font-display text-[1.4vw] tracking-wide text-[#f7f1e3]/85 font-medium">
          منصة حصاد التعليمية
        </span>
      </div>

      <div className="absolute top-[6vh] left-[6vw] font-display text-[1.2vw] text-[#f7f1e3]/70 font-light">
        دورة تدريبية · ٢٠٢٦
      </div>

      <div className="absolute bottom-[12vh] right-[6vw] max-w-[60vw]">
        <div className="font-display text-[1.5vw] text-accent font-medium tracking-widest mb-[2.5vh]">
          الدورة التدريبية للمعلمين
        </div>
        <h1 className="font-display text-[7.5vw] leading-[0.95] font-black text-[#f7f1e3] tracking-tight text-balance">
          منصة حصاد
        </h1>
        <p className="font-body text-[2vw] text-[#f7f1e3]/85 mt-[3vh] font-light leading-relaxed max-w-[50vw] text-pretty">
          من إنشاء الواجبات إلى مسابقات وميض التفاعلية — تعلَّم كيف تدير صفك بذكاء.
        </p>
      </div>

      <div className="absolute bottom-[5vh] right-[6vw] left-[6vw] flex justify-between items-end">
        <div className="font-body text-[1.2vw] text-[#f7f1e3]/65 font-light">
          ست شرائح · شرح متكامل
        </div>
        <div className="font-body text-[1.2vw] text-[#f7f1e3]/65 font-light">
          منصة حصاد التعليمية
        </div>
      </div>
    </div>
  );
}
