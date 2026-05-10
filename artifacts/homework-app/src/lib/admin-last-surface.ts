export type AdminSurface = "teacher" | "organizer" | "admin";

const STORAGE_KEY = "admin_last_surface";

const SURFACE_TO_PATH: Record<AdminSurface, string> = {
  teacher: "/teacher",
  organizer: "/organizer",
  admin: "/teacher/admin",
};

export function getAdminLastSurface(): AdminSurface | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "teacher" || v === "organizer" || v === "admin") return v;
  } catch {
    // ignore — storage may be unavailable
  }
  return null;
}

export function setAdminLastSurface(surface: AdminSurface): void {
  try {
    localStorage.setItem(STORAGE_KEY, surface);
  } catch {
    // ignore — storage may be unavailable
  }
}

export function getAdminLastSurfacePath(): string | null {
  const s = getAdminLastSurface();
  return s ? SURFACE_TO_PATH[s] : null;
}
