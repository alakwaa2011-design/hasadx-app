/** No offline queue or automatic retries: every write is an explicit classroom action. */
export async function collaborationRequest<T>(request: (signal: AbortSignal) => Promise<T>, timeoutMs = 15000): Promise<T> {
  if (!navigator.onLine) throw new Error("أنت غير متصل. لم تُرسل العملية. اتصل بالإنترنت ثم أعد المحاولة.");
  const controller = new AbortController();
  let timedOut = false;
  const offline = () => controller.abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  window.addEventListener("offline", offline);
  try {
    return await request(controller.signal);
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(timedOut
        ? "لم يصل تأكيد من الخادم. تحقق من آخر مشاركات اللوحة قبل إعادة المحاولة."
        : "انقطع الاتصال أثناء الإرسال؛ لم يصل تأكيد الحفظ. تحقق من اللوحة ثم أعد المحاولة.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
    window.removeEventListener("offline", offline);
  }
}
