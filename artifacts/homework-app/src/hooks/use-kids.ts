import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Rocket, Gamepad2, Compass, Target, Trophy, Award } from "lucide-react";
import type { KidsAvatarAgeBand } from "@workspace/api-zod";

export const AGE_BAND_PRESENTATION: Record<KidsAvatarAgeBand, string> = {
  young: "4 - 7 سنوات (أطفال)",
  middle: "8 - 11 سنة (أشبال)",
  secondary: "12 - 15 سنة (يافعين)"
};

export const AVATAR_PRESENTATION_MAP: Record<string, { label: string, Icon?: any }> = {
  "kids/avatars/star": { label: "نجمة" },
  "kids/avatars/moon": { label: "قمر" },
  "kids/avatars/rainbow": { label: "قوس قزح" },
  "kids/avatars/comet": { label: "مذنب" },
  "kids/avatars/orbit": { label: "مدار" },
  "kids/avatars/leaf": { label: "ورقة" },
  "kids/avatars/peak": { label: "قمة" },
  "kids/avatars/pulse": { label: "نبض" },
  "kids/avatars/vertex": { label: "ذروة" },
  "icon:rocket": { label: "مستكشف", Icon: Rocket },
  "icon:gamepad": { label: "لاعب", Icon: Gamepad2 },
  "icon:compass": { label: "رحال", Icon: Compass },
  "icon:target": { label: "طموح", Icon: Target },
  "icon:trophy": { label: "منجز", Icon: Trophy },
  "icon:award": { label: "بطل", Icon: Award },
};

// Types based on planned schema
export type KidsProfile = {
  id: string;
  display_name: string;
  avatar_key: string;
  age_band: KidsAvatarAgeBand;
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

// Motivation & Rewards Types
export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon_key: string;
  rule_category: "motivation_balance" | "teacher_awards" | "badge_count";
  threshold: number;
  is_active: boolean;
};

export type BadgeGrant = {
  id?: string;
  title: string;
  description: string;
  icon_key: string;
  granted_at: string;
};

export type Reward = {
  id: string;
  title: string;
  description: string;
  cost: number;
  image_key: string;
  status: "active" | "inactive" | "archived";
};

export type RewardRedemption = {
  id: string;
  reward_title: string;
  cost: number;
  display_name: string;
  requested_at: string;
  status: "requested" | "approved" | "rejected" | "delivered" | "cancelled";
};

export type LedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
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
  age_band: KidsAvatarAgeBand;
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

// --- Kids Motivation Hooks ---

export function useKidsMotivationAggregate(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["kids", "motivation", "aggregate"],
    queryFn: () => fetchKidsApi<{ balance: number; history: LedgerEntry[]; badges: BadgeGrant[] }>("/motivation"),
    retry: 0, // Fail fast so dashboard can render fallback state on 404
    refetchInterval: options?.refetchInterval
  });
}

export function useKidsRewards() {
  return useQuery({
    queryKey: ["kids", "motivation", "rewards"],
    queryFn: () => fetchKidsApi<{ rewards: Reward[] }>("/motivation/rewards").then(res => res.rewards),
    retry: 1
  });
}

export function useKidsRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, idempotencyKey }: { rewardId: string; idempotencyKey: string }) =>
      fetchKidsApi<{ redemption: RewardRedemption }>("/motivation/redemptions", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ rewardId })
      }).then(res => res.redemption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids", "motivation", "aggregate"] });
      queryClient.invalidateQueries({ queryKey: ["kids", "motivation", "rewards"] });
      queryClient.invalidateQueries({ queryKey: ["kids", "motivation", "redemptions"] });
    }
  });
}

export function useKidsRedemptions(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["kids", "motivation", "redemptions"],
    queryFn: () => fetchKidsApi<{ redemptions: RewardRedemption[] }>("/motivation/redemptions").then(res => res.redemptions),
    retry: 1,
    refetchInterval: options?.refetchInterval
  });
}


// --- Teacher Kids Motivation Hooks ---

export function useTeacherBadgeDefinitions() {
  return useQuery({
    queryKey: ["teacher", "kids", "motivation", "badges"],
    queryFn: () => fetchTeacherKidsApi<{ badges: BadgeDefinition[] }>("/motivation/badges").then(res => res.badges),
    retry: 1
  });
}

export function useTeacherCreateBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<BadgeDefinition, "id" | "is_active">) =>
      fetchTeacherKidsApi<{ badge: BadgeDefinition }>("/motivation/badges", {
        method: "POST",
        body: JSON.stringify(data)
      }).then(res => res.badge),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "motivation", "badges"] })
  });
}

export function useTeacherUpdateBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchTeacherKidsApi<{ badge: BadgeDefinition }>(`/motivation/badges/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      }).then(res => res.badge),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "motivation", "badges"] })
  });
}

export function useTeacherAwardBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, badgeId }: { profileId: string; badgeId: string }) =>
      fetchTeacherKidsApi<{ grant: BadgeGrant }>(`/motivation/badges/${badgeId}/grants`, {
        method: "POST",
        body: JSON.stringify({ profileId })
      }).then(res => res.grant),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "profile", variables.profileId, "badges"] });
    }
  });
}

export function useTeacherProfileBadges(profileId: string) {
  return useQuery({
    queryKey: ["teacher", "kids", "profile", profileId, "badges"],
    queryFn: () => fetchTeacherKidsApi<{ badges: BadgeGrant[] }>(`/motivation/profiles/${profileId}/badges`).then(res => res.badges),
    enabled: !!profileId,
    retry: 1
  });
}

export function useTeacherRewards() {
  return useQuery({
    queryKey: ["teacher", "kids", "motivation", "rewards"],
    queryFn: () => fetchTeacherKidsApi<{ rewards: Reward[] }>("/motivation/rewards").then(res => res.rewards),
    retry: 1
  });
}

export function useTeacherCreateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Reward, "id" | "status">) =>
      fetchTeacherKidsApi<{ reward: Reward }>("/motivation/rewards", {
        method: "POST",
        body: JSON.stringify(data)
      }).then(res => res.reward),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "motivation", "rewards"] })
  });
}

export function useTeacherUpdateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" | "archived" }) =>
      fetchTeacherKidsApi<{ reward: Reward }>(`/motivation/rewards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      }).then(res => res.reward),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "motivation", "rewards"] })
  });
}

export function useTeacherAwardPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, amount, idempotencyKey }: { profileId: string; amount: number; idempotencyKey: string }) =>
      fetchTeacherKidsApi<{ entry: LedgerEntry }>(`/motivation/profiles/${profileId}/awards`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ amount })
      }).then(res => res.entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "kids"] });
      queryClient.invalidateQueries({ queryKey: ["kids", "motivation"] });
    }
  });
}

export function useTeacherRedemptions() {
  return useQuery({
    queryKey: ["teacher", "kids", "motivation", "redemptions"],
    queryFn: () => fetchTeacherKidsApi<{ redemptions: RewardRedemption[] }>("/motivation/redemptions").then(res => res.redemptions),
    retry: 1
  });
}

export function useTeacherUpdateRedemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" | "deliver" | "cancel" }) =>
      fetchTeacherKidsApi<{ redemption: RewardRedemption }>(`/motivation/redemptions/${id}/${action}`, {
        method: "POST"
      }).then(res => res.redemption),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "kids", "motivation", "redemptions"] })
  });
}

export function useTeacherUpdateProfileAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, avatarKey }: { profileId: string; avatarKey: string }) =>
      fetchTeacherKidsApi<{ profile: KidsProfile }>(`/profile/${profileId}/avatar`, {
        method: "PUT",
        body: JSON.stringify({ avatarKey })
      }).then(res => res.profile),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "kids"] })
  });
}

// Alias for compatibility
export const useTeacherKidsRoster = useTeacherKidsOverview;
