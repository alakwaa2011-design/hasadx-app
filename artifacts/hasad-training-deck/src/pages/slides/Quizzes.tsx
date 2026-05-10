export default function Quizzes() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-primary text-[#f7f1e3]" dir="rtl">
      <div className="absolute top-0 left-0 w-[40vw] h-full bg-[#1a4730]" />
      <div className="absolute top-[20vh] left-[8vw] w-[28vw] h-[28vw] rounded-full bg-accent/20 blur-3xl" />

      <div className="absolute top-[6vh] right-[6vw] flex items-center gap-[1vw]">
        <div className="w-[0.6vw] h-[5vh] bg-accent" />
        <span className="font-display text-[1.3vw] text-accent font-bold tracking-wide">
          ٠٣ · المسابقات
        </span>
      </div>
      <div className="absolute top-[7vh] left-[6vw] font-body text-[1.1vw] text-[#f7f1e3]/65 font-light">
        ٠٤ / ٠٦
      </div>

      <div className="absolute top-[20vh] right-[6vw] w-[42vw]">
        <div className="font-display text-[1.3vw] text-accent font-medium tracking-widest mb-[2vh]">
          مسابقات وميض التفاعلية
        </div>
        <h2 className="font-display text-[5.2vw] leading-[1] font-black tracking-tight text-balance">
          صفّك يصبح
          <span className="block text-accent">لعبة جماعية.</span>
        </h2>
        <p className="font-body text-[1.6vw] mt-[3vh] font-light leading-relaxed text-[#f7f1e3]/80 text-pretty">
          مسابقات حية يدخل إليها الطلاب برمز قصير من أي جهاز،
          وتتنافس الإجابات في الوقت ذاته على شاشة العرض.
        </p>
      </div>

      <div className="absolute top-[22vh] left-[6vw] w-[34vw] flex flex-col gap-[3vh]">
        <div className="flex items-baseline gap-[1.5vw]">
          <div className="font-display text-[3.2vw] font-black text-accent leading-none w-[5vw]">
            ٠١
          </div>
          <div>
            <div className="font-display text-[1.9vw] font-bold leading-tight">
              أنشئ المسابقة
            </div>
            <div className="font-body text-[1.3vw] text-[#f7f1e3]/70 font-light leading-snug mt-[0.5vh]">
              اختر الأسئلة يدويًا أو دع الذكاء يقترحها من الدرس.
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-[1.5vw]">
          <div className="font-display text-[3.2vw] font-black text-accent leading-none w-[5vw]">
            ٠٢
          </div>
          <div>
            <div className="font-display text-[1.9vw] font-bold leading-tight">
              شارك الرمز
            </div>
            <div className="font-body text-[1.3vw] text-[#f7f1e3]/70 font-light leading-snug mt-[0.5vh]">
              يدخل الطلاب برمز من ست خانات، بلا حسابات معقدة.
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-[1.5vw]">
          <div className="font-display text-[3.2vw] font-black text-accent leading-none w-[5vw]">
            ٠٣
          </div>
          <div>
            <div className="font-display text-[1.9vw] font-bold leading-tight">
              تابع لحظيًا
            </div>
            <div className="font-body text-[1.3vw] text-[#f7f1e3]/70 font-light leading-snug mt-[0.5vh]">
              لوحة المتصدرين والإجابات تتحدث في الوقت الحقيقي.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] right-[6vw] font-body text-[1.1vw] text-[#f7f1e3]/65 font-light">
        تُحفظ نتائج كل مسابقة في سجل الصف للرجوع إليها لاحقًا.
      </div>
    </div>
  );
}
