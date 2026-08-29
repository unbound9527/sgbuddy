import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const COLUMNS: { key: keyof BossRow; label: string }[] = [
  { key: 'name', label: '怪物名称' },
  { key: 'speed', label: '速度' },
  { key: 'hp', label: '生命' },
  { key: 'force', label: '武力' },
  { key: 'intelligence', label: '智力' },
  { key: 'constitution', label: '体质' },
  { key: 'accuracy', label: '命中' },
  { key: 'agility', label: '灵活' },
  { key: 'phys_atk', label: '物攻' },
  { key: 'phys_def', label: '物防' },
  { key: 'magic_atk', label: '魔攻' },
  { key: 'magic_def', label: '魔防' },
  { key: 'exp', label: '经验' },
  { key: 'level', label: '等级' },
  { key: 'fervor', label: '奋迅' },
  { key: 'charm_poly', label: '妖法' },
  { key: 'guard', label: '禁卫' },
  { key: 'immortal', label: '仙法' },
]

export const useBossHandbook = defineStore('bossHandbook', () => {
  const rows = ref<BossRow[]>([])
  const searchQuery = ref('')
  const columnFilters = ref<Map<string, string>>(new Map())
  const selectedId = ref<number | null>(null)
  const loading = ref(false)
  const levelSort = ref<'none' | 'asc' | 'desc'>('none')

  function cycleLevelSort() {
    if (levelSort.value === 'none') levelSort.value = 'asc'
    else if (levelSort.value === 'asc') levelSort.value = 'desc'
    else levelSort.value = 'none'
  }

  // Filtered rows: name fuzzy + per-column exact numeric match
  const filteredRows = computed(() => {
    let result = rows.value
    if (searchQuery.value) {
      const kw = searchQuery.value.toLowerCase()
      result = result.filter(r => r.name.toLowerCase().includes(kw))
    }
    for (const [field, val] of columnFilters.value) {
      if (val !== '') {
        const numVal = parseInt(val)
        if (!isNaN(numVal)) {
          result = result.filter(r => (r as any)[field] === numVal)
        }
      }
    }
    // Level sort
    if (levelSort.value !== 'none') {
      result = [...result].sort((a, b) => {
        const diff = a.level - b.level
        return levelSort.value === 'asc' ? diff : -diff
      })
    }
    return result
  })

  async function loadRows() {
    loading.value = true
    try {
      const data = await window.electronAPI.dbQuery(
        'SELECT * FROM boss_handbook ORDER BY sort_order ASC, id ASC'
      ) as BossRow[]
      rows.value = data
    } catch (e) {
      console.error('Failed to load boss rows:', e)
    } finally {
      loading.value = false
    }
  }

  async function addRow(): Promise<BossRow | null> {
    const minOrder = rows.value.reduce((m, r) => Math.min(m, r.sort_order), 0)
    try {
      const result = await window.electronAPI.dbQuery(
        `INSERT INTO boss_handbook (sort_order) VALUES (?)`,
        [minOrder - 1]
      ) as any
      const newId = result.lastInsertRowid
      if (newId) {
        const data = await window.electronAPI.dbQuery(
          'SELECT * FROM boss_handbook WHERE id = ?',
          [newId]
        ) as BossRow[]
        if (data.length > 0) {
          rows.value.push(data[0])
          rows.value.sort((a, b) => a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.id - b.id)
          selectedId.value = data[0].id
          return data[0]
        }
      }
      return null
    } catch (e) {
      console.error('Failed to add row:', e)
      return null
    }
  }

  async function deleteRow(id: number) {
    try {
      await window.electronAPI.dbQuery('DELETE FROM boss_handbook WHERE id = ?', [id])
      if (selectedId.value === id) selectedId.value = null
      await loadRows()
    } catch (e) {
      console.error('Failed to delete row:', e)
    }
  }

  async function updateCell(id: number, field: keyof BossRow, value: string | number) {
    const allowedFields = COLUMNS.map(c => c.key)
    if (!allowedFields.includes(field)) {
      console.error(`Invalid field: ${field}`)
      return
    }
    try {
      await window.electronAPI.dbQuery(
        `UPDATE boss_handbook SET ${field} = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
        [value, id]
      )
      // Update local cache
      const row = rows.value.find(r => r.id === id)
      if (row) (row as any)[field] = value
    } catch (e) {
      console.error('Failed to update cell:', e)
    }
  }

  async function toggleBold(id: number, field: string) {
    const row = rows.value.find(r => r.id === id)
    if (!row) return

    let fields: string[]
    try {
      fields = JSON.parse(row.bold_fields || '[]')
    } catch {
      fields = []
    }

    const idx = fields.indexOf(field)
    if (idx === -1) {
      fields.push(field)
    } else {
      fields.splice(idx, 1)
    }

    const newJson = JSON.stringify(fields)
    try {
      await window.electronAPI.dbQuery(
        `UPDATE boss_handbook SET bold_fields = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
        [newJson, id]
      )
      row.bold_fields = newJson
    } catch (e) {
      console.error('Failed to toggle bold:', e)
    }
  }

  async function moveRow(id: number, direction: 'up' | 'down') {
    const idx = rows.value.findIndex(r => r.id === id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= rows.value.length) return

    const a = rows.value[idx]
    const b = rows.value[targetIdx]
    try {
      await window.electronAPI.dbTransaction([
        { sql: 'UPDATE boss_handbook SET sort_order = ? WHERE id = ?', params: [b.sort_order, a.id] },
        { sql: 'UPDATE boss_handbook SET sort_order = ? WHERE id = ?', params: [a.sort_order, b.id] },
      ])
      await loadRows()
    } catch (e) {
      console.error('Failed to move row:', e)
    }
  }

  function setSearch(q: string) {
    searchQuery.value = q
  }

  function setColumnFilter(field: string, value: string) {
    const newMap = new Map(columnFilters.value)
    if (value === '') {
      newMap.delete(field)
    } else {
      newMap.set(field, value)
    }
    columnFilters.value = newMap
  }

  function selectRow(id: number | null) {
    selectedId.value = id
  }

  return {
    rows, searchQuery, columnFilters, selectedId, loading, levelSort,
    filteredRows,
    loadRows, addRow, deleteRow, updateCell, moveRow,
    setSearch, setColumnFilter, selectRow, cycleLevelSort, toggleBold,
  }
})
