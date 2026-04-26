export function ProposedDesign() {
  const recentResults = [
    { title: "فقه الزكاة", group: "الصف الرابع", completion: "18/24", score: "87%" },
    { title: "ألغاز مستوى 1", group: "الصف الخامس", completion: "20/22", score: "91%" },
    { title: "العمرة", group: "الصف الرابع", completion: "12/24", score: "74%" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f8f6] font-sans text-gray-800" dir="rtl">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-sm text-gray-500 mt-1">واجهة مختصرة تركّز على أهم مهام المعلم</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-4">
          <section className="w-full bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">إنشاء نشاط جديد</h2>
            <p className="text-sm text-gray-500 mt-1">
              ابدأ واجبًا أو نشاطًا تفاعليًا خلال دقائق وبنفس تصميم بقية اللوحة.
            </p>
            <button className="mt-4 w-full sm:w-auto px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors">
              إنشاء الآن
            </button>
          </section>

          <section className="w-full bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">مكتبة الواجبات</h2>
              <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                4 واجبات
              </span>
            </div>
            <div className="space-y-2.5">
              {[
                "فقه الزكاة",
                "ألغاز مستوى 1",
                "العمرة",
                "ألغاز متنوعة 2",
              ].map((assignment) => (
                <button
                  key={assignment}
                  className="w-full text-right px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {assignment}
                </button>
              ))}
            </div>
          </section>

          <section className="w-full bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">النتائج الأخيرة</h2>
            <div className="space-y-3">
              {recentResults.map((result) => (
                <div
                  key={result.title}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-800">{result.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{result.group}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <span>التسليم: {result.completion}</span>
                    <span className="text-gray-300">|</span>
                    <span>المتوسط: {result.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
