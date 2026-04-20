import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFHeaderConfig {
  title: string;
  subtitle?: string;
  studentName?: string;
  studentId?: string;
  sectionName?: string;
  dateStr?: string;
}

export const reports = {
  generateHeader: (doc: jsPDF, config: PDFHeaderConfig) => {
    // Branding
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADTRACK ACADEMY', 105, 20, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('123 Academic Way, Science City, Philippines', 105, 26, { align: 'center' });
    doc.text('Contact: (02) 888-TRACK | email: info@acadtrack.edu.ph', 105, 31, { align: 'center' });
    
    // Thin line
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    
    // Document Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(config.title.toUpperCase(), 105, 45, { align: 'center' });
    
    if (config.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(config.subtitle, 105, 51, { align: 'center' });
    }
    
    // Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let y = 60;
    
    if (config.studentName) {
      doc.text(`Student: ${config.studentName}`, 20, y);
      doc.text(`ID: ${config.studentId || 'N/A'}`, 190, y, { align: 'right' });
      y += 6;
    }
    
    if (config.sectionName) {
      doc.text(`Section: ${config.sectionName}`, 20, y);
    }
    
    doc.text(`Date Generated: ${config.dateStr || new Date().toLocaleDateString()}`, 190, y, { align: 'right' });
    
    return y + 10;
  },

  generateSignature: (doc: jsPDF, roles: string[]) => {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth  = doc.internal.pageSize.width;
    let y = pageHeight - 40;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (roles.length === 1) {
      const role = roles[0];
      doc.line(75, y, 135, y);
      doc.text(role, 105, y + 5, { align: 'center' });
    } else if (roles.length === 2) {
      // Left
      doc.line(30, y, 90, y);
      doc.text(roles[0], 60, y + 5, { align: 'center' });
      
      // Right
      doc.line(120, y, 180, y);
      doc.text(roles[1], 150, y + 5, { align: 'center' });
    }
  },

  exportTranscript: (data: { student: any, grades: any[] }) => {
    const doc = new jsPDF();
    const yStart = reports.generateHeader(doc, {
      title: 'Official Academic Transcript',
      subtitle: 'Complete Grade History',
      studentName: `${data.student.last_name}, ${data.student.first_name}`,
      studentId: data.student.user_id
    });

    const body = data.grades.map(g => [
      `${g.term} ${g.school_year}`,
      g.subject_code,
      g.subject_title,
      g.prelim_grade || '—',
      g.midterm_grade || '—',
      g.final_grade || '—',
      g.remarks || 'Pending'
    ]);

    autoTable(doc, {
      startY: yStart,
      head: [['Semester', 'Code', 'Subject', 'Pre', 'Mid', 'Fin', 'Remarks']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
      }
    });

    reports.generateSignature(doc, ['UNIVERSITY REGISTRAR']);
    doc.save(`transcript_${data.student.user_id}.pdf`);
  },

  exportGradeReport: (data: { section: any, grades: any[] }) => {
    const doc = new jsPDF();
    const yStart = reports.generateHeader(doc, {
      title: 'Class Grade Report',
      subtitle: `${data.section.subject_code} - ${data.section.subject_title}`,
      sectionName: data.section.section_name,
      dateStr: new Date().toLocaleDateString()
    });

    const body = data.grades.map((g, i) => [
      i + 1,
      g.user_id,
      `${g.last_name}, ${g.first_name}`,
      g.prelim_grade || '—',
      g.midterm_grade || '—',
      g.final_grade || '—',
      g.average || '—',
      g.remarks || '—'
    ]);

    autoTable(doc, {
      startY: yStart,
      head: [['#', 'ID', 'Student Name', 'Pre', 'Mid', 'Fin', 'Avg', 'Remarks']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [52, 73, 94] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 25 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 15, halign: 'center' },
      }
    });

    reports.generateSignature(doc, ['SUBJECT INSTRUCTOR', 'SCHOOL DEAN']);
    doc.save(`grades_${data.section.section_name}.pdf`);
  },

  exportAttendance: (data: { section: any, students: any[], records: any[], month: string, year: string }) => {
    const doc = new jsPDF('landscape');
    const yStart = reports.generateHeader(doc, {
      title: 'Monthly Attendance Log',
      subtitle: `${data.month} ${data.year} | ${data.section.subject_code}`,
      sectionName: data.section.section_name
    });

    const daysInMonth = new Date(Number(data.year), new Date(Date.parse(data.month +" 1, "+data.year)).getMonth() + 1, 0).getDate();
    const dayCols = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    
    const head = [['Student Name', ...dayCols, 'P', 'L', 'A']];
    const body = data.students.map(s => {
      const row: any[] = [`${s.full_name}`];
      let p=0, l=0, a=0;
      for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${data.year}-${String(new Date(Date.parse(data.month +" 1, "+data.year)).getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const rec = data.records.find(r => r.user_id === s.user_id && r.date.startsWith(dStr));
        if (rec) {
          if (rec.status === 'Present') { row.push('•'); p++; }
          else if (rec.status === 'Late') { row.push('L'); l++; }
          else if (rec.status === 'Absent') { row.push('X'); a++; }
          else row.push('');
        } else {
          row.push('');
        }
      }
      row.push(p, l, a);
      return row;
    });

    autoTable(doc, {
      startY: yStart,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1 },
      headStyles: { fillColor: [44, 62, 80] },
      columnStyles: {
        0: { cellWidth: 40 },
        // Dates are auto-sized
      }
    });

    reports.generateSignature(doc, ['INSTRUCTOR', 'REGISTRAR']);
    doc.save(`attendance_${data.section.section_name}_${data.month}.pdf`);
  },

  exportEnrollmentSlip: (data: { student: any, section: any }) => {
    const doc = new jsPDF();
    const yStart = reports.generateHeader(doc, {
      title: 'Enrollment Confirmation Slip',
      subtitle: 'Official Registration Document',
      studentName: `${data.student.last_name}, ${data.student.first_name}`,
      studentId: data.student.user_id,
      sectionName: data.section.section_name,
      dateStr: new Date().toLocaleDateString()
    });

    const info = [
      ['Course / Program', data.student.course_name || 'N/A'],
      ['Subject Assigned', `${data.section.subject_code} - ${data.section.subject_title}`],
      ['Section Code', data.section.section_name],
      ['Units', String(data.section.credit_units || '3.0')],
      ['Status', 'OFFICIALLY ENROLLED']
    ];

    autoTable(doc, {
      startY: yStart,
      head: [['Field', 'Details']],
      body: info,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 }
      }
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Note: Please present this slip to your instructor to be added to the official class list.', 20, doc.internal.pageSize.height - 60);

    reports.generateSignature(doc, ['UNIVERSITY REGISTRAR']);
    doc.save(`enrollment_slip_${data.student.user_id}.pdf`);
  }
};
