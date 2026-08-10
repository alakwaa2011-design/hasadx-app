import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

old_toggle = '''  const Toggle = ({ on, onChange, color = "green" }: { on: boolean; onChange: () => void; color?: string }) => (
    <button type="button" onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${on ? "" : "bg-gray-300 dark:bg-gray-600"}`}
      style={
        on
          ? {
              backgroundColor:
                color === "orange" ? "#f97316" : HASAD_GREEN,
            }
          : undefined
      }>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${on ? (lang === "ar" ? "right-0.5" : "left-[22px]") : (lang === "ar" ? "left-0.5" : "left-0.5")}`} />
    </button>
  );'''

new_toggle = '''  const Toggle = ({ on, onChange, color = "green" }: { on: boolean; onChange: () => void; color?: string }) => (
    <button type="button" onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${on ? (color === "orange" ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-300 dark:bg-slate-700"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${on ? (lang === "ar" ? "right-0.5" : "translate-x-5") : (lang === "ar" ? "left-0.5" : "translate-x-0")}`} />
    </button>
  );'''
content = content.replace(old_toggle, new_toggle)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
