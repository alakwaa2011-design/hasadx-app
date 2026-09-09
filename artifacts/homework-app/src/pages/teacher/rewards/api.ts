import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

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

export const useGetClassRewards = (className?: string) => {
  return useQuery({
    queryKey: ["classroom-rewards", "classes", className],
    queryFn: () => fetcher(`/api/classroom-rewards/classes/${encodeURIComponent(className!)}`),
    enabled: !!className,
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
       for (const studentId of variables.studentIds ?? []) {
         qc.invalidateQueries({ queryKey: ["classroom-rewards", "students", studentId] });
       }
    },
  });
};

export const useAdjustStudentBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, ...data }: { studentId: number; points: number; reason: string; idempotencyKey: string }) =>
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
    },
  });
};

export const useResetStudentPassword = () => {
  return useMutation({
    mutationFn: ({ studentId, newPassword }: any) => fetcher(`/api/classroom-rewards/students/${studentId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
  });
};
