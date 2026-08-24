import type { Request, Response, NextFunction } from "express";

export type RequestLocale = "ar" | "en";

/** UI locale for API feedback. Content returned by an API is deliberately not
 * translated here; only the human-readable `message` and `error` fields are. */
export function resolveRequestLocale(req: Request): RequestLocale {
  const queryLanguage = typeof req.query?.language === "string" ? req.query.language : "";
  const bodyLanguage = req.body && typeof req.body.language === "string" ? req.body.language : "";
  const requested = (queryLanguage || bodyLanguage).toLowerCase();
  if (requested === "en" || requested.startsWith("en-")) return "en";
  if (requested === "ar" || requested.startsWith("ar-")) return "ar";
  return req.headers["accept-language"]?.toString().toLowerCase().startsWith("en") ? "en" : "ar";
}

const messages: Record<string, string> = {
  "Missing code": "رمز الجلسة مطلوب", "Invalid body": "بيانات الطلب غير صالحة", "Wrong write secret": "رمز الكتابة غير صحيح",
  "Server error": "خطأ في الخادم", "Session not found or expired": "الجلسة غير موجودة أو انتهت",
  "Shura voting is not active": "التصويت بالشورى غير نشط", "Unauthorized": "غير مصرح", "Forbidden": "غير مسموح",
  "Invalid category": "فئة غير صالحة", "Invalid id": "معرّف غير صالح", "Invalid ID": "معرّف غير صالح",
  "pin and team required": "رمز الجلسة والفريق مطلوبان", "team must be A or B": "يجب أن يكون الفريق A أو B",
  "Game not found or already cleaned up": "اللعبة غير موجودة أو تمت إزالتها", "Not found": "غير موجود",
  "Failed to fetch game history": "تعذر تحميل سجل اللعبة", "Failed to fetch game details": "تعذر تحميل تفاصيل اللعبة",
  "Failed to save game results": "تعذر حفظ نتائج اللعبة",
  "يجب تسجيل الدخول": "You must sign in", "يجب تسجيل الدخول أولاً": "You must sign in first", "يجب تسجيل الدخول كمعلم": "You must sign in as a teacher",
  "طلب غير مصرح": "Unauthorized request",
  "غير مصرح": "Unauthorized", "غير مسموح": "Not allowed", "غير مسموح بتعديل هذه الفئة": "You cannot edit this category", "غير مسموح بحذف هذه الفئة": "You cannot delete this category",
  "معرّف غير صالح": "Invalid ID", "معرف غير صالح": "Invalid ID", "الواجب غير موجود": "Assignment not found", "النشاط غير موجود": "Activity not found",
  "اللعبة غير موجودة": "Game not found", "الرابط غير صالح": "Invalid link", "الرابط غير موجود": "Link not found",
  "الجلسة غير موجودة": "Session not found", "الجلسة غير موجودة أو انتهت": "Session not found or expired", "اللعبة انتهت": "The game has ended",
  "اسم الفئة مطلوب": "Category name is required", "يجب إضافة عنصرين على الأقل": "Add at least two items", "يجب إضافة عنصرين على الأقل بأسماء صحيحة": "Add at least two items with valid names",
  "الفئة غير موجودة": "Category not found", "رمز غير صالح أو منتهي الصلاحية": "Invalid or expired token", "رمز غير مطابق": "Token does not match",
  "عنوان المسابقة مطلوب": "Challenge title is required", "العنوان طويل جداً": "The title is too long", "الحد الأقصى 100 سؤال": "Maximum 100 questions",
  "يجب إضافة سؤال واحد على الأقل بإجابة صحيحة": "Add at least one question with a correct answer", "تاريخ الانتهاء غير صالح": "Invalid expiration date",
  "عدد المحاولات يجب أن يكون بين 1 و10": "Attempts must be between 1 and 10", "عدد الأسئلة لكل متسابق غير صالح": "Invalid questions-per-participant value",
  "عدد الأسئلة لكل متسابق يجب أن يكون بين 1 وعدد الأسئلة الكلي": "Questions per participant must be between 1 and the total number of questions",
  "عدد الأسئلة لكل متسابق يجب ألا يتجاوز عدد الأسئلة الكلي": "Questions per participant cannot exceed the total number of questions",
  "لا توجد أسئلة في هذه المسابقة": "There are no questions in this challenge", "انتهت مدة هذه المسابقة": "This challenge has expired",
  "الاسم مطلوب": "Name is required", "المسابقة غير موجودة": "Challenge not found", "المشارك غير موجود": "Participant not found",
  "هذا الإجراء متاح للمسؤول فقط": "This action is available to administrators only", "لا توجد أسئلة صالحة": "There are no valid questions",
  "لا توجد أسئلة قابلة للعب في هذا الواجب": "This assignment has no playable questions", "ليس لديك صلاحية على هذا الواجب": "You do not have permission for this assignment",
  "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى.": "AI could not generate questions. Try again.",
  "حدث خطأ أثناء إنشاء التحدي. حاول مرة أخرى.": "An error occurred while creating the challenge. Try again.",
  "حدث خطأ أثناء إنشاء اللعبة. حاول مرة أخرى.": "An error occurred while creating the game. Try again.",
  "يجب تحديد عنوان المسابقة": "A challenge title is required", "أضف سؤالاً واحداً على الأقل": "Add at least one question",
  "إنشاء المسابقات غير متاح للزوار حالياً": "Challenge creation is currently unavailable for guests",
  "وصلت للحد الأقصى. سجّل حساباً للاستمرار.": "You reached the limit. Create an account to continue.",
  "وصلت للحد الأقصى. حاول لاحقاً.": "You reached the limit. Try again later.", "يجب تحديد الموضوع": "A topic is required",
  "خطأ في توليد الأسئلة. يرجى المحاولة مرة أخرى.": "Error generating questions. Please try again.",
  "لا يمكن بدء اللعبة": "The game cannot be started", "الواجب غير موجود أو لا تملكه": "Assignment not found or you do not own it",
  "لا توجد أسئلة كافية في هذا الواجب (الحد الأدنى 5 أسئلة)": "There are not enough questions in this assignment (minimum 5)",
  "هذا الواجب غير متاح للعموم": "This assignment is not publicly available", "خطأ في تحميل الأسئلة": "Error loading questions",
  "خطأ في تحميل النتائج": "Error loading scores", "اسم اللاعب مطلوب": "Player name is required", "نتيجة غير صحيحة": "Invalid score",
  "مستوى غير صحيح": "Invalid level", "خطأ في حفظ النتيجة": "Error saving score", "لا توجد أسئلة بديلة": "No replacement questions are available",
  "لا توجد أسئلة بديلة متاحة": "No replacement questions are available", "لا توجد أسئلة بديلة في بنك الأسئلة": "No replacement questions in the question bank",
  "خطأ في تبديل السؤال": "Error replacing question", "نص السؤال مطلوب": "Question text is required",
  "لا توجد أسئلة كافية في البنك، يرجى المحاولة لاحقاً": "There are not enough questions in the bank. Please try again later.",
  "خطأ في تحميل أسئلة البنك": "Error loading question-bank questions", "طلبات كثيرة جداً، يرجى الانتظار.": "Too many requests. Please wait.",
  "تم استنفاد طلبات التلميح لهذه الجلسة.": "Hint requests for this session have been exhausted.",
  "نوع لعبة غير مدعوم": "Unsupported game type", "لا توجد أسئلة في هذا النشاط": "There are no questions in this activity",
  "لا توجد أسئلة كافية لوميض الصف": "There are not enough questions for the class flash game",
  "لا توجد أسئلة مناسبة لسباق الصواريخ": "There are no suitable questions for Rocket Race",
  "طلبات كثيرة جداً. الرجاء الانتظار دقيقة.": "Too many requests. Please wait one minute.",
  "خطأ في إنشاء الرابط": "Error creating link", "خطأ في تحميل وميض الصف": "Error loading class flash game", "خطأ في بدء اللعبة": "Error starting game",
  "خطأ": "An error occurred", "حدث خطأ": "An error occurred", "خطأ في إنشاء المسابقة": "Error creating challenge",
  "خطأ في جلب المسابقات": "Error loading challenges", "خطأ في جلب المشاركين": "Error loading participants",
  "خطأ في حذف المشارك": "Error deleting participant", "خطأ في حفظ الإعدادات": "Error saving settings", "خطأ في حذف المسابقة": "Error deleting challenge",
  "النتيجة غير موجودة": "Result not found", "لا توجد بيانات للتعديل": "No data to update", "بيانات غير صالحة": "Invalid data",
  "خطأ في تعديل الدرجة": "Error updating score", "خطأ في تصدير البيانات": "Error exporting data", "خطأ في جلب النتائج": "Error loading results",
  "خطأ في جلب إحصائيات الأسئلة": "Error loading question statistics", "خطأ في جلب التفاصيل": "Error loading details",
  "هذا الواجب خاص ولا يمكن الوصول إليه حالياً": "This assignment is private and cannot be accessed now",
  "هذا الواجب ليس في وضع الاختبار": "This assignment is not in exam mode", "انتهى وقت الاختبار": "Exam time has ended",
  "انتهى موعد تسليم هذا الواجب": "The assignment deadline has passed", "جلسة الاختبار غير صالحة": "Invalid exam session",
  "هذا الواجب يقبل فقط الإجابات الإلكترونية": "This assignment accepts electronic answers only",
  "هذا الواجب يقبل فقط الإجابات الورقية (رفع صورة)": "This assignment accepts paper answers only (image upload)",
  "الاختبارات الرسمية لا تقبل إرسال الصور، يجب الإجابة إلكترونياً": "Official exams do not accept image submissions; answer electronically",
  "الواجب لا يحتوي على أسئلة": "The assignment has no questions", "بيانات الملف ناقصة": "File data is incomplete",
  "يُسمح برفع ملفات الصوت فقط": "Only audio files may be uploaded", "الحجم يتجاوز 25 MB": "The size exceeds 25 MB",
  "خطأ في تصحيح الورقة. يرجى المحاولة مرة أخرى.": "Error grading the paper. Please try again.",
  "خطأ في قراءة الصورة. يرجى المحاولة مرة أخرى.": "Error reading the image. Please try again.",
  "فشل توليد رابط الرفع": "Failed to generate upload link", "صفحة التصحيح خاصة بمالك ورقة العمل فقط": "The grading page is available only to the worksheet owner",
  "صيغة الصفحات غير صحيحة": "Invalid page format", "إحدى الصفحات ليست صورة صالحة": "One of the pages is not a valid image",
  "إحدى صفحات الصورة كبيرة جداً — صغّر الصورة وأعد المحاولة": "One image page is too large — reduce it and try again",
  "الحجم الكلي للصفحات كبير جداً — صغّر الصور وأعد المحاولة": "The total page size is too large — reduce the images and try again",
  "لا توجد أسئلة": "There are no questions", "كود الدخول غير صحيح": "Incorrect access code",
  "لقد استخدمت فرصة التكرار مسبقاً لهذا الواجب": "You have already used the retry opportunity for this assignment",
  "لقد قمت بالإجابة على هذا الواجب مسبقاً من هذا الجهاز": "You have already answered this assignment from this device",
  "يجب بدء جلسة اختبار أولاً": "Start an exam session first",
  "allowedClasses يجب أن يكون مصفوفة": "allowedClasses must be an array",
  "يجب وجود سؤال واحد صالح على الأقل": "At least one valid question is required",
  "نوع الملف غير مدعوم. المقبول: PDF، PPTX، Word، Excel، وصور": "Unsupported file type. Allowed: PDF, PPTX, Word, Excel, and images",
  "يرجى إدخال رابط صحيح": "Please enter a valid URL",
  "روابط Canva لا تدعم التنزيل المباشر — يرجى تصدير العرض من Canva كملف PPTX ثم رفعه هنا": "Canva links don't support direct download — please export your design from Canva as PPTX and upload it here.",
  "الرابط غير مدعوم. الروابط المدعومة: Google Slides العامة فقط": "Unsupported link. Only public Google Slides links are supported.",
};

const reverseMessages = Object.fromEntries(Object.entries(messages).map(([ar, en]) => [en, ar]));

function localizeMessage(message: string, locale: RequestLocale): string {
  const dictionary = locale === "en" ? messages : reverseMessages;
  const known = dictionary[message];
  if (known) return known;
  if (locale !== "en") return message;

  const maxQuestions = message.match(/^الحد الأقصى (\d+) سؤال$/);
  if (maxQuestions) return `Maximum ${maxQuestions[1]} questions`;
  const maxPages = message.match(/^الحد الأقصى (\d+) صفحات لكل ورقة$/);
  if (maxPages) return `Maximum ${maxPages[1]} pages per paper`;
  const grade = message.match(/^الدرجة يجب أن تكون بين 0 و (.+)$/);
  if (grade) return `The grade must be between 0 and ${grade[1]}`;
  const invalidLevel = message.match(/^قيمة المستوى غير صالحة: (.+)$/);
  if (invalidLevel) return `Invalid level value: ${invalidLevel[1]}`;
  const invalidCategory = message.match(/^قيمة التخصص غير صالحة: (.+)$/);
  if (invalidCategory) return `Invalid category value: ${invalidCategory[1]}`;
  const unsupportedTypes = message.match(/^نوع اللعبة غير مدعوم\. الأنواع المتاحة: (.+)$/);
  if (unsupportedTypes) return `Unsupported game type. Available types: ${unsupportedTypes[1]}`;
  return message;
}

export function localizeApiMessages(req: Request, res: Response, next: NextFunction) {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(body);
    const locale = resolveRequestLocale(req);
    res.setHeader("Content-Language", locale);
    const localized = { ...(body as Record<string, unknown>) };
    for (const key of ["message", "error"]) {
      if (typeof localized[key] === "string") localized[key] = localizeMessage(localized[key], locale);
    }
    return json(localized);
  }) as Response["json"];
  next();
}