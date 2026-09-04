import sqlite3, os
db = os.path.join(os.environ['APPDATA'], 'sgbuddy', 'sgbuddy.db')
con = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
cur = con.cursor()

print('== servers.currency_rate 全表 ==')
for sid, name, rate in cur.execute('SELECT id, name, currency_rate FROM servers ORDER BY id'):
    flag = ''
    if rate == 0: flag = '(未获取)'
    elif rate < 200 or rate > 900 or rate in (100, 123, 618, 1000): flag = '  <-- 垃圾值'
    print(f'  {sid:>3} {name:<12} {rate}{flag}')

print('\n== history 区间外脏值分布 (rate<200 or rate>900) ==')
for rate, n in cur.execute('SELECT rate, COUNT(*) FROM currency_rate_history WHERE rate<200 OR rate>900 GROUP BY rate ORDER BY COUNT(*) DESC'):
    print(f'  rate={rate}  x{n}')

print('\n== 区间内但为已知噪声常量(618/1000/461.5)的历史 ==')
for rate, n in cur.execute('SELECT rate, COUNT(*) FROM currency_rate_history WHERE rate IN (618,1000,461.5) GROUP BY rate'):
    print(f'  rate={rate}  x{n}')

print('\n== 垃圾值大区的最新一条 history (核对来源) ==')
for sid, name, rate in cur.execute("SELECT id,name,currency_rate FROM servers WHERE currency_rate IN (100,123,618,1000,461.5) ORDER BY id"):
    row = cur.execute('SELECT rate, recorded_at FROM currency_rate_history WHERE server_id=? ORDER BY recorded_at DESC LIMIT 1', (sid,)).fetchone()
    print(f'  {sid} {name}: servers={rate}, 最新history={row}')

print('\n== 总行数 ==')
print(' history:', cur.execute('SELECT COUNT(*) FROM currency_rate_history').fetchone()[0])
con.close()
