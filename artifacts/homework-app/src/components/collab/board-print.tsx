import { createPortal } from "react-dom";
import type { CollaborationPost, CollaborationView } from "@workspace/api-client-react";
import { mediaUrl } from "@/lib/collab";
import { useI18n } from "@/lib/i18n";
import { useCollabText } from "./collaboration-i18n";

/** A print-only body sibling: app navigation, portals and assistants cannot leak
 * into the PDF, and screen layout/controls remain unchanged. */
export function BoardPrint({ b, posts }: { b: CollaborationView; posts: CollaborationPost[] }) {
  const { dir } = useI18n();
  const t = useCollabText();
  return createPortal(
    <div className="collab-print-only" dir={dir}>
      <style>{`
        .collab-print-only { display: none; }
        @media print {
          @page { size: A4; margin: 12mm; }
          body:has(> .collab-print-only) > :not(.collab-print-only) { display: none !important; }
          .collab-print-only { display: block !important; color: #111; background: white; font-size: 12pt; }
          .collab-print-only h1 { font-size: 22pt; margin: 0 0 4mm; }
          .collab-print-only h2 { font-size: 15pt; margin: 6mm 0 3mm; break-after: avoid; }
          .collab-print-only article { border: 1px solid #bbb; border-radius: 3mm; padding: 4mm; margin-bottom: 4mm; break-inside: avoid; overflow-wrap: anywhere; }
          .collab-print-only p { white-space: pre-wrap; margin: 0 0 2mm; }
          .collab-print-only img { display: block; max-width: 100%; max-height: 90mm; object-fit: contain; margin-bottom: 3mm; }
          .collab-print-only small { font-size: 10pt; }
        }
      `}</style>
      <h1>{b.title}</h1>
      <p>{b.prompt}</p>
      {b.columns.map(column => {
        const list = posts.filter(post => post.columnId === column.id);
        return <section key={column.id}>
          <h2>{column.title} ({list.length})</h2>
          {list.map(post => <article key={post.id}>
            {post.imageUrl && <img src={mediaUrl(post.imageUrl)} alt={t("صورة المشاركة")} />}
            <p>{post.text}</p>
            {b.settings.showNames && <small>{post.teacher ? t("المعلم") : post.authorName === "مشارك" ? t("مشارك") : post.authorName}</small>}
            {post.tags.length > 0 && <p><small>{post.tags.map(tag => `#${tag}`).join(" ")}</small></p>}
            {post.referenceUrl && <p><small>{post.referenceUrl}</small></p>}
          </article>)}
        </section>;
      })}
    </div>, document.body,
  );
}
