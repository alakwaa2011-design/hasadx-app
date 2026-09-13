import { Frame, Panel, Label, Bullet } from "../../components/deck-components";

export default function Slide11() {
  return (
    <Frame title="نشاط الكتاب: أكتب وأشارك" number="١١">
      <div className="grid h-full grid-cols-[1fr_0.9fr] items-center gap-[3vw]">
        <Panel tone="cream" className="space-y-[2.4vh]">
          <Label tone="plum">مؤشر الأداء: الكتابة</Label>
          <p className="text-[2vw] font-bold">سجّل بعضًا من آداب ذكر الله تعالى:</p>
          <div className="space-y-[2vh] text-[2vw] text-[#6e7d74]">
            <div className="border-b-[0.18vw] border-dashed border-[#8b5a9d] pb-[1vh]">____________________</div>
            <div className="border-b-[0.18vw] border-dashed border-[#8b5a9d] pb-[1vh]">____________________</div>
            <div className="border-b-[0.18vw] border-dashed border-[#8b5a9d] pb-[1vh]">____________________</div>
          </div>
        </Panel>
        <Panel tone="gold" className="flex flex-col justify-center">
          <div className="text-[2.5vw] font-black text-[#9a7120]">تحدي المجموعة</div>
          <Bullet tone="gold">اكتبوا أكبر عدد من الآداب الصحيحة خلال دقيقة.</Bullet>
          <Bullet tone="gold">قارنوا إجاباتكم بالقائمة.</Bullet>
        </Panel>
      </div>
    </Frame>
  );
}