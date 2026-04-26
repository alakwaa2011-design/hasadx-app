import { useEffect } from "react";
import { useLocation } from "wouter";

export default function TeacherProfile() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/teacher/settings", { replace: true });
  }, [setLocation]);
  return null;
}
