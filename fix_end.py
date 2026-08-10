with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'r') as f:
    content = f.read()

old = '''      </AnimatePresence>
      </div>
    </Layout>
  );
}'''
new = '''      </AnimatePresence>
    </div>
  );
}'''
content = content.replace(old, new)

with open('artifacts/homework-app/src/pages/teacher/create-assignment.tsx', 'w') as f:
    f.write(content)
