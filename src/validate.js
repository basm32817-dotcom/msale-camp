// ============================================================
//  src/validate.js — التحقق من صحة بيانات الطالب (من جهة الخادم)
//  المرحلة الدراسية: أولى / ثانية / ثالثة ثانوي فقط
// ============================================================

const STAGES = ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'];

/** استخراج الأرقام فقط */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * التحقق من بيانات الطالب
 * @returns {{ valid: boolean, errors: object, data: object }}
 */
function validateStudent(body) {
  const errors = {};
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').trim();
  const stage = String(body.stage || '').trim();

  // الاسم بالكامل
  if (!name) {
    errors.name = 'الاسم بالكامل مطلوب.';
  } else if (name.length < 3) {
    errors.name = 'الاسم قصير جدًا، يرجى إدخال الاسم الكامل.';
  } else if (name.length > 80) {
    errors.name = 'الاسم طويل جدًا.';
  } else if (!/[\p{L}]/u.test(name)) {
    errors.name = 'الاسم غير صالح.';
  }

  // رقم الهاتف
  const phoneDigits = digitsOnly(phone);
  if (!phone) {
    errors.phone = 'رقم الهاتف مطلوب.';
  } else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    errors.phone = 'رقم الهاتف غير صالح (من 8 إلى 15 رقمًا).';
  }

  // المرحلة الدراسية
  if (!stage) {
    errors.stage = 'المرحلة الدراسية مطلوبة.';
  } else if (!STAGES.includes(stage)) {
    errors.stage = 'المرحلة الدراسية غير صحيحة.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: { name, phone, stage },
  };
}

module.exports = { validateStudent, STAGES, digitsOnly };
