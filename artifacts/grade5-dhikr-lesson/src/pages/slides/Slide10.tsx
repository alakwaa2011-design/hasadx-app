import { Frame, IconTile, Panel } from "../../components/deck-components";

export default function Slide10() {
  return (
    <Frame title="فضل ذكر الله تعالى ومجالسه" number="١٠">
      <div className="grid h-full grid-cols-[0.7fr_1.3fr] items-center gap-[2.5vw]">
        <Panel tone="plum" className="flex h-[54vh] flex-col items-center justify-center text-center">
          <div className="h-[14vw] w-[14vw] rounded-full border-[0.8vw] border-[#8b5a9d] bg-[#fffaf0] p-[3vw] text-[4vw] font-black text-[#8b5a9d]">ذِكر</div>
          <div className="mt-[3vh] text-[1.55vw] font-bold text-[#5b326d]">مجالس تحفّها السكينة</div>
        </Panel>
        <div className="grid grid-cols-3 gap-[1.4vw]">
          <IconTile symbol="١" label="يقوي صلة العبد بربه" tone="green" />
          <IconTile symbol="٢" label="حصن من الشيطان وطريق للجنة" tone="plum" />
          <IconTile symbol="٣" label="يجلب السعادة والسكينة ويدفع الهموم والأحزان" tone="gold" />
          <IconTile symbol="٤" label="ينال به المسلم الأجر والثواب" tone="gold" />
          <IconTile symbol="٥" label="حماية من الشرور والمصائب" tone="green" />
          <IconTile symbol="٦" label="يباهي الله تعالى الملائكة بمجالس الذكر" tone="plum" />
        </div>
      </div>
    </Frame>
  );
}