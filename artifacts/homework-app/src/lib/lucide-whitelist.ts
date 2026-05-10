/**
 * Whitelist of Lucide icon names exposed in the presentation editor's
 * icons palette. Kept ~100 entries so the picker stays scannable and
 * the dynamic-import bundle stays small. Mirror this list when adding
 * server-side icon validation.
 */
export const LUCIDE_WHITELIST: readonly string[] = [
  // General / UI
  "Star", "Heart", "Sparkles", "Award", "Trophy", "Medal", "Crown", "Gem",
  "Flag", "Bookmark", "Tag", "Pin", "MapPin", "Home", "Settings", "Search",
  "Bell", "Shield", "Lock", "Unlock", "Key", "Eye", "EyeOff",
  // Education
  "BookOpen", "Book", "Library", "GraduationCap", "School", "Pencil",
  "PenTool", "Edit3", "FileText", "ClipboardList", "Notebook", "NotebookPen",
  "Lightbulb", "Brain", "Atom", "FlaskConical", "Microscope", "Calculator",
  "Globe", "Languages", "Music", "Palette", "Paintbrush",
  // Arrows / direction
  "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowUpRight",
  "ChevronRight", "ChevronLeft", "ChevronUp", "ChevronDown", "MoveRight",
  "CornerDownRight", "RefreshCw", "Repeat", "Shuffle",
  // Status / feedback
  "Check", "CheckCircle2", "X", "XCircle", "AlertCircle", "AlertTriangle",
  "Info", "HelpCircle", "ThumbsUp", "ThumbsDown", "Smile", "Frown",
  // Time / numbers
  "Clock", "Timer", "Calendar", "CalendarDays", "Hash", "List", "ListOrdered",
  // People / collab
  "User", "Users", "UserCheck", "MessageCircle", "MessageSquare", "Send",
  "Share2", "Mail", "Phone",
  // Tech / media
  "Monitor", "Smartphone", "Tablet", "Laptop", "Camera", "Image", "Video",
  "Mic", "Headphones", "Volume2", "Wifi", "Cloud", "CloudUpload",
  "Database", "Server",
  // Nature / misc
  "Sun", "Moon", "Zap", "Flame", "Leaf", "TreePine", "Cloud as Cloud2",
  "Mountain", "Compass", "Rocket", "Anchor",
] as const;

/* Strip the "as Alias" suffix (none used now, but keeps the whitelist
   easy to extend if collisions appear). */
export const LUCIDE_NAMES: readonly string[] = LUCIDE_WHITELIST
  .map((n) => n.split(" as ")[0])
  .filter((v, i, a) => a.indexOf(v) === i);
