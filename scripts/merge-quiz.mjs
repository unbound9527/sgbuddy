import fs from 'fs'
import path from 'path'

// Load both datasets
const existingPath = path.resolve('src/data/quiz-bank.json')
const apiPath = path.resolve('temp_api_data.json')

const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'))
const apiData = JSON.parse(fs.readFileSync(apiPath, 'utf-8'))

console.log(`Existing (GitHub): ${existing.length} questions`)
console.log(`API (qqsgtk.cn): ${apiData.length} questions`)

// Normalize question text for dedup comparison
function normalize(s) {
  return s
    .replace(/[\s\t\r\n]+/g, '')           // remove all whitespace
    .replace(/[？?！!。，,、；;：:""''「」『』【】（）()《》<>]/g, '') // remove punctuation
    .replace(/[～~—\-—…·]/g, '')           // remove special chars
    .toLowerCase()
    .trim()
}

// Also check for negation variants (不是/没有/不属于 → 是/属于 etc.)
function normalizeNegation(s) {
  return s
    .replace(/不是/g, '是')
    .replace(/没有/g, '有')
    .replace(/不属于/g, '属于')
    .replace(/不正确/g, '正确')
    .replace(/以下哪个不是/g, '以下哪个是')
    .replace(/哪一项不是/g, '哪一项是')
}

function fullNormalize(s) {
  return normalize(normalizeNegation(s))
}

// Build dedup index from BOTH normalized and full-normalized forms
const existingNorms = new Map()  // norm -> existing item
const existingFullNorms = new Map() // fullNorm -> existing item

for (const q of existing) {
  const n = normalize(q.question)
  const fn = fullNormalize(q.question)
  existingNorms.set(n, q)
  if (fn !== n) existingFullNorms.set(fn, q)
}

// Also build answer-based dedup: question_norm + answer_norm
const existingQAPairs = new Set()
for (const q of existing) {
  existingQAPairs.add(normalize(q.question) + '|||' + normalize(q.answer))
}

// Merge: add new questions that don't exist
let added = 0
let skippedDup = 0
let skippedNegation = 0

// Assign new IDs starting from max existing ID
let nextId = Math.max(...existing.map(q => q.id)) + 1

// Category mapping based on existing patterns
const catKeywords = {
  threeKingdoms: ['三国演义', '孔明', '诸葛亮', '关羽', '张飞', '刘备', '曹操', '孙权',
    '赤壁', '官渡', '吕布', '貂蝉', '周瑜', '赵云', '马超', '黄忠', '魏延', '姜维',
    '司马懿', '董卓', '袁绍', '刘禅', '曹丕', '孙策', '大乔', '小乔', '庞统', '徐庶',
    '夏侯惇', '典韦', '许褚', '张辽', '华雄', '桃园', '五虎', '水镜', '卧龙'],
  qqGameBasic: ['QQ三国', '推举孝廉', '谋士大赛', '快捷键', '军团', '副职业', '庖丁',
    '镶工', '工匠', '玉石匠', '制符师', '行脚', '国家任务', '国令', '组队', '师徒',
    '副本', '黄巾', '过关斩将', '单骑', '岐山', '强化', '打孔', '镶嵌', '装备',
    '元神', '灵兽', '八阵图', '灵魄', '奥义', '经络', '灵珠', '翅膀', '羽灵',
    '子女', '家园', '亲密度', '夫妻', '结拜', '抗性', '心法'],
}

function guessCategory(question, answer) {
  const q = question + answer
  for (const [cat, keywords] of Object.entries(catKeywords)) {
    for (const kw of keywords) {
      if (q.includes(kw)) return cat
    }
  }
  return 'general'
}

const merged = [...existing]

for (const q of apiData) {
  const n = normalize(q.question)
  const fn = fullNormalize(q.question)
  const qaKey = n + '|||' + normalize(q.answer)

  // Check exact question match
  if (existingNorms.has(n)) {
    skippedDup++
    continue
  }

  // Check negation variant ("不是" → "是")
  if (existingFullNorms.has(fn)) {
    skippedNegation++
    continue
  }

  // Check QA pair (same question + same answer)
  if (existingQAPairs.has(qaKey)) {
    skippedDup++
    continue
  }

  merged.push({
    id: nextId++,
    category: guessCategory(q.question, q.answer),
    question: q.question,
    answer: q.answer,
  })
  added++
}

console.log(`\nResults:`)
console.log(`  Added: ${added}`)
console.log(`  Skipped (exact dup): ${skippedDup}`)
console.log(`  Skipped (negation variant): ${skippedNegation}`)
console.log(`  Total merged: ${merged.length}`)

// Write output
fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2), 'utf-8')
console.log(`\nWritten to ${existingPath}`)

// Also update categorized version
const categorized = {}
for (const q of merged) {
  const cat = q.category || 'general'
  if (!categorized[cat]) categorized[cat] = []
  categorized[cat].push(q)
}
for (const [cat, items] of Object.entries(categorized)) {
  console.log(`  ${cat}: ${items.length}`)
}

const catPath = path.resolve('src/data/quiz-bank-categorized.json')
fs.writeFileSync(catPath, JSON.stringify(categorized, null, 2), 'utf-8')
console.log(`Written to ${catPath}`)
