import { useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { getXpSocket, type XpEventPayload } from "@/lib/xp-socket";

/**
 * Globally mounted listener for `teacher:xp` events. Renders an Arabic
 * RTL toast when the teacher earns XP / a badge / levels up.
 */
export function XpToastListener() {
  useEffect(() => {
    const socket = getXpSocket();
    const handler = (payload: XpEventPayload) => {
      const parts: string[] = [];
      if (payload.delta > 0) parts.push(`+${payload.delta} نقطة خبرة`);
      if (payload.leveledUp && payload.level) {
        parts.push(`🎉 ترقية إلى المستوى ${payload.level}`);
      }
      if (payload.newBadgeKeys.length > 0) {
        parts.push(`🏅 شارة جديدة (${payload.newBadgeKeys.length})`);
      }
      if (parts.length > 0) {
        toast.success(parts.join(" · "), { duration: 4500 });
      }
    };
    socket.on("teacher:xp", handler);
    return () => {
      socket.off("teacher:xp", handler);
    };
  }, []);
  return null;
}
