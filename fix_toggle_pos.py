import re
with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '${on ? (lang === "ar" ? "right-0.5" : "translate-x-5") : (lang === "ar" ? "left-0.5" : "translate-x-0")}',
    '${on ? (lang === "ar" ? "right-0.5" : "left-[22px]") : (lang === "ar" ? "left-0.5" : "left-0.5")}'
)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
