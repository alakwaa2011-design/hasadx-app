import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { creditAwareFetch } from "@/lib/credit-aware-fetch";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function getStorageUrl(path: string | null | undefined): string {
  if (!path) return "";
  return path.startsWith('/objects/') ? `${API_BASE}/api/storage${path}` : path;
}

export type AiVideoProject = {
  id: number;
  title: string;
  status: "draft" | "storyboard_ready" | "rendering" | "ready" | "failed";
  brief: {
    topic: string;
    prompt: string;
    language: "ar" | "en";
    durationSeconds: 30 | 60 | 90;
    aspectRatio: "16:9" | "9:16" | "1:1";
    visualStyle: "educational" | "cinematic" | "playful" | "minimal";
    voice: string;
    music: boolean;
    captions: boolean;
    sourceImages?: string[];
  };
  storyboard: {
    title: string;
    version: number;
    scenes: AiVideoScene[];
  } | null;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiVideoScene = {
  id: string;
  objective: string;
  narration: string;
  onScreenText: string;
  visualPrompt: string;
  durationSeconds: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  narrationStartTime?: number;
  narrationEndTime?: number;
  audioDurationSeconds?: number;
  transition: "cut" | "dissolve" | "push" | "zoom";
  sourceImage?: string | null;
};

export function getAiVideoStoryboardContentKey(
  storyboard: AiVideoProject["storyboard"],
): string | null {
  return storyboard ? JSON.stringify(storyboard) : null;
}

export function shouldHydrateAiVideoEditor(input: {
  currentProjectId: number | null;
  nextProjectId: number;
  status: AiVideoProject["status"];
  isDirty: boolean;
  currentContentKey: string | null;
  nextContentKey: string | null;
}): boolean {
  if (input.nextContentKey === null) return false;
  if (input.currentProjectId !== input.nextProjectId) return true;
  if (input.status !== "storyboard_ready") {
    return input.isDirty || input.currentContentKey !== input.nextContentKey;
  }
  return !input.isDirty && input.currentContentKey !== input.nextContentKey;
}

export function useAiVideoProjects(enabled = true) {
  return useQuery({
    queryKey: ["ai-video-projects"],
    enabled,
    queryFn: async (): Promise<AiVideoProject[]> => {
      const res = await fetch(`${API_BASE}/api/ai-video/projects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      return data.projects || [];
    },
    refetchInterval: (query) => {
      const projects = query.state.data;
      if (projects?.some((p) => p.status === "draft" || p.status === "rendering")) {
        return 3000;
      }
      return false;
    },
  });
}

export function useAiVideoProject(id: number | null, enabled = true) {
  return useQuery({
    queryKey: ["ai-video-project", id],
    queryFn: async (): Promise<AiVideoProject> => {
      if (!id) throw new Error("No ID");
      const res = await fetch(`${API_BASE}/api/ai-video/projects/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      if (query.state.data?.status === "draft" || query.state.data?.status === "rendering") {
        return 3000;
      }
      return false;
    },
  });
}

export function useCreateAiVideoStoryboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      topic: string;
      sourceText?: string;
      sourceImages: string[];
      prompt: string;
      language: "ar" | "en";
      durationSeconds: 30 | 60 | 90;
      aspectRatio: "16:9" | "9:16" | "1:1";
      visualStyle: "educational" | "cinematic" | "playful" | "minimal";
      voice: string;
      music: boolean;
      captions: boolean;
      idempotencyKey: string;
    }): Promise<AiVideoProject> => {
      const res = await creditAwareFetch(`${API_BASE}/api/ai-video/projects/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 402) return Promise.reject(new Error("INSUFFICIENT_CREDITS"));
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create storyboard");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-video-project", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["ai-video-projects"] });
    },
  });
}

export function useUpdateAiVideoProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title?: string; storyboard?: { title: string; version: number; scenes: AiVideoScene[] } | null } }): Promise<AiVideoProject> => {
      const res = await fetch(`${API_BASE}/api/ai-video/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update project");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-video-project", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["ai-video-projects"] });
    },
  });
}

export function useRenderAiVideoProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idempotencyKey }: { id: number; idempotencyKey: string }): Promise<AiVideoProject> => {
      const res = await creditAwareFetch(`${API_BASE}/api/ai-video/projects/${id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idempotencyKey }),
      });
      if (!res.ok) {
        if (res.status === 402) return Promise.reject(new Error("INSUFFICIENT_CREDITS"));
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to start render");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-video-project", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["ai-video-projects"] });
    },
  });
}

export function useRetryAiVideoProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idempotencyKey }: { id: number; idempotencyKey: string }): Promise<AiVideoProject> => {
      const res = await creditAwareFetch(`${API_BASE}/api/ai-video/projects/${id}/retry-render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idempotencyKey }),
      });
      if (!res.ok) {
        if (res.status === 402) return Promise.reject(new Error("INSUFFICIENT_CREDITS"));
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to retry render");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-video-project", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["ai-video-projects"] });
    },
  });
}