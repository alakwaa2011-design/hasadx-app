import { Activity, Frame } from "../../components/deck-components";

export default function Slide02() {
  return (
    <Frame title="رحلة الحصة في 45 دقيقة" number="٠٢">
      <div className="grid h-full grid-cols-2 gap-[2vw]">
        <div className="space-y-[1.5vh]">
          <Activity number="١" title="أتهيأ وأتأمل" tone="green">5 دقائق</Activity>
          <Activity number="٢" title="أقرأ الحديث وأفهم معناه" tone="plum">10 دقائق</Activity>
          <Activity number="٣" title="أكتشف الآداب والفضائل" tone="gold">12 دقيقة</Activity>
        </div>
        <div className="space-y-[1.5vh]">
          <Activity number="٤" title="أطبق وأتعاون" tone="green">13 دقيقة</Activity>
          <Activity number="٥" title="أقوّم تعلمي" tone="plum">5 دقائق</Activity>
          <div className="rounded-[1.8vw] border-[0.16vw] border-[#a9c492] bg-[#e8f0df] p-[1.7vw] text-[1.65vw] font-bold leading-relaxed text-[#1f6f4a]">استراتيجياتنا: فكر–زاوج–شارك، التعلم التعاوني، الحوار، بطاقة الخروج</div>
        </div>
      </div>
    </Frame>
  );
}