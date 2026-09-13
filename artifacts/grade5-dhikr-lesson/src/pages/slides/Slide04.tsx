import { Frame, ImageCard, Panel, Label, Bullet } from "../../components/deck-components";

const base = import.meta.env.BASE_URL;

export default function Slide04() {
  return (
    <Frame title="تمهيد: قبل أن نخرج من المنزل" number="٠٤">
      <div className="grid h-full grid-cols-[1fr_1.1fr] items-center gap-[3vw]">
        <ImageCard src={`${base}door-reminder.png`} alt="أم وابنتها عند باب المنزل" className="h-[58vh] w-full" />
        <Panel tone="gold" className="space-y-[2.2vh]">
          <Label tone="gold">موقف</Label>
          <p className="text-[2vw] font-bold leading-relaxed">قالت الأم لابنتها: انتظري يا ابنتي، لا تنسي قراءة الأذكار قبل الخروج من المنزل.</p>
          <p className="text-[1.85vw] leading-relaxed text-[#5a604e]">قالت الابنة: لقد قرأتها يا أمي؛ لأنها حصن للمسلم.</p>
          <div className="mt-[2vh] rounded-[1.5vw] bg-[#fffaf0]/75 p-[1.5vw]">
            <div className="text-[1.55vw] font-extrabold text-[#8b5a9d]">أسئلة الحوار</div>
            <Bullet tone="plum">ماذا تفعل قبل الخروج من المنزل؟</Bullet>
            <Bullet tone="plum">لماذا نحرص على الأذكار؟</Bullet>
          </div>
        </Panel>
      </div>
    </Frame>
  );
}