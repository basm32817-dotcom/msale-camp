// ============================================================
//  server.js — خادم نظام تسجيل الطلاب في معسكر الدرس
//  الأستاذ علي ضاحي — الحاكم
//
//  التشغيل:  npm start   ثم افتح  http://localhost:3000
// ============================================================

require('dotenv').config();
const path = require('path');
const express = require('express');
const multer = require('multer');

const store = require('./src/store');
const { validateStudent, STAGES } = require('./src/validate');
const whatsapp = require('./src/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// وسائط رفع ملف الـPDF (ذاكرة الخادم، حد 15 ميجابايت)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    cb(null, ok);
  },
});

app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR));

// ------------------------------------------------------------
//  إعدادات الواجهة (رقم واتساب الإدارية + حالة الربط)
// ------------------------------------------------------------
app.get('/api/config', (req, res) => {
  const adminNumber = whatsapp.normalizeRecipient(process.env.WHATSAPP_ADMIN_NUMBER);
  res.json({
    appName: 'استمارة تسجيل الطلاب في المعسكر',
    teacher: 'الأستاذ علي ضاحي',
    title: 'الحاكم',
    stages: STAGES,
    whatsappAdminNumber: adminNumber,
    whatsappConfigured: whatsapp.isConfigured(),
  });
});

// ------------------------------------------------------------
//  الطلاب
// ------------------------------------------------------------
app.get('/api/students', (req, res) => {
  const students = store.listStudents();
  res.json({ students, stats: store.stats() });
});

app.post('/api/students', (req, res) => {
  const { valid, errors, data } = validateStudent(req.body || {});
  if (!valid) {
    return res.status(400).json({ ok: false, errors });
  }
  const student = store.createStudent(data);
  res.status(201).json({ ok: true, student, stats: store.stats() });
});

app.delete('/api/students/:id', (req, res) => {
  const removed = store.deleteStudent(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, message: 'الطالب غير موجود.' });
  res.json({ ok: true, stats: store.stats() });
});

// ------------------------------------------------------------
//  إرسال ملف PDF فعليًا إلى واتساب الإدارية (WhatsApp Cloud API)
//  الحقول: studentId (اختياري), to (اختياري), file (ملف PDF)
// ------------------------------------------------------------
app.post('/api/whatsapp/send-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'لم يتم إرفاق ملف PDF.' });
    }

    const student = req.body.studentId ? store.getStudent(req.body.studentId) : null;
    const caption =
      req.body.caption ||
      (student
        ? `تسجيل جديد في المعسكر\nالاسم: ${student.name}\nالمرحلة: ${student.stage}\nالمكان: ${student.location || '—'}`
        : 'استمارة تسجيل طالب في المعسكر');

    const result = await whatsapp.sendDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'registration.pdf',
      caption,
      to: req.body.to,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[whatsapp] خطأ:', err.message);
    res.status(err.status || 500).json({ ok: false, message: err.message });
  }
});

// ------------------------------------------------------------
//  صفحة لوحة الإدارة
// ------------------------------------------------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// معالج أخطاء موحد
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, message: 'حجم الملف كبير جدًا (الحد 15 ميجابايت).' });
  }
  console.error('[server]', err);
  res.status(500).json({ ok: false, message: 'حدث خطأ غير متوقع في الخادم.' });
});

app.listen(PORT, () => {
  console.log('──────────────────────────────────────────────');
  console.log('  معسكر الدرس — الأستاذ علي ضاحي (الحاكم)');
  console.log(`  استمارة التسجيل : http://localhost:${PORT}`);
  console.log(`  لوحة الإدارة    : http://localhost:${PORT}/admin`);
  console.log(
    `  ربط واتساب      : ${whatsapp.isConfigured() ? '✅ جاهز' : '⚠️ غير مربوط بعد (راجع ملف .env و README)'}`
  );
  console.log('──────────────────────────────────────────────');
});
