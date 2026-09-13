import { Frame, Quote, Panel, Label } from "../../components/deck-components";

export default function Slide12() {
  return (
    <Frame title="مجالس الذكر تحفّها السكينة" number="١٢">
      <div className="grid h-full grid-cols-[1.15fr_0.85fr] items-center gap-[3vw]">
        <Quote reference="عن أبي هريرة وأبي سعيد الخدري رضي الله عنهما أنهما شهدا على النبي ﷺ أنه قال">
          لا يقعد قوم يذكرون الله عز وجل إلا حفتهم الملائكة، وغشيتهم الرحمة، ونزلت عليهم السكينة، وذكرهم الله فيمن عنده.
        </Quote>
        <Panel tone="green" className="flex flex-col justify-center text-center">
          <Label tone="green">فكرة تطبيقية</Label>
          <div className="mt-[3vh] text-[2.5vw] font-black leading-relaxed text-[#1f6f4a]">كيف نجعل صفنا مجلس ذكر هادئًا ومحترمًا؟</div>
          <div className="mt-[4vh] text-[4vw] text-[#c79a43]">سكون</div>
        </Panel>
      </div>
    </Frame>
  );
}