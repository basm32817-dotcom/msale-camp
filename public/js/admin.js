// ============================================================
//  public/js/admin.js — منطق لوحة الإدارة
// ============================================================

(() => {
  const tbody = document.getElementById('students-body');
  const searchInput = document.getElementById('search-input');
  const countEl = document.getElementById('students-count');
  const todayEl = document.getElementById('today-count');
  const emptyState = document.getElementById('empty-state');
  const refreshBtn = document.getElementById('refresh-btn');
  const storageNote = document.getElementById('storage-note');

  let students = [];

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const digitsOnly = Storage.digitsOnly;

  // ----------------------------------------------------------
  //  تحميل البيانات
  // ----------------------------------------------------------
  const load = async () => {
    students = await Storage.list();
    // تنبيه إن كانت هناك بيانات محفوظة محليًا (خادم غير متاح)
    const hasLocal = students.some((s) => String(s.id).startsWith('LOC-'));
    storageNote.hidden = !hasLocal;
    render();
  };

  // ----------------------------------------------------------
  //  البحث بالاسم أو رقم الهاتف
  // ----------------------------------------------------------
  searchInput.addEventListener('input', render);

  const filtered = () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return students;
    const qDigits = digitsOnly(q);
    return students.filter((s) => {
      const byName = String(s.name).toLowerCase().includes(q);
      const byPhone = qDigits ? digitsOnly(s.phone).includes(qDigits) : false;
      return byName || byPhone;
    });
  };

  // ----------------------------------------------------------
  //  رسم الجدول
  // ----------------------------------------------------------
  function render() {
    const list = filtered();
    countEl.textContent = students.length;
    todayEl.textContent = students.filter((s) => String(s.registeredAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

    if (!list.length) {
      tbody.innerHTML = '';
      emptyState.hidden = false;
      emptyState.querySelector('p').textContent = students.length
        ? 'لا توجد نتائج مطابقة لبحثك.'
        : 'لا يوجد طلاب مسجلون بعد. ابدأ من صفحة الاستمارة.';
      return;
    }
    emptyState.hidden = true;

    tbody.innerHTML = list
      .map(
        (s, i) => `
      <tr data-id="${escapeHtml(s.id)}">
        <td class="col-index" data-label="#"> ${i + 1}</td>
        <td data-label="الاسم"><strong>${escapeHtml(s.name)}</strong></td>
        <td data-label="رقم الهاتف"><span dir="ltr">${escapeHtml(s.phone)}</span></td>
        <td data-label="المرحلة"><span class="badge">${escapeHtml(s.stage)}</span></td>
        <td data-label="المكان">${escapeHtml(s.location || '—')}</td>
        <td data-label="تاريخ التسجيل"><span class="date">${escapeHtml(s.registeredAtLocal || '—')}</span></td>
        <td data-label="إجراءات" class="actions">
          <button class="icon-btn pdf" title="إنشاء ملف PDF" data-action="pdf">📄 PDF</button>
          <button class="icon-btn wa" title="إرسال إلى واتساب الإدارية" data-action="wa">📲 واتساب</button>
          <button class="icon-btn delete" title="حذف الطالب" data-action="delete">🗑️</button>
        </td>
      </tr>`
      )
      .join('');
  }

  // ----------------------------------------------------------
  //  إجراءات الصف
  // ----------------------------------------------------------
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const row = btn.closest('tr');
    const student = students.find((s) => s.id === row.dataset.id);
    if (!student) return;

    const original = btn.innerHTML;
    const busy = (text) => {
      btn.disabled = true;
      btn.textContent = text;
    };
    const idle = () => {
      btn.disabled = false;
      btn.innerHTML = original;
    };

    try {
      if (btn.dataset.action === 'pdf') {
        busy('جارٍ…');
        await PDFBuilder.download(student);
      } else if (btn.dataset.action === 'wa') {
        busy('جارٍ…');
        // حجز النافذة ضمن نقرة المستخدم قبل أي انتظار
        const chatWindow = WhatsAppSender.reserveChatWindow();
        const { blob, filename } = await PDFBuilder.toBlob(student);
        const result = await WhatsAppSender.sendPDF(student, blob, filename, chatWindow);
        alert(result.message);
      } else if (btn.dataset.action === 'delete') {
        if (!confirm(`هل تريد حذف الطالب "${student.name}" نهائيًا؟`)) return;
        busy('حذف…');
        await Storage.remove(student.id);
        await load();
        return;
      }
    } catch (err) {
      alert('حدث خطأ أثناء تنفيذ العملية.');
      console.error(err);
    } finally {
      idle();
    }
  });

  refreshBtn.addEventListener('click', load);

  // ----------------------------------------------------------
  //  PDF لكل الطلاب المسجلين
  // ----------------------------------------------------------
  const allPdfBtn = document.getElementById('all-pdf-btn');
  allPdfBtn.addEventListener('click', async () => {
    if (!students.length) {
      alert('لا يوجد طلاب مسجلون بعد لإنشاء القائمة.');
      return;
    }
    const original = allPdfBtn.innerHTML;
    allPdfBtn.disabled = true;
    allPdfBtn.textContent = 'جارٍ الإنشاء…';
    try {
      const filename = await PDFBuilder.allStudentsPDF(students);
      alert(`✅ تم إنشاء ملف PDF يضم ${students.length} طالبًا (${filename})`);
    } catch (err) {
      alert('تعذر إنشاء ملف PDF لكل الطلاب. تأكد من الاتصال بالإنترنت (لمكتبة PDF) ثم أعد المحاولة.');
      console.error(err);
    } finally {
      allPdfBtn.disabled = false;
      allPdfBtn.innerHTML = original;
    }
  });

  // ----------------------------------------------------------
  //  نسخ رابط لوحة الإدارة إلى الحافظة
  // ----------------------------------------------------------
  const copyToast = document.getElementById('copy-toast');
  const copyLinkBtn = document.getElementById('copy-link-btn');

  const showToast = (message, ok = true) => {
    copyToast.textContent = message;
    copyToast.className = 'copy-toast ' + (ok ? 'ok' : 'error');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      copyToast.className = 'copy-toast';
      copyToast.textContent = '';
    }, 4000);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // بديل للمتصفحات التي ترفض Clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      ta.remove();
      return copied;
    }
  };

  copyLinkBtn.addEventListener('click', async () => {
    const url = window.location.href;
    const copied = await copyToClipboard(url);
    if (copied) {
      showToast(`✅ تم نسخ الرابط:\n${url}`);
    } else {
      showToast('⚠️ تعذر النسخ تلقائيًا — انسخ الرابط من شريط العنوان: ' + url, false);
    }
  });

  // ----------------------------------------------------------
  //  تهيئة
  // ----------------------------------------------------------
  (async () => {
    await WhatsAppSender.init();

    // مؤشر حالة التخزين في ترويسة اللوحة
    const badge = document.getElementById('cloud-badge');
    if (badge) {
      badge.textContent = Storage.cloudConfigured() ? '☁️ سحابي' : '💾 محلي';
      badge.dataset.mode = Storage.cloudConfigured() ? 'cloud' : 'local';
    }

    await load();
  })();
})();
