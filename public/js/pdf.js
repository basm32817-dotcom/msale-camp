// ============================================================
//  public/js/pdf.js — توليد ملف PDF منظم لاستمارة التسجيل
//  يُنشئ بطاقة HTML أنيقة ثم يحوّلها إلى PDF بجودة عالية
//  (html2canvas + jsPDF) — النص العربي يظهر بشكل صحيح 100%.
// ============================================================

const PDFBuilder = (() => {
  const SCALE = 2; // جودة عالية
  const PAGE_WIDTH_MM = 210; // عرض A4

  /** بناء بطاقة الاستمارة بصيغة HTML (تُخفي في الصفحة أثناء الرسم) */
  const buildDoc = (student) => {
    const old = document.getElementById('pdf-doc-temp');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'pdf-doc-temp';
    wrap.className = 'pdf-doc';
    wrap.dir = 'rtl';

    const row = (label, value) => `
      <tr>
        <td class="pdf-label">${label}</td>
        <td class="pdf-value">${String(value ?? '—')}</td>
      </tr>`;

    wrap.innerHTML = `
      <div class="pdf-head">
        <div class="pdf-teacher">${APP_CONFIG.TEACHER}</div>
        <div class="pdf-title-badge">${APP_CONFIG.TITLE}</div>
        <h2 class="pdf-camp">استمارة تسجيل الطلاب في ${APP_CONFIG.CAMP}</h2>
        <div class="pdf-line"></div>
      </div>
      <table class="pdf-table">
        ${row('اسم الطالب', student.name)}
        ${row('رقم الهاتف', Storage.digitsOnly(student.phone))}
        ${row('المرحلة الدراسية', student.stage)}
        ${row('اسم الأستاذ', APP_CONFIG.TEACHER)}
        ${row('اللقب', APP_CONFIG.TITLE)}
        ${row('تاريخ ووقت التسجيل', student.registeredAtLocal || Storage.formatDateTime(new Date(student.registeredAt)))}
      </table>
      <div class="pdf-foot">
        تم إنشاء هذا الملف آليًا عبر نظام تسجيل الطلاب في ${APP_CONFIG.CAMP}
      </div>`;

    document.body.appendChild(wrap);
    return wrap;
  };

  /** تحويل البطاقة إلى صورة ثم إلى ملف PDF */
  const generate = async (student) => {
    const node = buildDoc(student);
    try {
      // انتظار تحميل الخطوط لضمان رسم النص العربي بشكل صحيح
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 50));

      const canvas = await html2canvas(node, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const img = canvas.toDataURL('image/png');
      const pdf = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const contentWidth = PAGE_WIDTH_MM - 20; // هامش 10مم لكل جانب
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      const x = (PAGE_WIDTH_MM - contentWidth) / 2;
      pdf.addImage(img, 'PNG', x, 10, contentWidth, contentHeight);
      return pdf;
    } finally {
      node.remove();
    }
  };

  /** اسم ملف واضح ومرتب */
  const fileName = (student) => {
    const d = new Date(student.registeredAt || Date.now());
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    const phone = Storage.digitsOnly(student.phone) || 'student';
    return `registration-${phone}-${stamp}.pdf`;
  };

  /** توليد + تحميل الملف مباشرة */
  const download = async (student) => {
    const pdf = await generate(student);
    pdf.save(fileName(student));
    return fileName(student);
  };

  /** توليد + إرجاع Blob (للإرسال عبر واتساب) */
  const toBlob = async (student) => {
    const pdf = await generate(student);
    const blob = pdf.output('blob');
    return { blob, filename: fileName(student) };
  };

  return { generate, download, toBlob, fileName };
})();
