import { Bullet, Frame, Panel, Label } from "../../components/deck-components";

export default function Slide03() {
  return (
    <Frame title="ماذا سأتعلّم؟" number="٠٣">
      <div className="grid h-full grid-cols-[1.3fr_0.7fr] gap-[3vw]">
        <Panel tone="cream" className="space-y-[1vh]">
          <Bullet>أقرأ الحديث النبوي قراءة سليمة.</Bullet>
          <Bullet>أتعرف معنى ذكر الله تعالى.</Bullet>
          <Bullet>أتعرف آداب ذكر الله تعالى.</Bullet>
          <Bullet>أتعرف فضل ذكر الله تعالى ومجالسه.</Bullet>
          <Bullet>أحدد الأوقات التي يستحب فيها الذكر ويستجاب بها الدعاء.</Bullet>
          <Bullet>أردد الأذكار وأحفظ الدعاء وأصمم بطاقة أذكار.</Bullet>
        </Panel>
        <div className="flex flex-col justify-center rounded-[2vw] bg-[#1f6f4a] p-[3vw] text-center text-[#fffaf0]">
          <Label tone="gold">قيمة الدرس</Label>
          <div className="mt-[3vh] text-[3.5vw] font-black leading-tight">ذكر الله تعالى</div>
          <div className="mx-auto mt-[4vh] h-[8vw] w-[8vw] rounded-full border-[0.5vw] border-[#f2d18a] p-[1.2vw] text-[4vw] text-[#f2d18a]">ذ</div>
        </div>
      </div>
    </Frame>
  );
}