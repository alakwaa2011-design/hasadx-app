const ARABIC_TEXT = /[\u0600-\u06ff]/;
const ERROR_TRANSLATIONS: Record<string, string> = {
  "حدث خطأ غير متوقع، حاول مرة أخرى": "An unexpected error occurred. Please try again.",
  "التاريخ أو الوقت غير صالح. تحقق من القيمة ثم حاول مرة أخرى.": "The date or time is invalid. Check the value and try again.",
  "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.": "Could not connect to the server. Check your internet connection and try again.",
  "انتهت جلسة الدخول. سجّل الدخول مرة أخرى ثم أعد المحاولة.": "Your session expired. Sign in again and retry.",
  "ليس لديك صلاحية لتنفيذ هذا الإجراء.": "You do not have permission to perform this action.",
  "تعذر العثور على العنصر المطلوب. ربما تم حذفه أو تغييره.": "The requested item could not be found. It may have been deleted or changed.",
  "تعذر تنفيذ العملية بسبب تغيير حديث. حدّث الصفحة ثم حاول مرة أخرى.": "The operation could not be completed because something changed. Refresh the page and try again.",
  "استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.": "The request took longer than expected. Please try again.",
};

export function getArabicRewardError(error: unknown, fallback = "حدث خطأ غير متوقع، حاول مرة أخرى"): string {
  const message = error instanceof Error ? error.message.trim() : "";
  const isEnglish = typeof document !== "undefined" && document.documentElement.lang === "en";
  if (message && ARABIC_TEXT.test(message)) {
    return isEnglish ? (ERROR_TRANSLATIONS[message] || message) : message;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid time") ||
    normalized.includes("invalid date") ||
    normalized.includes("datetime")
  ) {
    return isEnglish ? ERROR_TRANSLATIONS["التاريخ أو الوقت غير صالح. تحقق من القيمة ثم حاول مرة أخرى."] : "التاريخ أو الوقت غير صالح. تحقق من القيمة ثم حاول مرة أخرى.";
  }
  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return isEnglish ? ERROR_TRANSLATIONS["تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى."] : "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.";
  }
  if (normalized.includes("unauthorized") || normalized.includes("authentication") || normalized.includes("401")) {
    return isEnglish ? ERROR_TRANSLATIONS["انتهت جلسة الدخول. سجّل الدخول مرة أخرى ثم أعد المحاولة."] : "انتهت جلسة الدخول. سجّل الدخول مرة أخرى ثم أعد المحاولة.";
  }
  if (normalized.includes("forbidden") || normalized.includes("403")) {
    return isEnglish ? ERROR_TRANSLATIONS["ليس لديك صلاحية لتنفيذ هذا الإجراء."] : "ليس لديك صلاحية لتنفيذ هذا الإجراء.";
  }
  if (normalized.includes("not found") || normalized.includes("404")) {
    return isEnglish ? ERROR_TRANSLATIONS["تعذر العثور على العنصر المطلوب. ربما تم حذفه أو تغييره."] : "تعذر العثور على العنصر المطلوب. ربما تم حذفه أو تغييره.";
  }
  if (normalized.includes("conflict") || normalized.includes("already") || normalized.includes("409")) {
    return isEnglish ? ERROR_TRANSLATIONS["تعذر تنفيذ العملية بسبب تغيير حديث. حدّث الصفحة ثم حاول مرة أخرى."] : "تعذر تنفيذ العملية بسبب تغيير حديث. حدّث الصفحة ثم حاول مرة أخرى.";
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return isEnglish ? ERROR_TRANSLATIONS["استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى."] : "استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.";
  }

  return isEnglish ? (ERROR_TRANSLATIONS[fallback] || fallback) : fallback;
}