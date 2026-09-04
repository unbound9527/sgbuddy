import sqlite3, os, shutil, datetime
base = os.path.join(os.environ['APPDATA'], 'sgbuddy')
db = os.path.join(base, 'sgbuddy.db')

# ── 1. 备份（先 checkpoint WAL，保证主文件完整） ──
ck = sqlite3.connect(db, timeout=15)
ck.execute('PRAGMA wal_checkpoint(TRUNCATE)')
ck.close()
bdir = os.path.join(base, 'backup')
os.makedirs(bdir, exist_ok=True)
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
bpath = os.path.join(bdir, f'sgbuddy-backup-{stamp}.db')
shutil.copy2(db, bpath)
print(f'备份完成: {bpath} ({os.path.getsize(bpath)} bytes)')

# ── 2. 清理 ──
con = sqlite3.connect(db, timeout=15)
con.execute('PRAGMA busy_timeout=15000')
cur = con.cursor()

before = cur.execute('SELECT COUNT(*) FROM currency_rate_history').fetchone()[0]

# 2a. 区间外脏值
cur.execute('DELETE FROM currency_rate_history WHERE rate < 200 OR rate > 900')
n_range = cur.rowcount

# 2b. 区间内已知噪声常量（促销 618 / 规格噪声 461.5；1000 已被区间覆盖）
cur.execute('DELETE FROM currency_rate_history WHERE rate IN (618, 461.5)')
n_noise = cur.rowcount

# 2c. servers 当前垃圾值重置为 0（显示「未获取到」，等 v4 重抓自愈）
dirty = cur.execute(
    'SELECT id, name, currency_rate FROM servers WHERE currency_rate IN (100,123,618,1000) OR currency_rate < 200 OR currency_rate > 900 ORDER BY id'
).fetchall()
cur.execute(
    'UPDATE servers SET currency_rate=0 WHERE currency_rate IN (100,123,618,1000) OR currency_rate < 200 OR currency_rate > 900'
)
n_servers = cur.rowcount

con.commit()

after = cur.execute('SELECT COUNT(*) FROM currency_rate_history').fetchone()[0]
print(f'history: {before} -> {after}  (删区间外 {n_range} 条 + 噪声常量 {n_noise} 条)')
print(f'servers 重置 {n_servers} 个:')
for sid, name, rate in dirty:
    print(f'  {sid:>3} {name:<10} {rate} -> 0')

# ── 3. 复核 ──
print('\n复核: 区间外残留 =', cur.execute('SELECT COUNT(*) FROM currency_rate_history WHERE rate<200 OR rate>900').fetchone()[0])
print('复核: 618/461.5 残留 =', cur.execute('SELECT COUNT(*) FROM currency_rate_history WHERE rate IN (618,461.5)').fetchone()[0])
print('复核: servers 垃圾值残留 =', cur.execute('SELECT COUNT(*) FROM servers WHERE currency_rate IN (100,123,618,1000) OR currency_rate<200 OR currency_rate>900').fetchone()[0])
con.execute('PRAGMA wal_checkpoint(TRUNCATE)')
con.close()
print('\n清理完成')
