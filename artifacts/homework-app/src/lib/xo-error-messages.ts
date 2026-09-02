const ENGLISH_XO_ERRORS: Record<string, string> = {
  "يجب تسجيل دخول المعلم لإنشاء لعبة.": "The teacher must sign in to create a game.",
  "الأسئلة يجب أن تحتوي نصاً وخيارين إلى أربعة خيارات صالحة.": "Questions must include text and two to four valid options.",
  "تعذر استعادة غرفة المعلم.": "The teacher room could not be restored.",
  "لم يتم العثور على الغرفة.": "Room not found.",
  "يرجى إدخال اسمك.": "Please enter your name.",
  "الغرفة غير موجودة.": "Room not found.",
  "فقط المعلم المنشئ يمكنه البدء.": "Only the teacher who created the game can start it.",
  "يجب أن ينضم لاعب واحد على الأقل لكل فريق.": "At least one player must join each team.",
  "بدأت اللعبة بالفعل.": "The game has already started.",
  "أنت لست في هذه اللعبة.": "You are not in this game.",
  "لم تبدأ اللعبة بعد.": "The game has not started yet.",
  "فقط المعلم يمكنه التخطي.": "Only the teacher can skip.",
  "فقط المعلم يمكنه الإنهاء.": "Only the teacher can end the game.",
  "فقط المعلم يمكنه إعادة اللعب.": "Only the teacher can replay the game.",
  "لا توجد أسئلة.": "There are no questions.",
  "لا يوجد سؤال نشط.": "There is no active question.",
  "ليس دور فريقك.": "It is not your team's turn.",
  "إجابة غير صالحة.": "Invalid answer.",
  "يجب الإجابة بشكل صحيح أولاً.": "Answer correctly first.",
  "هذه الفرصة للاعب الذي أجاب صحيحاً.": "This move belongs to the player who answered correctly.",
  "خانة غير صالحة.": "Invalid square.",
  "هذه الخانة مشغولة.": "This square is occupied.",
};

export function localizeXoError(message: unknown, ar: boolean, fallback: string): string {
  if (typeof message !== "string" || !message.trim()) return fallback;
  return ar ? message : ENGLISH_XO_ERRORS[message] ?? message;
}