import fs from 'fs'
const c = fs.readFileSync('artifacts/homework-app/src/pages/game/tug-create.tsx', 'utf-8')
const required = ['Settings2', 'ChevronDown', 'showAdvanced', 'setShowAdvanced']
for (const r of required) {
    if (!c.includes(r)) console.log('MISSING:', r)
}
console.log('Test complete')
