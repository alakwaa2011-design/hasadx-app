import { Frame, Panel, Quote, Label, Bullet } from "../../components/deck-components";

export default function Slide15() {
  return (
    <Frame title="فائدة الذكر: الحي والميت" number="١٥">
      <div className="grid h-full grid-cols-[1.2fr_0.8fr] items-center gap-[3vw]">
        <Quote reference="قال النبي ﷺ">
          مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ، وَالَّذِي لَا يَذْكُرُ رَبَّهُ مَثَلُ الْحَيِّ وَالْمَيِّتِ.
        </Quote>
        <Panel tone="plum" className="space-y-[1.8vh]">
          <Label tone="plum">أناقش</Label>
          <Bullet tone="plum">ما وجه الشبه بين الذاكر والحي؟</Bullet>
          <Bullet tone="plum">ما وجه الشبه بين الغافل عن الذكر والميت؟</Bullet>
          <div className="mt-[3vh] border-t-[0.18vw] border-[#c8a8d2] pt-[2vh] text-center text-[2vw] font-black text-[#5b326d]">الذكر حياة القلب ونور السلوك.</div>
        </Panel>
      </div>
    </Frame>
  );
}