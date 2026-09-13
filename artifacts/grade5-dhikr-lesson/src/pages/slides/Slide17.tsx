import { Frame, ImageCard, Panel, Label, Bullet } from "../../components/deck-components";

const base = import.meta.env.BASE_URL;

export default function Slide17() {
  return (
    <Frame title="مهمة إبداعية: بطاقة أذكاري اليومية" number="١٧">
      <div className="grid h-full grid-cols-[0.8fr_1.2fr] items-center gap-[3vw]">
        <ImageCard src={`${base}dhikr-card.png`} alt="بطاقة أذكار بألوان هادئة" className="h-[54vh] w-full" />
        <Panel tone="cream" className="space-y-[1.5vh]">
          <Label tone="gold">مهمة التصميم</Label>
          <p className="text-[1.95vw] font-bold">صمّم بطاقة واكتب فيها بعض الأذكار التي ترددها كل يوم.</p>
          <Bullet tone="gold">ذكرًا قصيرًا صحيحًا.</Bullet>
          <Bullet tone="gold">وقتًا مناسبًا لترديده.</Bullet>
          <Bullet tone="gold">رمزًا أو لونًا يساعد على تذكره.</Bullet>
          <div className="mt-[2vh] rounded-[1.4vw] bg-[#fbf0cf] p-[1.4vw] text-[1.45vw] font-bold leading-relaxed text-[#6d5525]">معيار النجاح: صحة الذكر، وضوح الكتابة، ارتباط الذكر بوقته، وجمال التصميم.</div>
        </Panel>
      </div>
    </Frame>
  );
}