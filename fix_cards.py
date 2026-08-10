with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

# Replace all `<Card className="..."` with `<div className="..."`
content = content.replace('<Card className=', '<div className=')
# And any plain `<Card>`
content = content.replace('<Card>', '<div>')

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
