/**
 * Establish exactly one authenticated identity in a newly rotated session.
 * Authentication must not inherit an anonymous session's other identity.
 */
export async function establishStudentSession(req: any, studentAccountId: number): Promise<void> {
  const oldSession = req.session;
  const maxAge = oldSession?.cookie?.maxAge;
  if (typeof oldSession?.regenerate === "function") {
    await new Promise<void>((resolve, reject) => {
      oldSession.regenerate((error: unknown) => error ? reject(error) : resolve());
    });
  }
  delete req.session.teacherId;
  req.session.studentAccountId = studentAccountId;
  if (maxAge) req.session.cookie.maxAge = maxAge;
  const save = req.session?.save;
  if (typeof save === "function") {
    await new Promise<void>((resolve, reject) => {
      save.call(req.session, (error: unknown) => error ? reject(error) : resolve());
    });
  }
}