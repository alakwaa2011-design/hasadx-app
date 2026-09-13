import { Frame, Panel, Quote, Label } from "../../components/deck-components";

export default function Slide08() {
  return (
    <Frame title="حوار سلوكي: أثر الذكر في حياتي" number="٠٨">
      <div className="grid h-full grid-cols-[0.8fr_1.2fr] items-center gap-[3vw]">
        <Panel tone="green" className="text-center">
          <Label tone="green">تطبيق</Label>
          <div className="mt-[2vh] text-[2.4vw] font-black text-[#1f6f4a]">عندما أذكر الله أشعر بـ...</div>
          <div className="mt-[5vh] border-b-[0.2vw] border-dashed border-[#1f6f4a] pb-[2vh] text-[1.7vw] text-[#6e7d74]">أكمل الجملة مع مجموعتك</div>
        </Panel>
        <Quote reference="سؤال: هل رأيت شخصًا يقرأ الأذكار كل يوم؟">
          لأن الدعاء والذكر يجعلاني أشعر بالطمأنينة ويقويان قلبي، قال رسول الله ﷺ: «مثل الذي يذكر ربه والذي لا يذكر ربه مثل الحي والميت».
        </Quote>
      </div>
    </Frame>
  );
}