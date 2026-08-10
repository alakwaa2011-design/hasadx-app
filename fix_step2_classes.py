with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Replace border-l-secondary -> border-l-emerald-400
content = content.replace('border-l-secondary', 'border-l-emerald-400')
content = content.replace('border-r-secondary', 'border-r-emerald-400')

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
