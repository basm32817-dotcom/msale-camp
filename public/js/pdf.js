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
        ${row('المكان', student.location || '—')}
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

  // ==========================================================
  //  📄 PDF لكل الطلاب المسجلين (مع دعم تعدد الصفحات)
  // ==========================================================
  const ROWS_PER_PAGE = 18; // أقصى عدد صفوف تقريبًا في صفحة A4

  const stampNow = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  };

  /** بناء صفحة القائمة (ترويسة + جدول + تذييل صفحة) */
  const buildAllDoc = (chunk, globalStart, pageNum, totalPages, totalStudents) => {
    const old = document.getElementById('pdf-doc-temp');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'pdf-doc-temp';
    wrap.className = 'pdf-doc pdf-all-doc';
    wrap.dir = 'rtl';

    const rows = chunk
      .map(
        (s, i) => `
        <tr>
          <td>${globalStart + i + 1}</td>
          <td><strong>${String(s.name || '—')}</strong></td>
          <td dir="ltr">${Storage.digitsOnly(s.phone) || '—'}</td>
          <td>${String(s.stage || '—')}</td>
          <td>${String(s.location || '—')}</td>
          <td>${String(s.registeredAtLocal || '—')}</td>
        </tr>`
      )
      .join('');

    wrap.innerHTML = `
      <div class="pdf-head">
        <div class="pdf-teacher">${APP_CONFIG.TEACHER}</div>
        <div class="pdf-title-badge">${APP_CONFIG.TITLE}</div>
        <h2 class="pdf-camp">قائمة الطلاب المسجلين في ${APP_CONFIG.CAMP}</h2>
        <div class="pdf-line"></div>
        <div class="pdf-meta">
          إجمالي الطلاب المسجلين: <strong>${totalStudents}</strong>
          &nbsp;·&nbsp; تاريخ إنشاء القائمة: <strong>${Storage.formatDateTime(new Date())}</strong>
        </div>
      </div>
      <table class="pdf-table pdf-all-table">
        <colgroup>
          <col style="width:6%" />
          <col style="width:26%" />
          <col style="width:14%" />
          <col style="width:16%" />
          <col style="width:16%" />
          <col style="width:22%" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>اسم الطالب</th>
            <th>رقم الهاتف</th>
            <th>المرحلة</th>
            <th>المكان</th>
            <th>تاريخ التسجيل</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="pdf-foot">صفحة ${pageNum} من ${totalPages} · تم إنشاء هذه القائمة آليًا عبر نظام تسجيل الطلاب في ${APP_CONFIG.CAMP}</div>`;

    document.body.appendChild(wrap);
    return wrap;
  };

  const waitFonts = async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 40));
  };

  /** توليد وتحميل ملف PDF يضم كل الطلاب */
  const allStudentsPDF = async (students) => {
    const sorted = [...students].sort((a, b) =>
      String(b.registeredAt || '').localeCompare(String(a.registeredAt || ''))
    );
    if (!sorted.length) throw new Error('لا يوجد طلاب لإنشاء القائمة.');

    const chunks = [];
    for (let i = 0; i < sorted.length; i += ROWS_PER_PAGE) {
      chunks.push(sorted.slice(i, i + ROWS_PER_PAGE));
    }

    const pdf = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    pdf.setProperties({ title: `قائمة الطلاب المسجلين - ${APP_CONFIG.TEACHER}` });

    const contentWidth = PAGE_WIDTH_MM - 20; // هامش 10مم لكل جانب
    const x = (PAGE_WIDTH_MM - contentWidth) / 2;
    const maxHeight = 281; // أقصى ارتفاع لمساحة المحتوى في صفحة A4

    for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
      const node = buildAllDoc(chunks[pageIdx], pageIdx * ROWS_PER_PAGE, pageIdx + 1, chunks.length, sorted.length);
      await waitFonts();
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      node.remove();

      const contentHeight = Math.min((canvas.height * contentWidth) / canvas.width, maxHeight);
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, 8, contentWidth, contentHeight);
    }

    const filename = `all-students-${stampNow()}.pdf`;
    pdf.save(filename);
    return filename;
  };

  return { generate, download, toBlob, fileName, allStudentsPDF };
})();
