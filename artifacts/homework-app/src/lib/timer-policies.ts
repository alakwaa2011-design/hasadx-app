export function handleTimerAuthTransition(
  isLoading: boolean,
  userId: number | null | undefined,
  storeInit: (id: number) => void,
  storeClear: () => void
) {
  if (isLoading || !userId) {
    storeClear();
  } else {
    storeInit(userId);
  }
}

export function shouldShowFloatingTimer(path: string): boolean {
  // Broad negative heuristic block - explicit surfaces
  const explicitlyHidden = [
    "/solve", "/video", "/watch", "/board", "/kids", 
    "/parent", "/play", "/solo", "/features", 
    "/student", "/login", "/register", "/forgot-password", "/reset-password",
    "/p/control", "/p/show", "/p/play", "/p/join", "/p/results", "/p"
  ];
  if (explicitlyHidden.some(p => path === p || path.startsWith(p + "/"))) return false;

  const hiddenSuffixes = ["/print"];
  if (hiddenSuffixes.some(s => path.endsWith(s))) return false;
  
  // Specific blocks
  if (path === "/teacher/tools/timer") return false;
  if (path.endsWith("/present") && !path.includes("/teacher/smart-board/present") && !path.includes("/teacher/presentations/")) return false;

  // Explicit allow list:
  // Must be an authenticated teacher route
  if (path.startsWith("/teacher") || path.startsWith("/islamic/admin")) return true;
  
  // Or teacher-managed game host/control/presentation routes (often matching /game/... or /teacher/... )
  if (path.startsWith("/game/")) {
    if (
      path.includes("/host") || 
      path.includes("/class") || 
      path.includes("/broadcast") || 
      path.includes("/team-control") || 
      path.includes("/team-host")
    ) {
      return true;
    }
  }

  return false;
}

export function shouldAutoMinimizeTimer(path: string): boolean {
  const minimizePrefixes = [
    "/teacher/game", 
    "/teacher/whiteboard", 
    "/islamic/admin", 
    "/teacher/presentations",
    "/teacher/smart-board/present"
  ];
  if (minimizePrefixes.some((p) => path.startsWith(p))) return true;

  if (path.startsWith("/game/")) {
    if (
      path.includes("/host") || 
      path.includes("/class") || 
      path.includes("/broadcast") || 
      path.includes("/team-control") || 
      path.includes("/team-host")
    ) {
      return true;
    }
  }

  return false;
}
