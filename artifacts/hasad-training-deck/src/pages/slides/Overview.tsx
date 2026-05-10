export default function Overview() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg" dir="rtl">
      <div className="absolute top-0 right-0 w-[35vw] h-full bg-bg-deep" />
      <div className="absolute top-0 left-[35vw] w-[1px] h-full bg-line" />

      <div className="absolute top-[6vh] right-[6vw] flex items-center gap-[1vw]">
        <div className="w-[0.6vw] h-[5vh] bg-accent" />
        <span className="font-display text-[1.3vw] text-primary font-bold tracking-wide">
          ٠١ · مقدمة
        </span>
      </div>

      <div className="absolute top-[22vh] right-[6vw] w-[26vw]">
        <div className="font-display text-[1.3vw] text-muted font-medium tracking-widest mb-[2vh]">
          ما هي منصة حصاد؟
        </div>
        <h2 className="font-display text-[4.8vw] leading-[1] font-black text-primary tracking-tight text-balance">
          صفّك الرقمي،
          <span className="block text-accent mt-[1vh]">في مكان واحد.</span>
        </h2>
      </div>

      <div className="absolute top-[18vh] left-[6vw] w-[48vw]">
        <p className="font-body text-[2.1vw] leading-[1.55] font-light text-text text-pretty">
          منصة حصاد بيئة تعليمية متكاملة باللغة العربية تُمكّن المعلم من إدارة صفه،
          وإنشاء الواجبات، وتنظيم المسابقات التفاعلية، ومتابعة أداء الطلاب
          بسهولة — مع شريك ذكي يُساعدك في كل خطوة.
        </p>

        <div className="mt-[6vh] grid grid-cols-3 gap-[2vw]">
          <div>
            <div className="font-display text-[3.6vw] text-primary font-black leading-none">
              واجبات
            </div>
            <div className="font-body text-[1.3vw] text-muted mt-[1vh] font-medium">
              إنشاء وتصحيح ومتابعة
            </div>
          </div>
          <div>
            <div className="font-display text-[3.6vw] text-primary font-black leading-none">
              مسابقات
            </div>
            <div className="font-body text-[1.3vw] text-muted mt-[1vh] font-medium">
              وميض التفاعلية المباشرة
            </div>
          </div>
          <div>
            <div className="font-display text-[3.6vw] text-primary font-black leading-none">
              ذكاء
            </div>
            <div className="font-body text-[1.3vw] text-muted mt-[1vh] font-medium">
              يساعدك ويوفّر وقتك
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] right-[6vw] left-[6vw] flex justify-between items-end">
        <div className="font-body text-[1.1vw] text-muted font-light">
          منصة حصاد · دورة تدريبية للمعلمين
        </div>
        <div className="font-body text-[1.1vw] text-muted font-light">
          ٠٢ / ٠٦
        </div>
      </div>
    </div>
  );
}
