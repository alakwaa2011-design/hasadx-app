import { Frame, Panel, Bullet, Label } from "../../components/deck-components";

export default function Slide09() {
  return (
    <Frame title="نشاط الكتاب: أفهم وأستنتج" number="٠٩">
      <div className="grid h-full grid-cols-2 gap-[2.5vw]">
        <Panel tone="cream" className="space-y-[2vh]">
          <Label tone="plum">أفهم</Label>
          <Bullet tone="plum">رُدَّ معنى ذكر الله تعالى ثم اكتبه لتحفظه.</Bullet>
          <div className="mt-[3vh] rounded-[1.5vw] bg-[#f0e6f3] p-[1.6vw] text-[1.8vw] font-bold leading-relaxed text-[#5b326d]">ذكر الله: هو التلفظ بالثناء عليه واستحضار شكره بالقلب.</div>
        </Panel>
        <Panel tone="green" className="space-y-[2vh]">
          <Label tone="green">أستنتج</Label>
          <Bullet>استنتج وجه الشبه من الحديث النبوي.</Bullet>
          <div className="space-y-[2vh] pt-[2vh] text-[1.9vw] font-bold">
            <div>الذي يذكر ربه مثل <span className="border-b-[0.18vw] border-dashed border-[#1f6f4a] px-[3vw]">________</span>.</div>
            <div>والذي لا يذكر ربه مثل <span className="border-b-[0.18vw] border-dashed border-[#1f6f4a] px-[3vw]">________</span>.</div>
          </div>
          <div className="pt-[2vh] text-[1.45vw] font-bold text-[#6e7d74]">استراتيجية: فكر فرديًا، ثم ناقش إجابتك مع مجموعتك.</div>
        </Panel>
      </div>
    </Frame>
  );
}