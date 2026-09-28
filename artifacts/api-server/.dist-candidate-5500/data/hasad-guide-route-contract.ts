export type HasadGuideRoute = {
  /** The user-facing path written in the guide. */
  guidePath: string;
  /** The route pattern registered by the web application. */
  appPath: string;
};

/**
 * Public/product routes whose location is part of the Hasad Guide contract.
 *
 * Keep internal and privileged administration routes out of this list. They may
 * be mentioned as capabilities, but their URLs are intentionally not enforced
 * as user-facing navigation promises.
 */
export const HASAD_GUIDE_ROUTES = [
  { guidePath: "/feedback", appPath: "/feedback" },
  { guidePath: "/games", appPath: "/games" },
  { guidePath: "/islamic", appPath: "/islamic" },
  { guidePath: "/login", appPath: "/login" },
  { guidePath: "/organizer", appPath: "/organizer" },
  { guidePath: "/p/:id", appPath: "/p/:id" },
  { guidePath: "/solve/adaptive/:id", appPath: "/solve/adaptive/:id" },
  { guidePath: "/student/login", appPath: "/student/login" },
  { guidePath: "/student/register", appPath: "/student/register" },
  { guidePath: "/teacher", appPath: "/teacher" },
  { guidePath: "/video/:id", appPath: "/video/:id" },
  { guidePath: "/watch/:roomCode", appPath: "/watch/:roomCode" },
  { guidePath: "/game/arena", appPath: "/game/arena" },
  { guidePath: "/game/capitals", appPath: "/game/capitals" },
  { guidePath: "/game/color", appPath: "/game/color" },
  { guidePath: "/game/escape/create", appPath: "/game/escape/create" },
  { guidePath: "/game/flags", appPath: "/game/flags" },
  { guidePath: "/game/hack", appPath: "/game/hack" },
  { guidePath: "/game/join", appPath: "/game/join/:pin?" },
  { guidePath: "/game/letrly", appPath: "/game/letrly" },
  { guidePath: "/game/maraqui", appPath: "/game/maraqui" },
  { guidePath: "/game/memory", appPath: "/game/memory" },
  { guidePath: "/game/million", appPath: "/game/million" },
  { guidePath: "/game/multiply", appPath: "/game/multiply" },
  { guidePath: "/game/scramble", appPath: "/game/scramble" },
  { guidePath: "/game/secret", appPath: "/game/secret" },
  { guidePath: "/game/stroop", appPath: "/game/stroop" },
  { guidePath: "/game/xo/create", appPath: "/game/xo/create" },
  { guidePath: "/game/wameeth/create", appPath: "/game/wameeth/create" },
  { guidePath: "/game/rocket/create", appPath: "/game/rocket/create" },
  { guidePath: "/game/hotseat/create", appPath: "/game/hotseat/create" },
  { guidePath: "/game/tug/create", appPath: "/game/tug/create" },
  { guidePath: "/game/wheel/create", appPath: "/game/wheel/create" },
  { guidePath: "/teacher/categories", appPath: "/teacher/categories" },
  { guidePath: "/teacher/collections", appPath: "/teacher/collections" },
  { guidePath: "/teacher/credits", appPath: "/teacher/credits" },
  { guidePath: "/teacher/library", appPath: "/teacher/library" },
  { guidePath: "/teacher/library/competitions", appPath: "/teacher/library/competitions" },
  { guidePath: "/teacher/library/homework", appPath: "/teacher/library/homework" },
  { guidePath: "/teacher/mindmap/create", appPath: "/teacher/mindmap/create" },
  { guidePath: "/teacher/mindmaps", appPath: "/teacher/mindmaps" },
  { guidePath: "/teacher/new/dictation", appPath: "/teacher/new/dictation" },
  { guidePath: "/teacher/new/paper-grading", appPath: "/teacher/new/paper-grading" },
  { guidePath: "/teacher/presentations", appPath: "/teacher/presentations" },
  { guidePath: "/teacher/pricing", appPath: "/teacher/pricing" },
  { guidePath: "/teacher/question-bank", appPath: "/teacher/question-bank" },
  { guidePath: "/teacher/sessions", appPath: "/teacher/sessions" },
  { guidePath: "/teacher/settings", appPath: "/teacher/settings" },
  { guidePath: "/teacher/shared", appPath: "/teacher/shared" },
  { guidePath: "/teacher/smart-board", appPath: "/teacher/smart-board" },
  { guidePath: "/teacher/solo-challenges", appPath: "/teacher/solo-challenges" },
  { guidePath: "/teacher/solo-challenges/new", appPath: "/teacher/solo-challenges/new" },
  { guidePath: "/teacher/students", appPath: "/teacher/students" },
  { guidePath: "/teacher/worksheets/create", appPath: "/teacher/worksheets/create" },
  { guidePath: "/teacher/lesson-plans/create", appPath: "/teacher/lesson-plans/create" },
] as const satisfies readonly HasadGuideRoute[];

/**
 * Privileged URLs that the knowledge may mention for orientation, but whose
 * registration is deliberately not part of the public guide contract.
 */
export const HASAD_GUIDE_ROUTE_EXCLUSIONS = ["/teacher/admin"] as const;
