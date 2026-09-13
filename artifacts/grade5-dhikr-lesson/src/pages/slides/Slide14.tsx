import { Frame, Panel, Label, Quote, Bullet } from "../../components/deck-components";

export default function Slide14() {
  return (
    <Frame title="نشاط التثبيت: أستمع وأقرأ" number="١٤">
      <div className="grid h-full grid-cols-2 gap-[2.5vw]">
        <Panel tone="green" className="space-y-[2vh]">
          <Label tone="green">مؤشر الأداء: الاستماع والقراءة</Label>
          <Bullet>أستمع إلى الدعاء ثم أقرأه قراءة صحيحة.</Bullet>
          <Bullet>أثبت من حفظ الدعاء خلال قراءتي مع مجموعتي.</Bullet>
          <div className="mt-[3vh] rounded-[1.5vw] bg-[#fffaf0] p-[1.5vw] text-[1.65vw] font-bold leading-relaxed text-[#1f6f4a]">مهمة ثنائية: يصحح كل طالب قراءة زميله بلطف.</div>
        </Panel>
        <Quote reference="الدعاء">
          سبحان الله وبحمده، عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته.
        </Quote>
      </div>
    </Frame>
  );
}