import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

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

export const useGrantRewards = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher(`/api/classroom-rewards/grants`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
       // Invalidate so points update and ledger updates
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "classes"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "ledger"] });
       qc.invalidateQueries({ queryKey: ["classroom-rewards", "summary"] });
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
