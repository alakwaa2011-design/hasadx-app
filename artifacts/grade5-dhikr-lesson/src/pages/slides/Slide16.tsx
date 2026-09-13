import { Frame, IconTile, Panel } from "../../components/deck-components";

export default function Slide16() {
  return (
    <Frame title="أوقات يستحب فيها الذكر ويستجاب فيها الدعاء" number="١٦">
      <div className="grid h-full grid-cols-[1.3fr_0.7fr] items-center gap-[2.5vw]">
        <div className="grid grid-cols-3 gap-[1.4vw]">
          <IconTile symbol="ليل" label="ليلة القدر" tone="plum" />
          <IconTile symbol="ليل" label="الثلث الأخير من الليل" tone="green" />
          <IconTile symbol="صلاة" label="قبل السلام في آخر كل صلاة" tone="gold" />
          <IconTile symbol="غيث" label="عند نزول الغيث" tone="green" />
          <IconTile symbol="جمعة" label="ساعة من يوم الجمعة" tone="gold" />
          <IconTile symbol="سجود" label="أثناء السجود في الصلاة" tone="plum" />
        </div>
        <Panel tone="cream" className="flex flex-col justify-center text-center">
          <div className="text-[2.4vw] font-black text-[#5b326d]">نشاط تصنيف</div>
          <p className="mt-[2vh] text-[1.7vw] leading-relaxed">رتّب البطاقات إلى أوقات ليلية، وصلوات، وأوقات مرتبطة بالسماء واليوم.</p>
          <div className="mt-[3vh] text-[3.5vw] font-black text-[#c79a43]">صنّف</div>
        </Panel>
      </div>
    </Frame>
  );
}