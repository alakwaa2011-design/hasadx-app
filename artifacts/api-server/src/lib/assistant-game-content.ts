export type AssistantGameType = "solo" | "wameeth_class" | "tug" | "xo" | "wheel" | "rocket" | "hack" | "self";

export function assistantGameDraft(gameType: AssistantGameType, questions: Record<string, any>[], language: "ar" | "en") {
  const native = questions.map(q => {
    const tf = q.questionType === "true_false";
    return { text: q.text, type: tf ? "tf" : "mcq",
      optionA: tf ? (language === "ar" ? "صح" : "True") : q.optionA,
      optionB: tf ? (language === "ar" ? "خطأ" : "False") : q.optionB,
      optionC: q.optionC ?? "", optionD: q.optionD ?? "",
      correctAnswer: tf ? (q.correctAnswer === "true" ? "A" : "B") : q.correctAnswer,
      fillAnswer: "", closeAnswers: "", imageUrl: q.imageUrl ?? null };
  });
  if (gameType === "wameeth_class") return { gameType: "wameeth", content: native, settings: { mode: "classroom", teamCount: 2 } };
  if (gameType === "rocket") return { gameType, content: { questions: native.map(q => ({
    text: q.text, type: q.type, options: q.type === "tf" ? [q.optionA, q.optionB] : [q.optionA, q.optionB, q.optionC, q.optionD],
    correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer), imageUrl: q.imageUrl,
  })) }, settings: { duration: 20, totalDurationSecs: 300, advanceMode: "per_player" } };
  if (gameType === "wheel") return { gameType, content: { segments: native.map((q, index) => ({
    id: `assistant-segment-${index}`, text: q.text,
    answer: [q.optionA, q.optionB, q.optionC, q.optionD][["A", "B", "C", "D"].indexOf(q.correctAnswer)],
    explanation: "", points: 100, kind: "question", imageUrl: q.imageUrl,
  })) }, settings: { teamCount: 2, teamNames: language === "ar" ? ["الفريق الأول", "الفريق الثاني"] : ["Team 1", "Team 2"], spinSeconds: 5, soundOn: true, contentLang: language, bonusesEnabled: false } };
  const individual = gameType === "solo" || gameType === "self";
  return { gameType: individual ? "solo" : gameType,
    content: { questions: individual || gameType === "hack" ? questions : native.map(q => ({
      text: q.text, options: q.type === "tf" ? [q.optionA, q.optionB] : [q.optionA, q.optionB, q.optionC, q.optionD],
      correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer), imageUrl: q.imageUrl,
    })) },
    settings: individual ? { timePerQuestion: 20, leaderboardDisplay: "top3", maxAttempts: 0 }
      : { duration: 20, questionDuration: 20 } };
}
