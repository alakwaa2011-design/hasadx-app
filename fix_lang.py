with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

content = content.replace('{t.createAssignment.descLabel}', '{lang === "ar" ? "الوصف" : "Description"}')
content = content.replace('{t.createAssignment.descPlaceholder}', '{lang === "ar" ? "وصف الواجب أو التعليمات (اختياري)" : "Assignment description or instructions (optional)"}')

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
