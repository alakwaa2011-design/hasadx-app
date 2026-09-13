import { Frame, Quote, Panel, Label } from "../../components/deck-components";

export default function Slide13() {
  return (
    <Frame title="دعاء عظيم بأربع كلمات" number="١٣">
      <div className="grid h-full grid-cols-[0.7fr_1.3fr] items-center gap-[2.5vw]">
        <Panel tone="gold" className="text-center">
          <Label tone="gold">تطبيق</Label>
          <div className="mt-[3vh] text-[2.5vw] font-black leading-relaxed text-[#9a7120]">أردد الدعاء مع مجموعتي ثلاث مرات بتركيز.</div>
          <div className="mt-[4vh] text-[5vw] font-black text-[#c79a43]">٣</div>
        </Panel>
        <Quote
          reference="عن جويرية بنت الحارث أم المؤمنين رضي الله عنها أن النبي ﷺ قال"
          audioText="لقد قلت بعدك أربع كلمات، ثلاث مرات، لو وزنت بما قلت منذ اليوم لوزنتهن: سبحان الله وبحمده، عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته."
          audioTone="gold"
        >
          لقد قلت بعدك أربع كلمات، ثلاث مرات، لو وزنت بما قلت منذ اليوم لوزنتهن: سبحان الله وبحمده، عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته.
        </Quote>
      </div>
    </Frame>
  );
}