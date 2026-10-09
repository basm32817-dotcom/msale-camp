// ============================================================
//  public/js/whatsapp.js — إرسال ملف PDF إلى واتساب الإدارية
//
//  المسار الرسمي (فوري وآلي):
//    يرفع الملف إلى الخادم → الخادم يرسله عبر WhatsApp Cloud API
//    (الوسائط الرسمية من Meta — وليس طريقة وهمية).
//
//  إذا لم يتم ربط واتساب بعد، تظهر رسالة واضحة للمستخدم
//  مع خيار فتح محادثة واتساب والإرفاق اليدوي — لا يوجد أي إرسال وهمي.
// ============================================================

const WhatsAppSender = (() => {
  /** رقم واتساب الإدارية (يُفضَّل رقم الخادم إن وُجد) */
  let adminNumber = null;
  let serverConfigured = false;

  const init = async () => {
    const cfg = await Storage.fetchServerConfig();
    if (cfg) {
      adminNumber = cfg.whatsappAdminNumber || null;
      serverConfigured = Boolean(cfg.whatsappConfigured);
      if (adminNumber) APP_CONFIG.WHATSAPP_ADMIN_NUMBER = adminNumber;
      return;
    }
    // بلا خادم: استخدم الرقم من config.js
    adminNumber = Storage.digitsOnly(APP_CONFIG.WHATSAPP_ADMIN_NUMBER) || null;
    serverConfigured = false;
  };

  /** هل رقم الإدارية مضبوط فعلًا ( وليس نصًا بديلًا )؟ */
  const isNumberSet = () => {
    const n = Storage.digitsOnly(APP_CONFIG.WHATSAPP_ADMIN_NUMBER);
    return n.length >= 8;
  };

  /**
   * إرسال ملف PDF إلى واتساب الإدارية.
   * @returns {Promise<{ok:boolean, mode:'api'|'manual'|'error', message:string}>}
   */
  const sendPDF = async (student, blob, filename) => {
    if (!isNumberSet()) {
      return {
        ok: false,
        mode: 'error',
        message:
          'لم يتم ضبط رقم واتساب الإدارية بعد. استبدل النص "ضع رقم الواتساب هنا" برقم فعلي في ملف public/js/config.js (وأيضًا WHATSAPP_ADMIN_NUMBER في ملف .env).',
      };
    }

    // 1) المسار الرسمي: إرسال حقيقي عبر الخادم + WhatsApp Cloud API
    try {
      const form = new FormData();
      form.append('studentId', student.id || '');
      form.append('caption', `تسجيل جديد في المعسكر\nالاسم: ${student.name}\nالمرحلة: ${student.stage}`);
      form.append('file', blob, filename);

      const res = await fetch(`${APP_CONFIG.API_BASE}/whatsapp/send-pdf`, {
        method: 'POST',
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        return { ok: true, mode: 'api', message: `تم إرسال ملف ${filename} إلى واتساب الإدارية ✅` };
      }
      // الخادم يعمل لكن واتساب غير مربوط → نوضح السبب ثم نعرض الوضع اليدوي
      if (body.message) {
        const manual = await openManualChat(student, filename);
        return {
          ok: false,
          mode: 'manual',
          message: `${body.message}\n\nتم تجهيز الملف للتحميل، وفُتحت محادثة واتساب الإدارية — أرفق الملف ${filename} يدويًا داخل المحادثة.`,
          ...manual,
        };
      }
    } catch {
      // الخادم غير متاح إطلاقًا → الوضع اليدوي الصادق
      const manual = await openManualChat(student, filename);
      return {
        ok: false,
        mode: 'manual',
        message: `الخادم غير متاح، لذا لا يمكن الإرسال الآلي حاليًا. تم تجهيز ملف ${filename} للتحميل وفُتحت محادثة واتساب الإدارية — أرفق الملف يدويًا. للإرسال الآلي الكامل راجع قسم "الربط مع واتساب" في README.`,
        ...manual,
      };
    }

    return { ok: false, mode: 'error', message: 'تعذر إرسال الملف عبر واتساب. راجع سجل الخادم للمزيد.' };
  };

  /** فتح محادثة واتساب مع الإدارية (نص جاهز للإرفاق اليدوي) */
  const openManualChat = async (student, filename) => {
    const to = Storage.digitsOnly(APP_CONFIG.WHATSAPP_ADMIN_NUMBER);
    const text = encodeURIComponent(
      `تسجيل جديد في المعسكر — ${APP_CONFIG.TEACHER} (${APP_CONFIG.TITLE})\n` +
        `الاسم: ${student.name}\n` +
        `رقم الهاتف: ${student.phone}\n` +
        `المرحلة: ${student.stage}\n` +
        `وقت التسجيل: ${student.registeredAtLocal}\n\n` +
        `📎 أرفق ملف الـPDF: ${filename}`
    );
    window.open(`https://wa.me/${to}?text=${text}`, '_blank');
    return { opened: true };
  };

  return { init, sendPDF, isNumberSet, openManualChat };
})();
