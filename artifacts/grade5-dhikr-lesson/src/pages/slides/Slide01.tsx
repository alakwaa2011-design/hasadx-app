import { Cover, Label } from "../../components/deck-components";

export default function Slide01() {
  return (
    <Cover>
      <Label tone="gold">درس جديد</Label>
      <h1 className="mt-[2.5vh] text-[6.3vw] font-black leading-[1.15] tracking-tight text-[#fffaf0]">ذِكر الله تعالى</h1>
      <p className="mt-[2.5vh] text-[2.25vw] font-bold text-[#e7efdc]">الصف الخامس</p>
      <p className="mt-[3vh] max-w-[48vw] text-[1.75vw] leading-relaxed text-[#f2d18a]">سؤال البداية: ما الذكر الذي تحب أن تردده كل يوم؟</p>
      <div className="mt-[4vh] flex items-center gap-[1.2vw] text-[1.25vw] text-[#e7efdc]"><span className="h-[0.75vw] w-[0.75vw] rounded-full bg-[#c79a43]" /><span>التربية الإسلامية</span><span>•</span><span>حصة نموذجية</span></div>
    </Cover>
  );
}