// ============================================================
//  src/store.js — طبقة التخزين (ملف JSON بدون قواعد بيانات)
//  يحفظ بيانات الطلاب بشكل دائم وآمن (كتابة ذرية عبر ملف مؤقت)
// ============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'students.json');

/** التأكد من وجود مجلد البيانات وملف الطلاب */
function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

/** قراءة كل الطلاب */
function readAll() {
  ensureFiles();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('[store] خطأ في قراءة ملف البيانات:', err.message);
    return [];
  }
}

/** كتابة كل الطلاب (كتابة ذرية: ملف مؤقت ثم استبدال) */
function writeAll(list) {
  ensureFiles();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

/** تنسيق التاريخ والوقت: 2026/10/09 - 14:35 */
function formatDateTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())}` +
    ` - ${p(date.getHours())}:${p(date.getMinutes())}`
  );
}

/** إنشاء طالب جديد وحفظه */
function createStudent(data) {
  const list = readAll();
  const now = new Date();
  const student = {
    id: `STU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(data.name).trim(),
    phone: String(data.phone).trim(),
    stage: String(data.stage).trim(),
    location: String(data.location).trim(),
    registeredAt: now.toISOString(),
    registeredAtLocal: formatDateTime(now),
  };
  list.unshift(student); // الأحدث أولًا
  writeAll(list);
  return student;
}

/** جلب كل الطلاب */
function listStudents() {
  return readAll();
}

/** جلب طالب بالمعرّف */
function getStudent(id) {
  return readAll().find((s) => s.id === id) || null;
}

/** حذف طالب */
function deleteStudent(id) {
  const list = readAll();
  const index = list.findIndex((s) => s.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  writeAll(list);
  return true;
}

/** إحصائيات */
function stats() {
  const list = readAll();
  return {
    total: list.length,
    today: list.filter((s) => (s.registeredAt || '').startsWith(new Date().toISOString().slice(0, 10))).length,
  };
}

module.exports = { createStudent, listStudents, getStudent, deleteStudent, stats, formatDateTime };
