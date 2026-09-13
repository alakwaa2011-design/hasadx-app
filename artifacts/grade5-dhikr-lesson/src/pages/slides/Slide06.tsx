import { Frame, Panel, Quote, Label } from "../../components/deck-components";

export default function Slide06() {
  return (
    <Frame title="ما معنى ذكر الله تعالى؟" number="٠٦">
      <div className="grid h-full grid-cols-2 gap-[2.5vw]">
        <Panel tone="plum" className="flex flex-col justify-center">
          <Label tone="plum">المعنى</Label>
          <p className="mt-[3vh] text-[2.35vw] font-extrabold leading-relaxed text-[#5b326d]">ذكر الله: هو التلفظ بالثناء عليه واستحضار شكره بالقلب.</p>
          <p className="mt-[3vh] text-[1.8vw] leading-relaxed">سؤال فكر: كيف يطمئن القلب عندما يذكر الله؟</p>
        </Panel>
        <Quote reference="قال الله تعالى">
          الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُمْ بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ.
        </Quote>
      </div>
    </Frame>
  );
}