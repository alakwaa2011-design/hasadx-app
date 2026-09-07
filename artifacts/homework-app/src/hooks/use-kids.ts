import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types based on planned schema
export type KidsProfile = {
  id: string;
  display_name: string;
  avatar_key: string;
};

export type KidsActivity = {
  id: string;
  slug: string;
  title_ar: string;
  activity_type: "matching" | "tracing" | "media_choice" | "counting" | "ordering_puzzle";
  content: any; // Declarative payload
  asset_key: string;
  skill_slug?: string;
  world_slug?: "arabic-letters" | "english-phonics" | "numbers-0-20";
};

export type KidsAdventureState = {
  profile_id: string;
  stars: number;
  current_world_slug: string;
};

export type KidsDailyAdventure = {
  id: string;
  profile_id: string;
  adventure_date: string;
  activity_ids: string[];
  completed_ids: string[];
  status: string;
};

export type KidsSession = {
  id: string;
  activity_id: string;
  status: string;
  score: number;
};

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    throw new Error(`Kids API error: ${res.status}`);
  }
  
  return res.json();
}

const fetchKidsApi = <T,>(endpoint: string, options?: RequestInit) =>
  fetchApi<T>(`/api/kids${endpoint}`, options);

const fetchTeacherKidsApi = <T,>(endpoint: string, options?: RequestInit) =>
  fetchApi<T>(`/api/teacher/kids${endpoint}`, options);

// --- Hooks ---

export function useKidsProfile() {
  return useQuery({
    queryKey: ["kids", "profile"],
    queryFn: () => fetchKidsApi<{ profile: KidsProfile | null }>("/profile").then(res => res.profile),
    retry: 1
  });
}

export function useCreateKidsProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { displayName: string; avatarKey: string; ageBand: string }) => 
      fetchKidsApi<{ profile: KidsProfile }>("/profile", {
        method: "POST",
        body: JSON.stringify(data)
      }).then(res => res.profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids", "profile"] });
    }
  });
}

// Alias for compatibility
export const useKidProfile = useKidsProfile;

export function useKidsAdventureState() {
  return useQuery({
    queryKey: ["kids", "adventure-state"],
    queryFn: () => fetchKidsApi<{ adventure: KidsAdventureState }>("/adventure").then(res => res.adventure),
    retry: 1
  });
}

export function useKidsTodayAdventure() {
  return useQuery({
    queryKey: ["kids", "today-adventure"],
    queryFn: () => fetchKidsApi<{ adventure: KidsDailyAdventure, activities: KidsActivity[] }>("/today-adventure"),
    retry: 1
  });
}

export type KidsAssignment = {
  id: string;
  activity_id: string;
  title_ar: string;
  due_at: string | null;
};

export function useKidsHome() {
  return useQuery({
    queryKey: ["kids", "home"],
    queryFn: () => fetchKidsApi<{ assignments: KidsAssignment[] }>("/home")
      .then((res) => ({
        ...res,
        assignments: res.assignments.map((assignment) => ({
          ...assignment,
          id: String(assignment.id),
          activity_id: String(assignment.activity_id),
        })),
      })),
    retry: 1,
  });
}

export function useKidsBoardJoin() {
  return useMutation({
    mutationFn: (joinCode: string) => fetchKidsApi<{ board: { id: number; title: string; join_code: string } }>("/board/join", {
      method: "POST",
      body: JSON.stringify({ joinCode }),
    }),
  });
}

export function useKidsBoardEvent() {
  return useMutation({
    mutationFn: ({ boardId, eventType }: { boardId: string; eventType: "joined" | "ready" | "completed" }) =>
      fetchKidsApi<{ event: unknown }>(`/board/${boardId}/events`, {
        method: "POST",
        body: JSON.stringify({ eventType }),
      }),
  });
}

export function useStartKidsTodayAdventure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchKidsApi<{ adventure: KidsDailyAdventure }>("/today-adventure/start", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kids"] }),
  });
}

export function useKidsActivity(id: string) {
  return useQuery({
    queryKey: ["kids", "activity", id],
    queryFn: () => fetchKidsApi<{ activity: KidsActivity }>(`/activities/${id}`).then(res => res.activity),
    enabled: !!id,
    retry: 1
  });
}

export function useStartKidsSession() {
  return useMutation({
    mutationFn: ({ activityId, idempotencyKey }: { activityId: string; idempotencyKey: string }) => 
      fetchKidsApi<{ session: KidsSession }>("/sessions", {
        method: "POST",
        body: JSON.stringify({ activityId }),
        headers: { "Idempotency-Key": idempotencyKey }
      }),
  });
}

export function useAttemptKidsSession() {
  return useMutation({
    mutationFn: ({ sessionId, idempotencyKey, itemKey, answer, exampleId, tracePoints }: { sessionId: string; idempotencyKey: string; itemKey: string; answer: string; exampleId?: string; tracePoints?: Array<{ x: number; y: number }> }) => 
      fetchKidsApi<{ attempt: any }>(`/sessions/${sessionId}/attempts`, {
        method: "POST",
        body: JSON.stringify({ itemKey, answer, exampleId, tracePoints }),
        headers: { "Idempotency-Key": idempotencyKey }
      }),
  });
}

export function useCompleteKidsSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId }: { sessionId: string }) => 
      fetchKidsApi<{ session: KidsSession, score: number, reward: string | null }>(`/sessions/${sessionId}/complete`, {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids"] });
    },
  });
}

// Teacher Side
export type KidsOverviewStudent = {
  id: string;
  display_name: string;
  avatar_key: string;
  mastery_total: number;
  stars: number;
};

export function useTeacherKidsOverview() {
  return useQuery({
    queryKey: ["teacher", "kids", "board-aggregate"],
    queryFn: () => fetchTeacherKidsApi<{ board: Array<Omit<KidsOverviewStudent, "id"> & { id: string | number }> }>("/board")
      .then(res => res.board.map((student) => ({ ...student, id: String(student.id) }))),
    retry: 1
  });
}

export function useTeacherKidsBoardCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string }) => fetchTeacherKidsApi<{ board: any }>("/board", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "board"] });
    }
  });
}

export function useTeacherKidsBoardResults(boardId: string) {
  return useQuery({
    queryKey: ["teacher", "kids", "board-results", boardId],
    queryFn: () => fetchTeacherKidsApi<{ events: any[] }>(`/board/${boardId}/results`).then(res => res.events),
    enabled: !!boardId,
    refetchInterval: boardId ? 2000 : false,
    retry: 1
  });
}

export function useTeacherKidsProfiles() {
  return useQuery({
    queryKey: ["teacher", "kids", "profiles"],
    queryFn: () => fetchTeacherKidsApi<{ profiles: KidsProfile[] }>("/profiles").then(res => res.profiles),
    retry: 1
  });
}

export type TeacherKidsProgressItem = {
  id: string;
  title_ar: string;
  world_title: string;
  mastery_percent: number;
  attempt_count: number;
  state: "not_started" | "practising" | "mastered";
};

export function useTeacherKidsProgress(profileId: string) {
  return useQuery({
    queryKey: ["teacher", "kids", "progress", profileId],
    queryFn: () => fetchTeacherKidsApi<{ progress: TeacherKidsProgressItem[] }>(`/progress/${profileId}`)
      .then((res) => res.progress.map((item) => ({ ...item, id: String(item.id) }))),
    enabled: !!profileId,
    retry: 1,
  });
}

export function useTeacherKidsAssignments() {
  return useQuery({
    queryKey: ["teacher", "kids", "assignments"],
    queryFn: () => fetchTeacherKidsApi<{ assignments: any[] }>("/assignments").then(res => res.assignments),
    retry: 1
  });
}

export function useTeacherKidsActivities() {
  return useQuery({
    queryKey: ["teacher", "kids", "activities"],
    queryFn: () => fetchTeacherKidsApi<{ activities: KidsActivity[] }>("/activities").then(res => res.activities),
    retry: 1
  });
}

export function useTeacherKidsCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { profileId: string; activityId: string; dueAt?: string }) => 
      fetchTeacherKidsApi<{ assignment: any }>("/assignments", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "assignments"] });
    }
  });
}

// Alias for compatibility
export const useTeacherKidsRoster = useTeacherKidsOverview;
