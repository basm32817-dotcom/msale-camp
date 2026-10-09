// ============================================================
//  public/js/whatsapp.js — إرسال ملف PDF إلى واتساب الإدارية
//
//  المسار الرسمي (فوري وآلي):
//    يرفع الملف إلى الخادم → الخادم يرسله عبر WhatsApp Cloud API
//    (الوسائط الرسمية من Meta — وليس طريقة وهمية).
//
//  إذا لم يتم ربط واتساب بعد: تُفتح محادثة واتساب الإدارية
//  مع نص جاهز لإرفاق الملف يدويًا — بلا أي إرسال وهمي.
//
//  ملاحظة تقنية: تُحجز نافذة المحادثة (about:blank) ضمن نقرة
//  المستخدم مباشرة، فتمنع المتصفحات من حجبها بعد انتظار تحميل
//  الملف، ثم يُوجَّه النافذة لرابط wa.me عند الحاجة.
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

  /** هل رقم الإدارية مضبوط فعلًا (وليس نصًا بديلًا)؟ */
  const isNumberSet = () => {
    const n = Storage.digitsOnly(APP_CONFIG.WHATSAPP_ADMIN_NUMBER);
    return n.length >= 8;
  };

  /**
   * حجز نافذة متصفح ضمن نقرة المستخدم (يمنع الحجب).
   * يُستدعى فورًا داخل حدث النقر قبل أي await.
   * @returns {Window|null} النافذة المحجوزة أو null إذا لم يُضبط الرقم
   */
  const reserveChatWindow = () => {
    if (!isNumberSet()) return null;
    try {
      const w = window.open('about:blank', '_blank');
      return w;
    } catch {
      return null;
    }
  };

  /**
   * رابط محادثة واتساب الإدارية مع نص جاهز
   */
  const manualUrl = (student, filename) => {
    const to = Storage.digitsOnly(APP_CONFIG.WHATSAPP_ADMIN_NUMBER);
    const text = encodeURIComponent(
      `تسجيل جديد في المعسكر — ${APP_CONFIG.TEACHER} (${APP_CONFIG.TITLE})\n` +
        `الاسم: ${student.name}\n` +
        `رقم الهاتف: ${student.phone}\n` +
        `المرحلة: ${student.stage}\n` +
        `وقت التسجيل: ${student.registeredAtLocal}\n\n` +
        `📎 أرفق ملف الـPDF: ${filename}`
    );
    return `https://wa.me/${to}?text=${text}`;
  };

  /** توجيه النافذة المحجوزة إلى محادثة واتساب */
  const openChatInWindow = (chatWindow, url) => {
    if (chatWindow) {
      try {
        chatWindow.location.href = url;
        return true;
      } catch {
        /* تجاهل — سنفتح بديلًا */
      }
    }
    window.open(url, '_blank');
    return true;
  };

  /** إغلاق النافذة المحجوزة (عند نجاح الإرسال الآلي) */
  const closeChatWindow = (chatWindow) => {
    if (chatWindow) {
      try {
        chatWindow.close();
      } catch {
        /* تجاهل */
      }
    }
  };

  /**
   * إرسال ملف PDF إلى واتساب الإدارية.
   * @param {object} student بيانات الطالب
   * @param {Blob} blob ملف الـPDF
   * @param {string} filename اسم الملف
   * @param {Window|null} [chatWindow] نافذة محجوزة مسبقًا (من reserveChatWindow)
   */
  const sendPDF = async (student, blob, filename, chatWindow = null) => {
    if (!isNumberSet()) {
      return {
        ok: false,
        mode: 'error',
        message:
          'لم يتم ضبط رقم واتساب الإدارية بعد. استبدل النص "ضع رقم الواتساب هنا" برقم فعلي في public/js/config.js.',
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
        closeChatWindow(chatWindow);
        return { ok: true, mode: 'api', message: `تم إرسال ملف ${filename} إلى واتساب الإدارية ✅` };
      }
      // الخادم يعمل لكن واتساب غير مربوط → المحادثة اليدوية الصادقة
      if (body.message) {
        openChatInWindow(chatWindow, manualUrl(student, filename));
        return {
          ok: false,
          mode: 'manual',
          message: `${body.message}\n\nفُتحت محادثة واتساب الإدارية — أرفق الملف ${filename} يدويًا داخل المحادثة.`,
        };
      }
    } catch {
      // الخادم غير متاح إطلاقًا → المحادثة اليدوية الصادقة
      openChatInWindow(chatWindow, manualUrl(student, filename));
      return {
        ok: false,
        mode: 'manual',
        message:
          `الخادم غير متاح، لذا لا يمكن الإرسال الآلي حاليًا. فُتحت محادثة واتساب الإدارية — أرفق الملف ${filename} يدويًا.` +
          ` للإرسال الآلي الكامل: راجع قسم "الربط مع واتساب" في README (خطوات Meta).`,
      };
    }

    return { ok: false, mode: 'error', message: 'تعذر إرسال الملف عبر واتساب. راجع سجل الخادم للمزيد.' };
  };

  return { init, sendPDF, isNumberSet, manualUrl, reserveChatWindow, closeChatWindow };
})();