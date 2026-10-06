import { useParams } from "wouter";
import { BoardWorkspace } from "@/components/collab/workspace";
import { GOLD } from "@/components/collab/parts";

export default function CollaborationBoardPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-[100dvh] bg-background" dir="rtl">
      <div className="px-4 py-2 text-white flex items-center gap-2 no-print" style={{ background: "#1E4D35", borderBottom: `2px solid ${GOLD}` }}>
        <span className="font-black" style={{ color: GOLD }}>حصاد</span><span className="text-xs text-white/70">لوحة الصف</span>
      </div>
      <BoardWorkspace id={id} />
    </div>
  );
}
