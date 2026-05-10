export default function Homework() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg" dir="rtl">
      <div className="absolute top-[6vh] right-[6vw] flex items-center gap-[1vw]">
        <div className="w-[0.6vw] h-[5vh] bg-accent" />
        <span className="font-display text-[1.3vw] text-primary font-bold tracking-wide">
          ٠٢ · الواجبات
        </span>
      </div>
      <div className="absolute top-[7vh] left-[6vw] font-body text-[1.1vw] text-muted font-light">
        ٠٣ / ٠٦
      </div>

      <div className="absolute top-[16vh] right-[6vw] left-[6vw]">
        <h2 className="font-display text-[5vw] leading-[1] font-black text-primary tracking-tight text-balance">
          أنشئ واجبًا في أربع خطوات.
        </h2>
        <p className="font-body text-[1.7vw] text-muted mt-[2vh] font-light max-w-[60vw] text-pretty">
          من الفكرة إلى يد الطالب — العملية كاملة لا تستغرق دقائق.
        </p>
      </div>

      <div className="absolute top-[44vh] right-[6vw] left-[6vw] grid grid-cols-4 gap-[2vw]">
        <div className="border-t-[3px] border-accent pt-[3vh]">
          <div className="font-display text-[2vw] font-black text-accent">٠١</div>
          <div className="font-display text-[2.2vw] font-bold text-primary mt-[1.5vh] leading-tight">
            افتح صفك
          </div>
          <p className="font-body text-[1.4vw] text-text mt-[1.5vh] font-light leading-relaxed text-pretty">
            اختر الصف الذي تريد تكليفه ثم اضغط «واجب جديد».
          </p>
        </div>

        <div className="border-t-[3px] border-accent pt-[3vh]">
          <div className="font-display text-[2vw] font-black text-accent">٠٢</div>
          <div className="font-display text-[2.2vw] font-bold text-primary mt-[1.5vh] leading-tight">
            اكتب التعليمات
          </div>
          <p className="font-body text-[1.4vw] text-text mt-[1.5vh] font-light leading-relaxed text-pretty">
            عنوان الواجب، الوصف، تاريخ التسليم، والمرفقات إن وُجدت.
          </p>
        </div>

        <div className="border-t-[3px] border-accent pt-[3vh]">
          <div className="font-display text-[2vw] font-black text-accent">٠٣</div>
          <div className="font-display text-[2.2vw] font-bold text-primary mt-[1.5vh] leading-tight">
            استعن بالذكاء
          </div>
          <p className="font-body text-[1.4vw] text-text mt-[1.5vh] font-light leading-relaxed text-pretty">
            دع الذكاء الاصطناعي يقترح أسئلة أو يصيغ الوصف نيابةً عنك.
          </p>
        </div>

        <div className="border-t-[3px] border-accent pt-[3vh]">
          <div className="font-display text-[2vw] font-black text-accent">٠٤</div>
          <div className="font-display text-[2.2vw] font-bold text-primary mt-[1.5vh] leading-tight">
            انشر للطلاب
          </div>
          <p className="font-body text-[1.4vw] text-text mt-[1.5vh] font-light leading-relaxed text-pretty">
            اضغط نشر، فيصل الواجب فورًا لكل طلاب الصف.
          </p>
        </div>
      </div>

      <div className="absolute bottom-[5vh] right-[6vw] font-body text-[1.1vw] text-muted font-light">
        كل واجب يُحفظ تلقائيًا — يمكنك تعديله أو إعادة استخدامه لاحقًا.
      </div>
    </div>
  );
}
