import { Frame, Quote, Panel, Label } from "../../components/deck-components";

export default function Slide05() {
  return (
    <Frame title="حديث الدرس" number="٠٥">
      <div className="grid h-full grid-cols-[0.75fr_1.25fr] items-center gap-[3vw]">
        <Panel tone="green" className="text-center">
          <Label tone="green">نشاط أداء</Label>
          <div className="mt-[2vh] text-[3.4vw] font-black text-[#1f6f4a]">اقرأ</div>
          <p className="mt-[1.5vh] text-[1.7vw] leading-relaxed">أقرأ الحديث مع المعلم قراءة سليمة، ثم أستمع لقراءة زميلي وأحسنها.</p>
        </Panel>
        <Quote reference="عن أبي موسى الأشعري رضي الله عنه قال: قال النبي ﷺ">
          مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ، وَالَّذِي لَا يَذْكُرُ رَبَّهُ مَثَلُ الْحَيِّ وَالْمَيِّتِ.
        </Quote>
      </div>
    </Frame>
  );
}