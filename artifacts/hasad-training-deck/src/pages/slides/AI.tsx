export default function AI() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg" dir="rtl">
      <div className="absolute top-0 right-0 w-full h-[42vh] bg-bg-deep" />
      <div className="absolute top-[42vh] right-0 w-full h-[1px] bg-line" />

      <div className="absolute top-[6vh] right-[6vw] flex items-center gap-[1vw]">
        <div className="w-[0.6vw] h-[5vh] bg-accent" />
        <span className="font-display text-[1.3vw] text-primary font-bold tracking-wide">
          ٠٤ · الذكاء الاصطناعي
        </span>
      </div>
      <div className="absolute top-[7vh] left-[6vw] font-body text-[1.1vw] text-muted font-light">
        ٠٥ / ٠٦
      </div>

      <div className="absolute top-[16vh] right-[6vw] left-[6vw]">
        <div className="font-display text-[1.3vw] text-accent font-bold tracking-widest mb-[1.5vh]">
          مساعدك الذكي · ثلاث مستويات
        </div>
        <h2 className="font-display text-[5vw] leading-[1] font-black text-primary tracking-tight text-balance">
          اختر القوة المناسبة لكل مهمة.
        </h2>
      </div>

      <div className="absolute top-[52vh] right-[6vw] left-[6vw] grid grid-cols-3 gap-[2.5vw]">
        <div className="bg-bg p-[3vh_2vw] border border-line">
          <div className="font-display text-[1.4vw] font-bold text-muted tracking-widest">
            المستوى الأول
          </div>
          <div className="font-display text-[3vw] font-black text-primary mt-[1vh] leading-none">
            القياسي
          </div>
          <div className="w-[3vw] h-[2px] bg-line my-[2vh]" />
          <p className="font-body text-[1.4vw] text-text font-light leading-relaxed text-pretty">
            توليد سريع للأسئلة وأوصاف الواجبات بقوالب وألوان جاهزة — للمهمات اليومية.
          </p>
        </div>

        <div className="bg-bg p-[3vh_2vw] border-2 border-accent relative">
          <div className="absolute -top-[1.8vh] right-[2vw] bg-accent px-[1vw] py-[0.4vh] font-display text-[1.1vw] font-bold text-primary">
            الأكثر استخدامًا
          </div>
          <div className="font-display text-[1.4vw] font-bold text-accent tracking-widest">
            المستوى الثاني
          </div>
          <div className="font-display text-[3vw] font-black text-primary mt-[1vh] leading-none">
            المتقدّم
          </div>
          <div className="w-[3vw] h-[2px] bg-accent my-[2vh]" />
          <p className="font-body text-[1.4vw] text-text font-light leading-relaxed text-pretty">
            تصميم حر لكل شريحة مع صور تُولَّد خصيصًا للدرس — لعروض احترافية مميزة.
          </p>
        </div>

        <div className="bg-primary text-[#f7f1e3] p-[3vh_2vw] border border-primary">
          <div className="font-display text-[1.4vw] font-bold text-accent tracking-widest">
            المستوى الثالث
          </div>
          <div className="font-display text-[3vw] font-black mt-[1vh] leading-none">
            المتميّز
          </div>
          <div className="w-[3vw] h-[2px] bg-accent my-[2vh]" />
          <p className="font-body text-[1.4vw] font-light leading-relaxed text-[#f7f1e3]/85 text-pretty">
            كل ما سبق، مع رسوم توضيحية متجهية وتحليل أعمق للمحتوى — للدروس الكبرى.
          </p>
        </div>
      </div>
    </div>
  );
}
