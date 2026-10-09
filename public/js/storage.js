// ============================================================
//  public/js/storage.js — طبقة التخزين من جهة المتصفح
//
//  أولوية الحفظ:
//    1) ☁️ Firebase Realtime Database (السحابة) — عند النشر على
//       GitHub Pages يجمع تسجيلات كل الأجهزة في مكان واحد.
//    2) 🖥️ خادم Node المحلي (إذا كان يعمل).
//    3) 💾 localStorage — خطة احتياطية أخيرة (لا يضيع أي تسجيل)،
//       وتُرفع تلقائيًا للسحابة عند أول اتصال.
// ============================================================

const Storage = (() => {
  const LOCAL_KEY = 'msale_students';

  // ---------------- محلي ----------------
  const readLocal = () => {
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const writeLocal = (list) => localStorage.setItem(LOCAL_KEY, JSON.stringify(list));

  const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

  /** تنسيق التاريخ والوقت: 2026/10/09 - 14:35 */
  const formatDateTime = (date) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} - ${p(date.getHours())}:${p(date.getMinutes())}`;
  };

  // ---------------- فحص البيانات ----------------
  const validate = (data) => {
    const errors = {};
    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    const phone = String(data.phone || '').trim();
    const stage = String(data.stage || '').trim();
    const location = String(data.location || '').trim();

    if (!name) errors.name = 'الاسم بالكامل مطلوب.';
    else if (name.length < 3) errors.name = 'الاسم قصير جدًا، يرجى إدخال الاسم الكامل.';
    else if (name.length > 80) errors.name = 'الاسم طويل جدًا.';
    else if (!/[\p{L}]/u.test(name)) errors.name = 'الاسم غير صالح.';

    const phoneDigits = digitsOnly(phone);
    if (!phone) errors.phone = 'رقم الهاتف مطلوب.';
    else if (phoneDigits.length < 8 || phoneDigits.length > 15) errors.phone = 'رقم الهاتف غير صالح (من 8 إلى 15 رقمًا).';

    if (!stage) errors.stage = 'المرحلة الدراسية مطلوبة.';
    else if (!APP_CONFIG.STAGES.includes(stage)) errors.stage = 'المرحلة الدراسية غير صحيحة.';

    if (!location) errors.location = 'حقل المكان مطلوب.';
    else if (location.length > 60) errors.location = 'المكان طويل جدًا.';

    return { valid: Object.keys(errors).length === 0, errors, data: { name, phone, stage, location } };
  };

  // ---------------- ☁️ Firebase (السحابة) ----------------
  const fb = (() => {
    let db = null;
    let inited = false;

    const placeholder = (v) => String(v || '').includes('ضع');

    /** هل مفتاح Firebase مضبوط فعلًا؟ */
    const isConfigured = () => {
      const f = APP_CONFIG.FIREBASE_CONFIG || {};
      return Boolean(
        f.apiKey && !placeholder(f.apiKey) &&
        f.databaseURL && !placeholder(f.databaseURL) &&
        f.projectId && !placeholder(f.projectId)
      );
    };

    const init = () => {
      if (inited) return db;
      inited = true;
      if (!isConfigured() || typeof firebase === 'undefined') return null;
      try {
        const app = firebase.initializeApp(APP_CONFIG.FIREBASE_CONFIG);
        db = firebase.database(app);
      } catch (err) {
        console.warn('[storage] تعذر تهيئة Firebase:', err.message);
        db = null;
      }
      return db;
    };

    /** قراءة كل الطلاب من السحابة (null عند الفشل/عدم الإعداد) */
    const listAll = async () => {
      const d = init();
      if (!d) return null;
      try {
        const snap = await d.ref('students').once('value');
        const val = snap.val() || {};
        return Object.entries(val).map(([id, s]) => ({
          id,
          name: s.name,
          phone: s.phone,
          stage: s.stage,
          location: s.location || '',
          registeredAt: s.registeredAt || '',
          registeredAtLocal: s.registeredAtLocal || '',
        }));
      } catch (err) {
        console.warn('[storage] فشل قراءة Firebase:', err.message);
        return null;
      }
    };

    /** حفظ طالب في السحابة */
    const save = async (student) => {
      const d = init();
      if (!d) return false;
      try {
        await d.ref('students/' + student.id).set({
          name: student.name,
          phone: student.phone,
          stage: student.stage,
          location: student.location || '',
          registeredAt: student.registeredAt,
          registeredAtLocal: student.registeredAtLocal,
        });
        return true;
      } catch (err) {
        console.warn('[storage] فشل الحفظ في Firebase:', err.message);
        return false;
      }
    };

    /** حذف طالب من السحابة */
    const remove = async (id) => {
      const d = init();
      if (!d) return false;
      try {
        await d.ref('students/' + id).remove();
        return true;
      } catch (err) {
        console.warn('[storage] فشل الحذف من Firebase:', err.message);
        return false;
      }
    };

    return { isConfigured, listAll, save, remove };
  })();

  /** دمج القوائم بترتيب أولوية (السحابة أولًا) وإزالة التكرار */
  const mergeUnique = (...sources) => {
    const map = new Map();
    for (const source of sources) {
      if (!Array.isArray(source)) continue;
      for (const s of source) {
        if (s && s.id && !map.has(s.id)) map.set(s.id, s);
      }
    }
    return [...map.values()].sort((a, b) =>
      String(b.registeredAt || '').localeCompare(String(a.registeredAt || ''))
    );
  };

  /** هل السحابة مفعّلة (لمستخدمي الواجهة) */
  const cloudConfigured = () => fb.isConfigured();

  // ---------------- حفظ طالب جديد ----------------
  const create = async (rawData) => {
    const { valid, errors, data } = validate(rawData);
    if (!valid) {
      const err = new Error('بيانات غير صالحة');
      err.validation = errors;
      throw err;
    }

    const now = new Date();
    const student = {
      id: `STU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      registeredAt: now.toISOString(),
      registeredAtLocal: formatDateTime(now),
    };

    // 1) السحابة (Firebase) — المسار الأساسي عند النشر على جت هب
    if (fb.isConfigured()) {
      const ok = await fb.save(student);
      if (ok) return { student, source: 'firebase' };
      // إن فشلت السحابة نكمل للمحلي حتى لا يضيع التسجيل (يُرفع لاحقًا)
    }

    // 2) الخادم المحلي (إن وُجد)
    try {
      const res = await fetch(`${APP_CONFIG.API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) return { student: body.student, source: 'server' };
      if (body.errors) {
        const err = new Error('بيانات غير صالحة');
        err.validation = body.errors;
        throw err;
      }
    } catch (e) {
      if (e.validation) throw e;
    }

    // 3) احتياطي محلي
    const list = readLocal();
    list.unshift(student);
    writeLocal(list);
    return { student, source: 'local' };
  };

  // ---------------- جلب كل الطلاب ----------------
  const list = async () => {
    // 1) السحابة
    let fbList = null;
    if (fb.isConfigured()) fbList = await fb.listAll(); // null إن فشلت

    // 2) الخادم المحلي
    let serverList = [];
    try {
      const res = await fetch(`${APP_CONFIG.API_BASE}/students`);
      const body = await res.json();
      if (res.ok && Array.isArray(body.students)) serverList = body.students;
    } catch {
      // الخادم غير متاح
    }

    // 3) محلي
    const local = readLocal();

    const merged = mergeUnique(fbList, serverList, local);

    // مزامنة تلقائية: أي تسجيلات محلية غير موجودة بالسحابة تُرفع وتحذف محليًا
    if (fb.isConfigured() && fbList) {
      const cloudIds = new Set(fbList.map((s) => s.id));
      const toUpload = local.filter((s) => !cloudIds.has(s.id));
      if (toUpload.length) {
        const results = await Promise.all(toUpload.map((s) => fb.save(s)));
        if (results.every(Boolean)) writeLocal([]);
      }
    }

    return merged;
  };

  // ---------------- حذف طالب ----------------
  const remove = async (id) => {
    if (fb.isConfigured()) {
      const ok = await fb.remove(id);
      if (ok) return { ok: true };
    }
    if (String(id).startsWith('LOC-')) {
      writeLocal(readLocal().filter((s) => s.id !== id));
      return { ok: true };
    }
    try {
      const res = await fetch(`${APP_CONFIG.API_BASE}/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { ok: res.ok };
    } catch {
      return { ok: false, message: 'تعذر حذف الطالب.' };
    }
  };

  // ---------------- إعدادات الخادم (اختياري) ----------------
  const fetchServerConfig = async () => {
    try {
      const res = await fetch(`${APP_CONFIG.API_BASE}/config`);
      if (res.ok) return await res.json();
    } catch {
      // الخادم غير متاح
    }
    return null;
  };

  return {
    create, list, remove, validate, fetchServerConfig,
    formatDateTime, digitsOnly, readLocal, cloudConfigured,
  };
})();