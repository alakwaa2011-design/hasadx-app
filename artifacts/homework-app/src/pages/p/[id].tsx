/**
 * Public present view for published decks. Mounted at `/p/:id` so links
 * stay short and shareable. Drafts return 404 from the public endpoint
 * and are surfaced as a friendly message by `<PresentView />`.
 */
import PresentView from "@/pages/teacher/presentations/present";

export default function PublicPresent() {
  return <PresentView isPublic />;
}
