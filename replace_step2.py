import os

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

start_marker = "              {/* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ */}"
end_marker = "              {/* ══════════════════════════════════ STEP 3 — معاينة ونشر ══════════════════════════════════ */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    old_block = content[start_idx:end_idx]
    
    # We will just write a wrapper around the questions.
    # The actual DndContext and mapping over questions needs to be preserved, but styled better.
    # I'll create the new block and write it in.
