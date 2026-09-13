import { Frame, Panel, Label, Bullet } from "../../components/deck-components";
import { page34, page35, page36, page37, page38, page39, page40, page41, page42 } from "./book-assets";

export default function Slide18() {
  return (
    <Frame title="أقوّم تعلمي" number="١٨">
      <div className="grid h-full grid-cols-[1.1fr_0.9fr] gap-[2.5vw]">
        <Panel tone="plum" className="space-y-[1.2vh]">
          <Label tone="plum">أكمل العبارات</Label>
          <Bullet tone="plum">ذكر الله هو ____________________.</Bullet>
          <Bullet tone="plum">من آداب الذكر ____________________.</Bullet>
          <Bullet tone="plum">من فضائل الذكر ____________________.</Bullet>
          <Bullet tone="plum">من الأوقات التي يستحب فيها الدعاء ____________________.</Bullet>
          <div className="mt-[1.5vh] space-y-[0.5vh] text-[1.55vw] font-bold leading-relaxed">
            <div>أكتب الحديث النبوي: «مثل الذي يذكر ربه...».</div>
            <div>أسجل ثلاثة أوقات يستحب فيها الدعاء.</div>
            <div>أكمل الشكل: فضائل الذكر.</div>
          </div>
          <div className="mt-[1vh] space-y-[0.35vh] border-t-[0.15vw] border-[#c8a8d2] pt-[1.3vh] text-[1.5vw] font-bold text-[#5b326d]">
            <div>بطاقة الخروج: معلومة جديدة تعلمتها اليوم: __________</div>
            <div>ذكر سأحافظ عليه: __________</div>
            <div>أدب سأطبقه في مجلس الذكر: __________</div>
            <div>سؤال ما زال في ذهني: __________</div>
          </div>
        </Panel>
        <Panel tone="cream" className="flex flex-col justify-between">
          <div>
            <Label tone="green">من صفحات الكتاب</Label>
            <p className="mt-[1vh] text-[1.35vw] font-bold text-[#6e7d74]">مرجع الدرس والأنشطة من الصفحات ٣٤–٤٢</p>
          </div>
          <div className="grid grid-cols-3 gap-[0.65vw]">
            <img src={page34} crossOrigin="anonymous" alt="صفحة 34" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page35} crossOrigin="anonymous" alt="صفحة 35" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page36} crossOrigin="anonymous" alt="صفحة 36" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page37} crossOrigin="anonymous" alt="صفحة 37" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page38} crossOrigin="anonymous" alt="صفحة 38" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page39} crossOrigin="anonymous" alt="صفحة 39" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page40} crossOrigin="anonymous" alt="صفحة 40" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page41} crossOrigin="anonymous" alt="صفحة 41" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
            <img src={page42} crossOrigin="anonymous" alt="صفحة 42" className="h-[10vh] w-full rounded-[0.6vw] object-cover" />
          </div>
          <div className="rounded-[1.4vw] bg-[#1f6f4a] p-[1.5vw] text-center text-[1.7vw] font-black text-[#fffaf0]">بذكر الله تطمئن القلوب.</div>
        </Panel>
      </div>
    </Frame>
  );
}