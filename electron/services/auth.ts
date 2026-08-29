import { getDatabase } from '../database'
import crypto from 'crypto'

// PBKDF2 参数 — 硬编码，不可逆
// 密码彩蛋：2027 开头的 8 位数字（README 有提示）。仅用于筛选小白，不构成安全保护：
// 源码公开 + 本地可离线爆破，有心人必能解开。解锁状态持久化，一次解锁永久生效。
const SALT = Buffer.from('adcfb71a5ae5a2fb793ea85fa01e3ef9', 'hex')
const EXPECTED_HASH = '2d488292e593010ec131edf1e600c529035337db2703a8b75f4d43009fdabdcd'
const ITERATIONS = 100000
const KEYLEN = 32
const DIGEST = 'sha256'

const UNLOCK_KEY = 'window_unlocked'

/** 检查是否已解锁 */
export function isUnlocked(): boolean {
  try {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(UNLOCK_KEY) as { value: string } | undefined
    return row?.value === '1'
  } catch {
    return false
  }
}

/** 验证密码并解锁 */
export function unlock(password: string): boolean {
  const hash = crypto.pbkdf2Sync(password, SALT, ITERATIONS, KEYLEN, DIGEST).toString('hex')
  if (hash !== EXPECTED_HASH) return false

  try {
    const db = getDatabase()
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(UNLOCK_KEY, '1')
    return true
  } catch {
    return false
  }
}
