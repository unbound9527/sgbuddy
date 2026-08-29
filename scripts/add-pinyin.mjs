import fs from 'fs'
import path from 'path'
import { pinyin } from 'pinyin-pro'

// Load API data (has indexes) and existing merged data
const apiPath = path.resolve('temp_api_data_keep.json')

// First, save the raw API data if we still have it
const mergedPath = path.resolve('src/data/quiz-bank.json')
const questions = JSON.parse(fs.readFileSync(mergedPath, 'utf-8'))

console.log(`Processing ${questions.length} questions...`)

// Generate pinyin indexes and full pinyin for each question
for (const q of questions) {
  // Generate pinyin initials (首字母) - same concept as the website's indexes
  const initials = pinyin(q.question, { toneType: 'none', type: 'array' })
    .map((item) => item.charAt(0))
    .join('')
    .toLowerCase()

  // Full pinyin (for full pinyin search like "guanyu")
  const fullPinyin = pinyin(q.question, { toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase()

  // Also generate pinyin for answer
  const answerInitials = pinyin(q.answer, { toneType: 'none', type: 'array' })
    .map((item) => item.charAt(0))
    .join('')
    .toLowerCase()

  const answerFullPinyin = pinyin(q.answer, { toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase()

  // Structured search fields for smart scoring
  q._q = q.question.toLowerCase()
  q._a = q.answer.toLowerCase()
  q._qi = initials                     // question initials (首字母)
  q._qp = fullPinyin                   // question full pinyin
  q._ai = answerInitials
  q._ap = answerFullPinyin

  // Combined index for quick filter
  q._search = [q._q, q._a, q._qi, q._qp, q._ai, q._ap].join(' ')
}

// Write updated quiz bank
fs.writeFileSync(mergedPath, JSON.stringify(questions, null, 2), 'utf-8')
console.log(`Written ${questions.length} questions with pinyin indexes to ${mergedPath}`)

// Also update categorized
const categorized = {}
for (const q of questions) {
  const cat = q.category || 'general'
  if (!categorized[cat]) categorized[cat] = []
  categorized[cat].push(q)
}
const catPath = path.resolve('src/data/quiz-bank-categorized.json')
fs.writeFileSync(catPath, JSON.stringify(categorized, null, 2), 'utf-8')
console.log(`Categorized version written to ${catPath}`)

// Stats
let withSearch = 0
for (const q of questions) {
  if (q._search && q._search.length > 0) withSearch++
}
console.log(`Questions with search index: ${withSearch}`)
console.log(`\nSample:`)
console.log(`  Q: ${questions[0].question}`)
console.log(`  Search: ${questions[0]._search?.substring(0, 120)}...`)
