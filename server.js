const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 数据库路径：Railway Volume 挂载点 /app/data，如果没有则使用本地
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
const dbDir = path.join(dataDir);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.sqlite');
console.log(`📁 数据库路径: ${dbPath}`);

const db = new sqlite3.Database(dbPath);
db.run(`
  CREATE TABLE IF NOT EXISTS draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    office TEXT NOT NULL,
    name TEXT NOT NULL,
    caseResult TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// API: 保存抽签记录
app.post('/api/draw', (req, res) => {
  const { office, name, caseResult, timestamp } = req.body;
  const stmt = db.prepare(`
    INSERT INTO draws (office, name, caseResult, timestamp) VALUES (?, ?, ?, ?)
  `);
  stmt.run(office, name, caseResult, timestamp, function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
  stmt.finalize();
});

// API: 获取所有抽签记录
app.get('/api/records', (req, res) => {
  db.all('SELECT * FROM draws ORDER BY id DESC', (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// API: 重置所有抽签记录
app.delete('/api/reset', (req, res) => {
  db.run('DELETE FROM draws', function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    db.run('DELETE FROM sqlite_sequence WHERE name="draws"');
    res.json({ success: true, deletedCount: this.changes });
  });
});

// 健康检查（Railway 需要）
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 抽签服务运行在端口 ${PORT}`);
  console.log(`   数据库路径: ${dbPath}`);
});