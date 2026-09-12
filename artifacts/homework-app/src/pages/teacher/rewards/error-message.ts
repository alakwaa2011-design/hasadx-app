const ARABIC_TEXT = /[\u0600-\u06ff]/;

export function getArabicRewardError(error: unknown, fallback = "حدث خطأ غير متوقع، حاول مرة أخرى"): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (message && ARABIC_TEXT.test(message)) return message;

  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid time") ||
    normalized.includes("invalid date") ||
    normalized.includes("datetime")
  ) {
    return "التاريخ أو الوقت غير صالح. تحقق من القيمة ثم حاول مرة أخرى.";
  }
  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.";
  }
  if (normalized.includes("unauthorized") || normalized.includes("authentication") || normalized.includes("401")) {
    return "انتهت جلسة الدخول. سجّل الدخول مرة أخرى ثم أعد المحاولة.";
  }
  if (normalized.includes("forbidden") || normalized.includes("403")) {
    return "ليس لديك صلاحية لتنفيذ هذا الإجراء.";
  }
  if (normalized.includes("not found") || normalized.includes("404")) {
    return "تعذر العثور على العنصر المطلوب. ربما تم حذفه أو تغييره.";
  }
  if (normalized.includes("conflict") || normalized.includes("already") || normalized.includes("409")) {
    return "تعذر تنفيذ العملية بسبب تغيير حديث. حدّث الصفحة ثم حاول مرة أخرى.";
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.";
  }

  return fallback;
}