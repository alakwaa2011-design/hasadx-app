import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";
export const getStudentAvatarUpload = async (studentId: number, file: File) => {
  const request = await fetch(`${API_BASE}/api/classroom-rewards/students/${studentId}/avatar-upload`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  const requestData = await request.json().catch(() => null);
  if (!request.ok) throw new Error(requestData?.message || "تعذر تجهيز رفع صورة الطالب");
  const upload = await fetch(requestData.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) throw new Error("تعذر رفع صورة الطالب");
  return String(requestData.objectPath);
};

export type RewardRuleSourceType = "assignment_submission" | "kids_activity_completion" | "game_history";
export type RewardRuleConditionType = "completion" | "score_at_least";

export interface RewardRuleInput {
  name: string;
  sourceType: RewardRuleSourceType;
  conditionType: RewardRuleConditionType;
  threshold: number;
  rewardTypeId: number;
  amount: number;
  isActive: boolean;
}

export interface RewardRule extends RewardRuleInput {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardGroupMember {
  studentId: number;
  name: string;
  avatar?: string | null;
}

export interface RewardGroup {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  avatar?: string | null;
  score: number;
  sortOrder: number;
  members: RewardGroupMember[];
}

export interface ClassroomRewardGoal {
  id: string;
  title: string;
  skill?: string;
  rewardTypeId?: number | null;
  targetType: "class" | "student";
  targetId?: number;
  studentName?: string | null;
  targetPoints: number;
  currentPoints: number;
  endDate?: string | null;
  status: "active" | "archived";
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const normalizeGoal = (goal: any): ClassroomRewardGoal => ({
  id: String(goal.id),
  title: String(goal.title),
  skill: goal.skill ? String(goal.skill) : undefined,
  rewardTypeId: goal.rewardTypeId == null ? null : Number(goal.rewardTypeId),
  targetType: goal.studentId == null ? "class" : "student",
  targetId: goal.studentId == null ? undefined : Number(goal.studentId),
  studentName: goal.studentName ?? null,
  targetPoints: Number(goal.targetPoints),
  currentPoints: Number(goal.currentPoints ?? 0),
  endDate: goal.endsAt ?? goal.endDate ?? null,
  status: goal.status === "archived" ? "archived" : "active",
  completed: Boolean(goal.completed),
  createdAt: goal.createdAt,
  updatedAt: goal.updatedAt,
});

const endDateToIso = (value?: string | null) => {
  if (!value) return null;
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error("التاريخ أو الوقت غير صالح");
    return parsed.toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("صيغة التاريخ غير صالحة");
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("التاريخ أو الوقت غير صالح");
  return parsed.toISOString();
};

export interface RewardBoardSnapshot {
  className: string;
  students: Array<{
    id: number;
    name: string;
    avatar?: string | null;
    points: number;
    recognizedThisWeek: boolean;
  }>;
  groups: Array<{
    id: number;
    name: string;
    description?: string | null;
    color: string;
    avatar?: string | null;
    score: number;
    memberIds: number[];
  }>;
  goals: ClassroomRewardGoal[];
  weekly: {
    totalGrantedPoints: number;
    recognizedStudentCount: number;
    awaitingRecognitionCount: number;
  };
}

const fetcher = async (url: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text);
      if (json.message) msg = json.message;
      else if (json.error) msg = json.error;
    } catch (e) {}
    throw new Error(msg || "API Error");
  }
  if (res.status === 204) return null;
  return res.json();
};

export const useGetClassRewards = (className?: string, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryKey: ["classroom-rewards", "classes", className],
    queryFn: () => fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}`),
    enabled: !!className,
    refetchInterval: options?.refetchInterval,
  });
};

export const useGetRewardGroups = (className?: string, options?: { refetchInterval?: number }) => {
  return useQuery<{ groups: RewardGroup[] }>({
    queryKey: ["classroom-rewards", "groups", className],
    queryFn: () => fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}/groups`),
    enabled: !!className,
    refetchInterval: options?.refetchInterval,
  });
};

const invalidateGroups = (qc: ReturnType<typeof useQueryClient>, className: string) => {
  qc.invalidateQueries({ queryKey: ["classroom-rewards", "groups", className] });
  qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", className] });
};

export const useCreateRewardGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, ...data }: { className: string; name: string; description?: string | null; color: string; sortOrder?: number; studentIds?: number[] }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/groups`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, variables) => invalidateGroups(qc, variables.className),
  });
};

export const useUpdateRewardGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, groupId, ...data }: { className: string; groupId: number; name?: string; description?: string | null; color?: string; sortOrder?: number; studentIds?: number[] }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/groups/${groupId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, variables) => invalidateGroups(qc, variables.className),
  });
};

export const useReplaceRewardGroupMembers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, groupId, studentIds }: { className: string; groupId: number; studentIds: number[] }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/groups/${groupId}/members`, { method: "PUT", body: JSON.stringify({ studentIds }) }),
    onSuccess: (_, variables) => invalidateGroups(qc, variables.className),
  });
};

export const useDeleteRewardGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, groupId }: { className: string; groupId: number }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: (_, variables) => invalidateGroups(qc, variables.className),
  });
};

export const useGetRewardTypes = () => {
  return useQuery({
    queryKey: ["classroom-rewards", "types"],
    queryFn: () => fetcher(`/api/classroom-rewards/types`),
  });
};

export const useCreateRewardType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher(`/api/classroom-rewards/types`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classroom-rewards", "types"] }),
  });
};

export const useUpdateRewardType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetcher(`/api/classroom-rewards/types/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classroom-rewards", "types"] }),
  });
};

export const useGrantGroupReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, groupId, ...data }: { className: string; groupId: number; points: number; idempotencyKey: string }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/groups/${groupId}/score`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "groups", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
    },
  });
};

export const useResetGroupScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, groupId, idempotencyKey }: { className: string; groupId: number; idempotencyKey: string }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/groups/${groupId}/reset`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey }),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "groups", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
    },
  });
};

export const useGetRewardRules = () => {
  return useQuery<RewardRule[]>({
    queryKey: ["classroom-rewards", "rules"],
    queryFn: async (): Promise<RewardRule[]> => {
      const response: unknown = await fetcher(`/api/classroom-rewards/rules`);
      if (!Array.isArray(response)) throw new Error("استجابة قواعد التحفيز غير صالحة");
      return response as RewardRule[];
    },
  });
};

export const useCreateRewardRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RewardRuleInput) =>
      fetcher(`/api/classroom-rewards/rules`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classroom-rewards", "rules"] }),
  });
};

export const useUpdateRewardRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<RewardRuleInput> & { id: string }) =>
      fetcher(`/api/classroom-rewards/rules/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classroom-rewards", "rules"] }),
  });
};

export const useReprocessRewardRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/classroom-rewards/rules/${encodeURIComponent(id)}/reprocess`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "rules"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
    },
  });
};

export const useGrantRewards = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher(`/api/classroom-rewards/grants`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "students"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "suggestions", variables.className] });
       for (const studentId of variables.studentIds ?? []) {
         qc.invalidateQueries({ queryKey: ["classroom-rewards", "students", studentId] });
       }
    },
  });
};

export const useAdjustStudentBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, ...data }: { studentId: number; points: number; reason?: string; idempotencyKey: string }) =>
      fetcher(`/api/classroom-rewards/students/${studentId}/balance-adjustments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "students", variables.studentId] });
    },
  });
};

export interface ClassRewardBalance {
  className: string;
  balance: number;
  updatedAt?: string | null;
  history: Array<{
    id: number;
    operation: "award" | "deduct";
    amount: number;
    resultingBalance: number;
    reason?: string | null;
    createdAt: string;
  }>;
}

export const useGetClassRewardBalance = (className?: string) => useQuery<ClassRewardBalance>({
  queryKey: ["classroom-rewards", "class-balance", className],
  queryFn: () => fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}/class-balance`),
  enabled: !!className,
});

export const useAdjustClassRewardBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, ...data }: { className: string; operation: "award" | "deduct"; points: number; reason?: string; idempotencyKey: string }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/class-balance/adjust`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "class-balance", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
    },
  });
};

export interface BulkBalanceAdjustmentInput {
  className: string;
  studentIds: number[];
  points: number;
  reason?: string;
  idempotencyKey: string;
}
export const useReverseReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; idempotencyKey: string }) => 
      fetcher(`/api/classroom-rewards/ledger/${data.id}/reverse`, { 
        method: "POST", 
        body: JSON.stringify({ idempotencyKey: data.idempotencyKey }) 
      }),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
    },
  });
};

export const useReverseRewardBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { batchId: string; idempotencyKey: string }) =>
      fetcher(`/api/classroom-rewards/batches/${data.batchId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: data.idempotencyKey }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "students"] });
    },
  });
};

export const useGetRewardLedger = (className?: string, studentId?: string, period?: string) => {
  return useQuery({
    queryKey: ["classroom-rewards", "ledger", className, studentId, period],
    queryFn: () => {
      const p = new URLSearchParams();
      if (className) p.set("className", className);
      if (studentId) p.set("studentId", studentId);
      if (period) p.set("period", period);
      return fetcher(`/api/classroom-rewards/ledger?${p.toString()}`);
    },
    enabled: !!className,
  });
};

export const useGetRewardSummary = (className?: string, period?: string) => {
  return useQuery({
    queryKey: ["classroom-rewards", "summary", className, period],
    queryFn: () => {
      const p = new URLSearchParams();
      if (className) p.set("className", className);
      if (period) p.set("period", period);
      return fetcher(`/api/classroom-rewards/summary?${p.toString()}`);
    },
    enabled: !!className,
  });
};

export const useGetRewardGoals = (className?: string) => useQuery<{ goals: ClassroomRewardGoal[] }>({
  queryKey: ["classroom-rewards", "goals", className],
  queryFn: async () => {
    const response = await fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}/goals`);
    return { goals: (response.goals ?? []).map(normalizeGoal) };
  },
  enabled: !!className,
});

export const useCreateRewardGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, ...data }: {
      className: string;
      title: string;
      targetType: "class" | "student";
      targetId?: number;
      targetPoints: number;
      endDate?: string | null;
      skill?: string;
      rewardTypeId?: number | null;
    }) => fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/goals`, {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        targetPoints: data.targetPoints,
        studentId: data.targetType === "student" ? data.targetId : null,
        endsAt: endDateToIso(data.endDate),
        skill: data.skill,
        rewardTypeId: data.rewardTypeId,
      }),
    }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "goals", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "students"] });
    },
  });
};

export const useUpdateRewardGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, goalId, ...data }: {
      className: string;
      goalId: string;
      title?: string;
      targetType?: "class" | "student";
      targetId?: number | null;
      targetPoints?: number;
      endDate?: string | null;
      status?: "active" | "archived";
      skill?: string;
      rewardTypeId?: number | null;
    }) => fetcher(`/api/classroom-rewards/goals/${encodeURIComponent(goalId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.targetPoints !== undefined ? { targetPoints: data.targetPoints } : {}),
        ...(data.targetType !== undefined || data.targetId !== undefined
          ? { studentId: data.targetType === "class" ? null : data.targetId }
          : {}),
        ...(data.endDate !== undefined ? { endsAt: endDateToIso(data.endDate) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.skill !== undefined ? { skill: data.skill } : {}),
        ...(data.rewardTypeId !== undefined ? { rewardTypeId: data.rewardTypeId } : {}),
      }),
    }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "goals", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "students"] });
    },
  });
};

export const useArchiveRewardGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, goalId }: { className: string; goalId: string }) =>
      fetcher(`/api/classroom-rewards/goals/${encodeURIComponent(goalId)}`, { method: "DELETE" }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "goals", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "students"] });
    },
  });
};

export const useGetRewardBoard = (className?: string, enabled = true) => useQuery<RewardBoardSnapshot>({
  queryKey: ["classroom-rewards", "board", className],
  queryFn: async () => {
    const response = await fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}/board`);
    const recognizedStudentCount = Number(response.weeklyFairness?.recognizedStudentCount ?? 0);
    const totalStudentCount = Number(response.weeklyFairness?.totalStudentCount ?? response.students?.length ?? 0);
    return {
      className: response.className,
      students: (response.students ?? []).map((student: any) => ({
        id: Number(student.id),
        name: student.name,
        avatar: student.avatar ?? null,
        points: Number(student.points ?? 0),
        recognizedThisWeek: Boolean(student.currentWeeklyRecognition),
      })),
      groups: (response.groups ?? []).map((group: any) => ({
        ...group,
        id: Number(group.id),
        score: Number(group.score ?? 0),
        color: group.color || "#225739",
        memberIds: (group.memberIds ?? []).map(Number),
      })),
      goals: (response.goals ?? []).map(normalizeGoal),
      weekly: {
        totalGrantedPoints: 0,
        recognizedStudentCount,
        awaitingRecognitionCount: Math.max(0, totalStudentCount - recognizedStudentCount),
      },
    };
  },
  enabled: enabled && !!className,
  refetchInterval: enabled ? 2000 : false,
  refetchIntervalInBackground: false,
});

// Reuse existing classes endpoint to get list of teacher's classes for the dropdown
export const useGetTeacherClasses = () => {
  return useQuery({
    queryKey: ["teacher", "classes"],
    queryFn: () => fetcher(`/api/teacher/classes`),
  });
};

export const useGetStudentProfile = (studentId?: number | null) => {
  return useQuery({
    queryKey: ["classroom-rewards", "students", studentId],
    queryFn: () => fetcher(`/api/classroom-rewards/students/${studentId}`),
    enabled: !!studentId,
  });
};

export const useUpdateStudentProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, ...data }: any) => {
      const nullableFields = ["gradeLevel", "studentClass", "parentName", "parentPhone", "parentEmail", "notes", "avatar"];
      const normalized = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          nullableFields.includes(key) && typeof value === "string" && value.trim() === "" ? null : value,
        ]),
      );
      return fetcher(`/api/classroom-rewards/students/${studentId}/profile`, { method: "PATCH", body: JSON.stringify(normalized) });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "students", variables.studentId] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "board"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "groups"] });
    },
  });
};

export const useResetStudentPassword = () => {
  return useMutation({
    mutationFn: ({ studentId, newPassword }: any) => fetcher(`/api/classroom-rewards/students/${studentId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
  });
};

export interface BulkBalanceAdjustmentResult {
  adjusted: Array<{ studentId: number; studentName: string; balance: number }>;
  excluded: Array<{ studentId: number; studentName: string; balance: number; reason: string }>;
  idempotent: boolean;
}

export const useAdjustStudentBalances = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkBalanceAdjustmentInput) =>
      fetcher(`/api/classroom-rewards/balance-adjustments`, {
        method: "POST",
        body: JSON.stringify(data),
      }) as Promise<BulkBalanceAdjustmentResult>,
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
      for (const studentId of variables.studentIds) {
        qc.invalidateQueries({ queryKey: ["classroom-rewards", "students", studentId] });
      }
    },
  });
};

export interface RewardSuggestion {
  id: string;
  submissionId: number;
  studentId: number;
  studentName: string;
  studentAvatar?: string | null;
  reason: string;
  evidenceLabel: string;
  evidenceDetail: string;
  rewardTypeId: number;
  rewardTypeName: string;
  points: number;
}

export const useGetRewardSuggestions = (className?: string, options?: { refetchInterval?: number }) => {
  return useQuery<{ suggestions: RewardSuggestion[] }>({
    queryKey: ["classroom-rewards", "suggestions", className],
    queryFn: () => fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}/suggestions`),
    enabled: !!className,
    refetchInterval: options?.refetchInterval,
  });
};

export const useApproveRewardSuggestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ className, submissionId }: { className: string; submissionId: number }) =>
      fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/suggestions/${submissionId}/approve`, {
        method: "POST",
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "suggestions", variables.className] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
      qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
    },
  });
};
