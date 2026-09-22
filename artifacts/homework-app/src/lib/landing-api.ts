import { useState, useEffect } from "react";

export const API_BASE = import.meta.env.VITE_API_URL || "";

export interface PublicStats {
  hidden?: boolean;
  teacherCount: number;
  assignmentCount: number;
  studentCount: number;
  submissionCount: number;
  labels?: { teacher: string | null; assignment: string | null; student: string | null; submission: string | null };
  notes?:  { teacher: string | null; assignment: string | null; student: string | null; submission: string | null };
}

export interface PublicAssignment {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  submissionMode: string;
  targetClass: string | null;
  totalPoints: number | null;
  teacherName: string | null;
  isAdminContent?: boolean;
  questionCount: number;
  createdAt: string;
}

export interface TeacherAssignment {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  submissionMode: string;
  questionCount: number;
  submissionCount: number;
  teacherName: string | null;
  deadline: string | null;
}

export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/stats/public`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);
  return stats;
}

export function usePublicContent() {
  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/assignments?contentKind=competition`)
      .then((r) => r.json())
      .catch(() => [])
      .then((a) => setAssignments(Array.isArray(a) ? a : []))
      .finally(() => setLoading(false));
  }, []);

  return { assignments, loading };
}

export function useTeacherAssignments(teacherId: number | null) {
  const [ownAssignments, setOwnAssignments] = useState<TeacherAssignment[]>([]);
  const [ownLoading, setOwnLoading] = useState(false);
  
  useEffect(() => {
    if (!teacherId) return;
    setOwnLoading(true);
    fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOwnAssignments(Array.isArray(d) ? d : []))
      .catch(() => setOwnAssignments([]))
      .finally(() => setOwnLoading(false));
  }, [teacherId]);
  
  return { ownAssignments, ownLoading };
}

export async function startPublicGame(assignmentId: number, withBots: boolean = false, botCount: number = 0) {
  const res = await fetch(`${API_BASE}/api/public/start-wameeth/${assignmentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ withBots, botCount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to start game");
  return data.pin as string;
}
