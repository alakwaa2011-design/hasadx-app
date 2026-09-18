import type { RequestHandler } from "express";

export const rejectStudentLiveRecitation: RequestHandler = (req, res, next) => {
  if (typeof req.session?.studentAccountId === "number") {
    res.status(403).json({ error: "Live recitation is still in teacher-only evaluation" });
    return;
  }
  next();
};