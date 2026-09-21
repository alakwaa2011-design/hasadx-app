import re

with open('artifacts/homework-app/src/pages/game/tug-create.tsx', 'r') as f:
    content = f.read()

# Remove BankQuestion, correctAnswerToIndex, bankToTug
content = re.sub(r'interface BankQuestion \{.*?\n\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'const correctAnswerToIndex =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'const bankToTug =.*?\}\);\n', '', content, flags=re.DOTALL)

# Remove the state variables for Bank and Assignments
content = re.sub(r'\s*// Bank\s*const \[bankOpen, setBankOpen\] = useState\(false\);\n.*?const \[bankSelected, setBankSelected\] = useState<Set<number>>\(new Set\(\)\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'\s*// Assignments\s*const \[assignOpen, setAssignOpen\] = useState\(false\);\n.*?const \[assignImporting, setAssignImporting\] = useState<number \| null>\(null\);\n', '', content, flags=re.DOTALL)

# Remove loadBank, importBankSelected, loadAssignments, importAllFromAssignment, etc.
content = re.sub(r'\s*// Bank\s*const loadBank = useCallback.*?toast\.success\(ar \? `تم استيراد \$\{selected\.length\} سؤال!` : `Imported \$\{selected\.length\} questions!`\);\n  };\n', '', content, flags=re.DOTALL)
content = re.sub(r'\s*// Assignments\s*const loadAssignments = useCallback.*?setAssignImporting\(null\); \}\n  };\n', '', content, flags=re.DOTALL)

# Remove unused variables like filteredBank, groupedBank, optionLetters
content = re.sub(r'\s*const filteredBank = bankSearch.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'\s*const groupedBank = filteredBank.*?\};\n  }, \{\}\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'\s*const optionLetters = \["أ", "ب", "ج", "د"\];\n', '', content, flags=re.DOTALL)

with open('artifacts/homework-app/src/pages/game/tug-create.tsx', 'w') as f:
    f.write(content)
