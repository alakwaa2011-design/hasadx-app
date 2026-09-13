import { Frame, IconTile, Panel } from "../../components/deck-components";

export default function Slide07() {
  return (
    <Frame title="آداب ذكر الله تعالى" number="٠٧">
      <div className="grid h-full grid-cols-3 gap-[1.5vw]">
        <IconTile symbol="ط" label="الطهارة" tone="green" />
        <IconTile symbol="خ" label="الإخلاص والمتابعة" tone="plum" />
        <IconTile symbol="د" label="الاستعانة بالله" tone="gold" />
        <IconTile symbol="ص" label="الإسرار وخفض الصوت" tone="plum" />
        <IconTile symbol="ق" label="حضور القلب" tone="green" />
        <Panel tone="gold" className="flex flex-col items-center justify-center text-center"><div className="text-[3.5vw] font-black text-[#9a7120]">خشوع</div><div className="mt-[1vh] text-[1.65vw] font-bold">الخشوع والخضوع</div><div className="mt-[2vh] text-[1.25vw]">نشاط سريع: اختر أدبًا واحدًا واذكر موقفًا تطبقه فيه.</div></Panel>
      </div>
    </Frame>
  );
}