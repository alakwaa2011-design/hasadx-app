import re

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

old_dict_box = '''      <div className="bg-primary/8 dark:bg-primary/15 border border-primary/25 rounded-xl p-3 space-y-3">'''
new_dict_box = '''      <div className="bg-[#f4f7f5] dark:bg-[#0B100E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">'''
content = content.replace(old_dict_box, new_dict_box)

old_text = '''          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary transition-colors"'''
new_text = '''          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15201B] text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all resize-none"'''
content = content.replace(old_text, new_text)

old_btn = '''            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${speaking ? "bg-red-100 text-red-700 border border-red-300" : "text-white hover:opacity-92"}`}
            style={!speaking ? { backgroundColor: HASAD_GREEN } : undefined}'''
new_btn = '''            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-40 shadow-sm ${speaking ? "bg-red-100 text-red-700 border border-red-300" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}'''
content = content.replace(old_btn, new_btn)

old_sel = '''              className="px-2 py-1 rounded-md bg-background border border-border text-xs font-bold focus:outline-none"'''
new_sel = '''              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 text-xs font-black focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"'''
content = content.replace(old_sel, new_sel)

old_tog = '''            <button
              type="button"
              onClick={() => onAllowErrorsChange(!allowErrors)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${allowErrors ? "" : "bg-gray-300 dark:bg-gray-600"}`}
              style={allowErrors ? { backgroundColor: HASAD_GREEN } : undefined}
            >'''
new_tog = '''            <button
              type="button"
              onClick={() => onAllowErrorsChange(!allowErrors)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${allowErrors ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
            >'''
content = content.replace(old_tog, new_tog)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
