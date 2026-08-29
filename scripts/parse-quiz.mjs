import fs from 'fs'
import path from 'path'

const input = fs.readFileSync(
  path.resolve('temp_qqsg/README.md'),
  'utf-8'
)

const lines = input.split('\n')
const questions = []

// Patterns to match question lines
// Format: <NUMBER> <QUESTION> <WHITESPACE> <ANSWER>
// or: <NUMBER> <QUESTION> ? <ANSWER>
const questionRegex = /^(\d+)\s+(.+?)[\s\t]{2,}(.+)$/

// Category detection
const categoryMap = {
  threeKingdoms: { start: 1, end: 199, label: '三国演义', icon: '📜' },
  qqGame: { start: 200, end: null, label: 'QQ三国', icon: '🎮' },
}

let currentCategory = 'threeKingdoms'
let qNum = 0

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed) continue

  // Skip markdown headers and non-question content
  if (trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('>')) continue
  if (trimmed.includes('题库辛苦整理') || trimmed.includes('最近更新') || trimmed.includes('答题技巧')) continue
  if (trimmed.includes('提前打开') || trimmed.includes('Ctrl+F') || trimmed.includes('Alt+Tab')) continue

  const match = trimmed.match(questionRegex)
  if (!match) continue

  const num = parseInt(match[1])
  let question = match[2].trim()
  let answer = match[3].trim()

  // Clean up question marks
  if (question.endsWith('?') || question.endsWith('？')) {
    question = question.slice(0, -1)
  }

  // Determine category
  if (num >= 200 && num <= 420) {
    currentCategory = 'qqGameBasic'
  } else if (num >= 421 && num <= 630) {
    currentCategory = 'qqGameItems'
  } else if (num >= 631 && num <= 850) {
    currentCategory = 'qqGameSystems'
  } else if (num >= 851 && num <= 1200) {
    currentCategory = 'general'
  } else if (num >= 1201) {
    currentCategory = 'mixed'
  } else {
    currentCategory = 'threeKingdoms'
  }

  // Skip header/intro text that matched
  if (question.includes('题库辛苦') || question.includes('最近更新')) continue

  questions.push({
    id: num,
    category: currentCategory,
    question,
    answer,
  })

  qNum = num
}

console.log(`Parsed ${questions.length} questions (last ID: ${qNum})`)

// Write the JSON
const outPath = path.resolve('src/data/quiz-bank.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(questions, null, 2), 'utf-8')
console.log(`Written to ${outPath}`)

// Also write a categorized version
const categorized = {}
for (const q of questions) {
  if (!categorized[q.category]) {
    categorized[q.category] = []
  }
  categorized[q.category].push(q)
}

// Stats
for (const [cat, items] of Object.entries(categorized)) {
  console.log(`  ${cat}: ${items.length} questions`)
}

const catPath = path.resolve('src/data/quiz-bank-categorized.json')
fs.writeFileSync(catPath, JSON.stringify(categorized, null, 2), 'utf-8')
console.log(`Categorized version written to ${catPath}`)
