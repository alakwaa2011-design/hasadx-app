import re

with open('artifacts/homework-app/src/pages/game/tug-create.tsx', 'r') as f:
    content = f.read()

# Fix the trailing }, {}); before if (setupStep === "questions") {
content = re.sub(r'    \}\n  \};\n, \{\}\);\n  if \(setupStep === "questions"\) \{', r'    }\n  };\n  if (setupStep === "questions") {', content, flags=re.DOTALL)

with open('artifacts/homework-app/src/pages/game/tug-create.tsx', 'w') as f:
    f.write(content)
