// ============================================================
//  public/js/app.js — منطق صفحة استمارة التسجيل
// ============================================================

(() => {
  const form = document.getElementById('registration-form');
  const submitBtn = document.getElementById('submit-btn');
  const successModal = document.getElementById('success-modal');
  const successDetails = document.getElementById('success-details');
  const numberNotice = document.getElementById('number-notice');

  let lastStudent = null;

  // ----------------------------------------------------------
  //  قائمة المرحلة الدراسية (أولى/ثانية/ثالثة ثانوي فقط)
  // ----------------------------------------------------------
  const stageSelect = document.getElementById('stage');
  APP_CONFIG.STAGES.forEach((stage) => {
    const opt = document.createElement('option');
    opt.value = stage;
    opt.textContent = stage;
    stageSelect.appendChild(opt);
  });

  // ----------------------------------------------------------
  //  أدوات المساعدة
  // ----------------------------------------------------------
  const FIELDS = ['name', 'phone', 'stage', 'location'];

  const setError = (field, message) => {
    const input = form.elements[field];
    const errorEl = document.getElementById(`error-${field}`);
    if (input) input.classList.toggle('invalid', Boolean(message));
    if (errorEl) errorEl.textContent = message || '';
  };

  const clearErrors = () => {
    FIELDS.forEach((f) => setError(f, ''));
  };

  const setLoading = (loading) => {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
    submitBtn.querySelector('.btn-text').textContent = loading ? 'جارٍ التسجيل…' : 'تسجيل الطالب';
  };

  // ----------------------------------------------------------
  //  إرسال النموذج
  // ----------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const data = {
      name: form.elements.name.value,
      phone: form.elements.phone.value,
      stage: form.elements.stage.value,
      location: form.elements.location.value,
    };

    // 1) التأكد من إدخال جميع البيانات
    const { valid, errors } = Storage.validate(data);
    if (!valid) {
      Object.entries(errors).forEach(([field, message]) => setError(field, message));
      const firstInvalid = form.querySelector('.invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // 2) حفظ بيانات الطالب + 3) تجهيز ملف PDF
    setLoading(true);
    try {
      const { student } = await Storage.create(data);
      lastStudent = student;
      showSuccess(student);
    } catch (err) {
      if (err.validation) {
        Object.entries(err.validation).forEach(([field, message]) => setError(field, message));
      } else {
        alert('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  });

  // إزالة رسالة الخطأ فورًا عند الكتابة
  FIELDS.forEach((f) => {
    const input = form.elements[f];
    input.addEventListener('input', () => setError(f, ''));
    input.addEventListener('change', () => setError(f, ''));
  });

  // ----------------------------------------------------------
  //  رسالة النجاح
  // ----------------------------------------------------------
  const showSuccess = (student) => {
    successDetails.innerHTML = `
      <div class="detail-row"><span>الاسم</span><strong>${escapeHtml(student.name)}</strong></div>
      <div class="detail-row"><span>رقم الهاتف</span><strong dir="ltr">${escapeHtml(student.phone)}</strong></div>
      <div class="detail-row"><span>المرحلة</span><strong>${escapeHtml(student.stage)}</strong></div>
      <div class="detail-row"><span>المكان</span><strong>${escapeHtml(student.location || '—')}</strong></div>
      <div class="detail-row"><span>وقت التسجيل</span><strong>${escapeHtml(student.registeredAtLocal)}</strong></div>`;
    successModal.classList.add('open');
    successModal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    successModal.classList.remove('open');
    successModal.setAttribute('aria-hidden', 'true');
  };

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ----------------------------------------------------------
  //  أزرار ما بعد التسجيل
  // ----------------------------------------------------------
  document.getElementById('btn-download-pdf').addEventListener('click', async () => {
    if (!lastStudent) return;
    const btn = document.getElementById('btn-download-pdf');
    btn.disabled = true;
    try {
      await PDFBuilder.download(lastStudent);
    } catch (err) {
      alert('تعذر إنشاء ملف PDF. تأكد من اتصال الإنترنت (لتحميل مكتبة PDF) ثم أعد المحاولة.');
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-send-whatsapp').addEventListener('click', async () => {
    if (!lastStudent) return;
    const btn = document.getElementById('btn-send-whatsapp');
    const status = document.getElementById('whatsapp-status');

    // حجز نافذة المحادثة ضمن نقرة المستخدم قبل أي انتظار (يمنع المتصفح من حجبها)
    const chatWindow = WhatsAppSender.reserveChatWindow();

    btn.disabled = true;
    status.textContent = 'جارٍ تجهيز الملف وإرساله…';
    try {
      const { blob, filename } = await PDFBuilder.toBlob(lastStudent);
      const result = await WhatsAppSender.sendPDF(lastStudent, blob, filename, chatWindow);
      status.textContent = result.message;
      status.className = 'wa-status ' + (result.ok ? 'ok' : result.mode === 'manual' ? 'warn' : 'error');
    } catch (err) {
      status.textContent = 'تعذر إنشاء الملف أو إرساله، يرجى المحاولة مرة أخرى.';
      status.className = 'wa-status error';
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-register-another').addEventListener('click', () => {
    closeModal();
    form.reset();
    document.getElementById('whatsapp-status').textContent = '';
    form.elements.name.focus();
  });

  // إغلاق النافذة
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ----------------------------------------------------------
  //  تهيئة: رقم واتساب الإدارية + حالة التخزين السحابي
  // ----------------------------------------------------------
  const init = async () => {
    await WhatsAppSender.init();
    if (!WhatsAppSender.isNumberSet() && numberNotice) {
      numberNotice.hidden = false;
    }
    const cloudStatus = document.getElementById('cloud-status');
    if (cloudStatus) {
      cloudStatus.hidden = false;
      cloudStatus.className = 'cloud-status ' + (Storage.cloudConfigured() ? 'ok' : 'warn');
      cloudStatus.textContent = Storage.cloudConfigured()
        ? '☁️ التخزين عبر الإنترنت مفعّل — التسجيلات تُجمع من كل الأجهزة في مكان واحد.'
        : '⚠️ التخزين محلي على هذا الجهاز فقط — فعّل Firebase في إعدادات المشروع لتُجمع التسجيلات من كل الهواتف (راجع README قسم "النشر في كل مكان").';
    }
  };
  init();

  // إظهار/إخفاء تنبيه الرقم في footer حسب الإعداد
  if (numberNotice) {
    numberNotice.textContent =
      '⚠️ لم يتم ضبط رقم واتساب الإدارية بعد — استبدل "ضع رقم الواتساب هنا" برقم فعلي في public/js/config.js وملف .env.';
  }
})();
