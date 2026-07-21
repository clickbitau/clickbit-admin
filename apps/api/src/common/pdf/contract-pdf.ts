// @ts-nocheck
/**
 * Contract PDF Generation Service
 * Generates employment contracts matching the ClickBit contract format.
 * Uses PDFKit with the same Sora fonts and branding as the invoice PDF.
 * Company address is passed in by the caller.
 */

import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

const FONTS_DIR = process.env.FONTS_DIR || path.join(process.cwd(), 'fonts');
const FONTS = {
  regular: path.join(FONTS_DIR, 'Sora-Regular.ttf'),
  medium: path.join(FONTS_DIR, 'Sora-Medium.ttf'),
  semibold: path.join(FONTS_DIR, 'Sora-SemiBold.ttf'),
  bold: path.join(FONTS_DIR, 'Sora-Bold.ttf'),
  cursive: path.join(FONTS_DIR, 'DancingScript-Regular.ttf')
};

const BASE_COLORS = {
  teal: '#1FBBD2',
  orange: '#F39C12',
  navy: '#0F172A',
  black: '#0F172A',
  gray: '#475569',
  lightGray: '#94A3B8',
  bgSlate: '#F8FAFC',
  borderSlate: '#E2E8F0',
  white: '#FFFFFF'
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 56
};

const FOOTER_Y = 803;
const MAX_Y = 758;
const CONTENT_WIDTH = PAGE.width - (PAGE.margin * 2);

function getColors(settings) {
  return { ...BASE_COLORS, ...(settings?.colors || {}) };
}

function getLabel(settings, key, fallback) {
  return settings?.labels?.[key] ?? fallback;
}

function isVisible(settings, key, fallback = true) {
  return settings?.visibility?.[key] ?? fallback;
}

/**
 * Format date to human readable
 */
function fmtDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format currency amount
 */
function fmtCurrency(amount, currency = 'AUD') {
  if (amount === null || amount === undefined) return 'N/A';
  const num = parseFloat(amount);
  if (currency === 'BDT') return `BDT ${num.toLocaleString('en-AU')}`;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(num);
}

/**
 * Main: Generate Employment Contract PDF
 */
async function generateContractPDF(contractData): Promise<Buffer> {
  contractData.templateSettings = contractData.templateSettings || {};
  const settings = contractData.templateSettings;
  const COLORS = getColors(settings);
  const companyAddress = contractData.companyAddress || '19 Drysdale Approach Baldivis WA 6171';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE.margin,
        bufferPages: true,
        autoFirstPage: true
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Register fonts
      const hasSoraFonts = fs.existsSync(FONTS.regular);
      let fonts = { regular: 'Helvetica', medium: 'Helvetica', semiBold: 'Helvetica-Bold', bold: 'Helvetica-Bold' };

      if (hasSoraFonts) {
        doc.registerFont('Sora', FONTS.regular);
        doc.registerFont('Sora-Medium', FONTS.medium);
        doc.registerFont('Sora-SemiBold', FONTS.semibold);
        doc.registerFont('Sora-Bold', FONTS.bold);
        fonts = { regular: 'Sora', medium: 'Sora-Medium', semiBold: 'Sora-SemiBold', bold: 'Sora-Bold' };
      }

      // Register cursive font for signatures (always — falls back to Helvetica-Oblique if missing)
      if (fs.existsSync(FONTS.cursive)) {
        doc.registerFont('DancingScript', FONTS.cursive);
        fonts.cursive = 'DancingScript';
      } else {
        fonts.cursive = 'Helvetica-Oblique';
      }

      // ========================================
      // PAGE 1: OFFER LETTER
      // ========================================
      renderOfferLetter(doc, contractData, fonts, companyAddress);

      // ========================================
      // PAGE 2+: EMPLOYMENT CONTRACT
      // ========================================
      doc.addPage();
      let y = renderContractHeader(doc, contractData, fonts);
      y = renderKeyTerms(doc, contractData, fonts, y);
      y = renderResponsibilities(doc, contractData, fonts, y);
      y = renderCompensation(doc, contractData, fonts, y);
      y = renderScheduleAndLeave(doc, contractData, fonts, y);
      y = renderDutiesAndConduct(doc, contractData, fonts, y);
      y = renderConfidentiality(doc, contractData, fonts, y);
      y = renderRestraintAndCompetition(doc, contractData, fonts, y);
      y = renderPropertyAndNotices(doc, contractData, fonts, y);
      y = renderTermination(doc, contractData, fonts, y);
      y = renderSignatures(doc, contractData, fonts, y);

      // Footer on all pages
      renderFooterOnAllPages(doc, fonts, companyAddress, settings);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderOfferLetter(doc, data, fonts, companyAddress) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const employee = data.employee || {};
  const user = employee.user || {};
  const employeeName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employee';

  let y = PAGE.margin;

  // Logo (top-right to avoid overlap with title)
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logos', 'logo-full.png');
  const logoPathAlt = path.join(process.cwd(), 'images', 'logos', 'logo-full.png');
  const logoX = PAGE.width - PAGE.margin - 100;

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, logoX, y, { width: 100 });
  } else if (fs.existsSync(logoPathAlt)) {
    doc.image(logoPathAlt, logoX, y, { width: 100 });
  } else {
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(20)
      .text('click', logoX, y, { continued: true, lineBreak: false })
      .fillColor(COLORS.orange).text('bit', { continued: true, lineBreak: false })
      .fillColor(COLORS.lightGray).fontSize(9).text('.com.au', { lineBreak: false });
  }

  // Title (left side, clear of logo)
  doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(22)
    .text(getLabel(settings, 'offerOfEmploymentTitle', 'Offer of Employment'), PAGE.margin, y + 8, { width: CONTENT_WIDTH - 120 });
  y += 55;

  // Company address
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(companyAddress, PAGE.margin, y);
  y += 18;

  // Date
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(`Date: ${fmtDate(data.start_date || new Date().toISOString().split('T')[0])}`, PAGE.margin, y);
  y += 25;

  // To
  doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(10)
    .text('To:', PAGE.margin, y);
  y += 15;
  doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(12)
    .text(employeeName, PAGE.margin, y);
  y += 15;
  if (user.email) {
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(user.email, PAGE.margin, y);
    y += 14;
  }
  // Employee address
  const empAddr = [employee.address, employee.city, employee.state, employee.postcode, employee.country]
    .filter(Boolean).join(', ');
  if (empAddr) {
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(empAddr, PAGE.margin, y);
    y += 14;
  }

  y += 10;

  // Greeting
  doc.fillColor(COLORS.navy).font(fonts.regular).fontSize(10)
    .text(`Dear ${user.first_name || employeeName},`, PAGE.margin, y);
  y += 25;

  // Offer text
  const position = data.position || 'Employee';
  const empType = (data.employment_type || 'full_time').replace('_', ' ');
  const empTypeLabel = empType.charAt(0).toUpperCase() + empType.slice(1);

  doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(10)
    .text(`Re: Employment Offer – ${position} at ClickBit`, PAGE.margin, y);
  y += 25;

  // Get manager name
  const manager = data.contractManager || {};
  const managerUser = manager.user || {};
  const managerName = `${managerUser.first_name || ''} ${managerUser.last_name || ''}`.trim() || 'Management';
  const managerTitle = manager.position || 'Manager';
  const isCasual = data.employment_type === 'casual';
  const isPartTime = data.employment_type === 'part_time';
  const isContractor = data.employment_type === 'contractor';

  let offerBodyLines;
  if (isCasual) {
    offerBodyLines = `We are pleased to offer you a casual position of ${position} at ClickBit. As a casual employee, you will be engaged on an as-needed basis with no guarantee of ongoing hours. Your engagement is governed by the terms and conditions set out in the attached Employment Agreement.

Casual employees are entitled to a 25% casual loading in lieu of annual leave, personal/carer's leave, and other leave entitlements applicable to permanent employees.

Should you have any questions, please contact us directly at +61 2 7229 9577.

To accept this offer, please sign and return this letter along with the attached agreement.

We look forward to working with you.`;
  } else if (isPartTime) {
    offerBodyLines = `We are pleased to offer you the part-time position of ${position} at ClickBit. Your agreed hours and days of work are set out in the attached Employment Contract.

As a part-time employee, you are entitled to pro-rata entitlements (annual leave, personal leave, etc.) based on your agreed hours relative to a full-time equivalent.

Should you have any questions, please contact us directly at +61 2 7229 9577.

To accept this offer, please sign and return this letter along with the attached contract.

We look forward to welcoming you to the ClickBit team.`;
  } else if (isContractor) {
    offerBodyLines = `We are pleased to engage you as a ${position} at ClickBit on a contractor basis. This engagement is governed by the terms and conditions set out in the attached Contractor Agreement.

As an independent contractor, you are responsible for your own tax obligations including GST (if applicable). No leave entitlements or superannuation contributions are provided under this engagement.

Should you have any questions, please contact us directly at +61 2 7229 9577.

To accept this engagement, please sign and return this letter along with the attached agreement.

We look forward to working with you.`;
  } else {
    offerBodyLines = `We are pleased to offer you the ${empTypeLabel.toLowerCase()} position of ${position} at ClickBit. This position is governed by the terms and conditions set out in the attached Employment Contract.

Should you have any questions, please contact us directly at +61 2 7229 9577.

To accept this offer, please sign and return this letter along with the attached contract.

We look forward to welcoming you to the ClickBit team.`;
  }

  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(10)
    .text(offerBodyLines, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 4 });
  y = doc.y + 30;

  // Signature line — uses reporting manager
  doc.fillColor(COLORS.navy).font(fonts.medium).fontSize(10)
    .text('Warm regards,', PAGE.margin, y);
  y += 15;
  doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(11)
    .text(managerName, PAGE.margin, y);
  y += 15;
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(`${managerTitle}, ClickBit`, PAGE.margin, y);

  y += 50;

  // Divider
  doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .stroke();
  y += 25;

  // Acceptance section
  doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(14)
    .text('Acceptance of Offer', PAGE.margin, y);
  y += 20;

  const acceptText = `I, ${employeeName}, acknowledge that I have read and understood the terms and conditions in the attached Employment Contract. I have raised and discussed any queries with the employer, and they have been addressed. I confirm receipt of this letter and the attached contract.`;

  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(acceptText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 30;

  // Signature fields
  const sigWidth = CONTENT_WIDTH / 2 - 15;
  const isSigned = !!(data.employee_accepted_at && data.employee_signature_name);

  if (isSigned) {
    // Cap employee sign date to 1 day before contract start (even if accepted later)
    const empAcceptedAt = new Date(data.employee_accepted_at);
    let empSignDate = empAcceptedAt;
    if (data.start_date) {
      const startD = new Date(data.start_date + 'T00:00:00');
      const dayBefore = new Date(startD);
      dayBefore.setDate(dayBefore.getDate() - 1);
      if (empAcceptedAt >= startD) empSignDate = dayBefore;
    }
    const acceptedDate = empSignDate.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Perth', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Signature label
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
      .text('Employee Signature:', PAGE.margin, y);
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
      .text('Date:', PAGE.margin + sigWidth + 30, y);
    y += 4;

    // Cursive name
    doc.fillColor(COLORS.navy).font(fonts.cursive).fontSize(20)
      .text(data.employee_signature_name, PAGE.margin, y, { width: sigWidth });
    // Date value
    doc.fillColor(COLORS.navy).font(fonts.regular).fontSize(9)
      .text(acceptedDate, PAGE.margin + sigWidth + 30, y + 6, { width: sigWidth });
    y += 26;

    // Underlines
    doc.strokeColor(COLORS.teal).lineWidth(0.8)
      .moveTo(PAGE.margin, y)
      .lineTo(PAGE.margin + sigWidth, y)
      .stroke();
    doc.strokeColor(COLORS.teal).lineWidth(0.8)
      .moveTo(PAGE.margin + sigWidth + 30, y)
      .lineTo(PAGE.width - PAGE.margin, y)
      .stroke();
    y += 8;

    // Digital acceptance note
    doc.fillColor(COLORS.teal).font(fonts.regular).fontSize(7)
      .text('✓ Digitally accepted via ClickBit Employee Portal', PAGE.margin, y);
  } else {
    // Blank lines — pending
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
      .text('Employee Signature:', PAGE.margin, y);
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
      .text('Date:', PAGE.margin + sigWidth + 30, y);
    y += 12;

    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin, y + 20)
      .lineTo(PAGE.margin + sigWidth, y + 20)
      .stroke();
    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin + sigWidth + 30, y + 20)
      .lineTo(PAGE.width - PAGE.margin, y + 20)
      .stroke();
    y += 28;

    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7).fillOpacity(0.7)
      .text('⏳ Pending — employee must accept via the Employee Portal', PAGE.margin, y)
      .fillOpacity(1);
  }

  return y + 20;
}

function renderContractHeader(doc, data, fonts) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const employee = data.employee || {};
  const user = employee.user || {};
  const employeeName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employee';

  let y = PAGE.margin;

  // Contract title
  doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(24)
    .text(getLabel(settings, 'employmentContractTitle', 'Employment Contract'), PAGE.margin, y, { width: CONTENT_WIDTH });
  y += 35;

  // Contract number badge
  if (data.contract_number) {
    doc.roundedRect(PAGE.margin, y, 120, 22, 4)
      .fillColor(COLORS.bgSlate).fill()
      .strokeColor(COLORS.borderSlate).lineWidth(0.5).stroke();
    doc.fillColor(COLORS.teal).font(fonts.semiBold).fontSize(8)
      .text(data.contract_number, PAGE.margin + 10, y + 6);
    y += 35;
  }

  // Key details box — add an address row if available
  const empAddr = [employee.address, employee.city, employee.state, employee.postcode, employee.country]
    .filter(Boolean).join(', ');
  const hasAddress = !!empAddr;

  const boxY = y;
  const boxHeight = hasAddress ? 96 : 80;
  doc.roundedRect(PAGE.margin, boxY, CONTENT_WIDTH, boxHeight, 6)
    .fillColor(COLORS.bgSlate).fill()
    .strokeColor(COLORS.borderSlate).lineWidth(0.5).stroke();

  const col1 = PAGE.margin + 12;
  const col2 = PAGE.margin + CONTENT_WIDTH / 2 + 12;

  const detailsPairs = [
    [ { l: 'Date:', v: fmtDate(data.start_date) }, { l: 'Contract:', v: data.contract_number || 'N/A' } ],
    [ { l: 'Employer:', v: 'ClickBit' }, { l: 'ABN:', v: '59 267 698 766' } ],
    [ { l: 'Employee:', v: employeeName }, { l: 'Position:', v: data.position || 'N/A' } ],
    [ { l: 'Type:', v: (data.employment_type || 'full_time').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) }, { l: 'Department:', v: data.department || 'N/A' } ]
  ];
  if (hasAddress) {
    detailsPairs.push([ { l: 'Address:', v: empAddr }, {} ]);
  }

  let dy = boxY + 10;
  detailsPairs.forEach(pair => {
    pair.forEach((item, idx) => {
      if (!item.l) return; // skip empty right cell on address row
      const x = idx === 0 ? col1 : col2;
      doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
        .text(item.l, x, dy, { continued: true, lineBreak: false });
      doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(8)
        .text(` ${item.v}`, { lineBreak: false });
    });
    dy += 16;
  });

  y = boxY + boxHeight + 15;

  // Duration
  if (data.start_date) {
    const durationLine = `Contract Duration: ${fmtDate(data.start_date)} – ${data.end_date ? fmtDate(data.end_date) : 'Ongoing (indefinite)'}`;
    doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(9)
      .text(durationLine, PAGE.margin, y, { width: CONTENT_WIDTH });
    y += 20;
  }

  return y;
}

function renderSectionTitle(doc, title, fonts, y, settings = {}) {
  const COLORS = getColors(settings);
  if (y + 40 > MAX_Y) {
    doc.addPage();
    y = PAGE.margin;
  }

  y += 6; // breathing room above each section

  // Teal left border + title
  doc.fillColor(COLORS.teal)
    .rect(PAGE.margin, y, 3, 18).fill();
  doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(12)
    .text(title, PAGE.margin + 14, y + 2, { width: CONTENT_WIDTH - 14 });
  y += 28;

  return y;
}

function renderKeyTerms(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  return startY;
}

function renderResponsibilities(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  let y = renderSectionTitle(doc, getLabel(settings, 'keyResponsibilitiesTitle', 'Key Responsibilities'), fonts, startY, settings);

  // Use custom responsibilities from contract, fall back to generic
  let responsibilities;
  if (data.responsibilities && data.responsibilities.trim()) {
    responsibilities = data.responsibilities.split('\n').map(l => l.trim()).filter(Boolean);
  } else {
    responsibilities = [
      'Carry out duties faithfully and in the best interests of the company.',
      'Perform assigned tasks to a high standard of quality and timeliness.',
      'Collaborate effectively with team members and stakeholders.',
      'Contribute to system documentation and reports as required.',
      'Perform other related duties as directed by management.'
    ];
  }

  responsibilities.forEach(item => {
    if (y + 18 > MAX_Y) { doc.addPage(); y = PAGE.margin; }

    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
      .text('•', PAGE.margin + 6, y, { lineBreak: false });
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(item, PAGE.margin + 20, y, { width: CONTENT_WIDTH - 20, lineGap: 3 });
    y = doc.y + 8;
  });

  return y + 8;
}

function renderCompensation(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isCasual = data.employment_type === 'casual';
  const isContractor = data.employment_type === 'contractor';

  let y = renderSectionTitle(doc, getLabel(settings, 'remunerationTitle', 'Remuneration'), fonts, startY, settings);

  if (y + 80 > MAX_Y) { doc.addPage(); y = PAGE.margin; }

  const tableItems = [];
  if (data.hourly_rate) {
    const rateLabel = isCasual
      ? 'Hourly Rate (incl. 25% casual loading)'
      : isContractor ? 'Contracted Rate' : 'Hourly Rate';
    tableItems.push({ l: rateLabel, v: fmtCurrency(data.hourly_rate, data.currency) });
  }
  // Salary only for full-time / part-time / intern
  if (data.salary && !isCasual && !isContractor) {
    tableItems.push({ l: 'Annual Salary', v: fmtCurrency(data.salary, data.currency) });
  }
  tableItems.push({ l: 'Pay Frequency', v: (data.pay_frequency || 'fortnightly').charAt(0).toUpperCase() + (data.pay_frequency || 'fortnightly').slice(1) });
  tableItems.push({ l: 'Currency', v: data.currency || 'AUD' });

  const boxY = y;
  const rowH = 24;
  const boxH = tableItems.length * rowH + 16;

  doc.roundedRect(PAGE.margin, boxY, CONTENT_WIDTH, boxH, 6)
    .fillColor(COLORS.bgSlate).fill()
    .strokeColor(COLORS.borderSlate).lineWidth(0.5).stroke();

  tableItems.forEach((item, i) => {
    const ry = boxY + 10 + (i * rowH);
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
      .text(item.l, PAGE.margin + 14, ry, { lineBreak: false });
    doc.fillColor(COLORS.navy).font(fonts.bold).fontSize(9)
      .text(item.v, PAGE.margin + CONTENT_WIDTH / 2, ry, { width: CONTENT_WIDTH / 2 - 14, align: 'right', lineBreak: false });
  });

  y = boxY + boxH + 14;

  // Footer note differs by type
  let payNote;
  if (isCasual) {
    payNote = 'Payment is processed at the end of each pay period for hours actually worked. The hourly rate above includes a 25% casual loading in lieu of leave entitlements.';
  } else if (isContractor) {
    payNote = 'Invoices should be submitted at the agreed frequency. Payment will be processed within 14 days of a valid invoice.';
  } else {
    payNote = 'Payment is made by the 10th of the following month, via bank transfer to the account provided by the employee.';
  }

  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(8)
    .text(payNote, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 14;

  return y;
}

function renderScheduleAndLeave(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isCasual = data.employment_type === 'casual';
  const isPartTime = data.employment_type === 'part_time';
  const isContractor = data.employment_type === 'contractor';

  let y = renderSectionTitle(doc, getLabel(settings, 'hoursScheduleTitle', 'Hours & Schedule'), fonts, startY, settings);

  if (y + 60 > MAX_Y) { doc.addPage(); y = PAGE.margin; }

  const weeklyHrs = data.default_weekly_hours || 38;

  if (isCasual) {
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text('Casual employees have no guaranteed minimum hours. Shifts will be offered on an as-needed basis and may vary week to week. There is no obligation on either party to offer or accept any particular shift or number of hours.', PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 8;
  } else if (isContractor) {
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(`Engagement hours: approximately ${weeklyHrs} hours per week, subject to project requirements. The contractor may work flexibly provided deliverables are met within agreed timeframes.`, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 8;
  } else {
    const hoursLabel = isPartTime
      ? `Agreed hours: ${weeklyHrs} hours per week on the days agreed with your manager. Days and times may be varied on reasonable notice by mutual agreement.`
      : `Standard working hours: ${weeklyHrs} hours per week. The employee may be required to work reasonable additional hours as demanded by operational needs.`;
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(hoursLabel, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 8;
  }

  if (!isCasual && data.work_schedule && typeof data.work_schedule === 'object') {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const enabledDays = dayOrder.filter(d => data.work_schedule[d]?.enabled);
    if (enabledDays.length > 0) {
      const first = data.work_schedule[enabledDays[0]];
      const daysLabel = enabledDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
      doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
        .text(`Scheduled days: ${daysLabel} (${first.start} – ${first.end})`, PAGE.margin, y, { width: CONTENT_WIDTH });
      y = doc.y + 8;
    }
  }

  if (!isCasual && !isContractor) {
    const breakText = isPartTime
      ? 'Rest and meal breaks are provided in accordance with the Fair Work Act 2009 and any applicable Modern Award (a 10-minute paid rest for each 4 hours worked; an unpaid 30-minute meal break for shifts exceeding 5 hours, where applicable).'
      : 'A 30-minute unpaid meal break is provided for each shift exceeding 5 hours. An additional 10-minute paid rest break is provided for shifts exceeding 4 hours, in accordance with applicable award conditions.';
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(breakText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 10;
  }

  return y;
}

function renderDutiesAndConduct(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isCasual = data.employment_type === 'casual';
  const isContractor = data.employment_type === 'contractor';

  let y = renderSectionTitle(doc, getLabel(settings, 'dutiesConductTitle', 'Duties, Conduct & Obligations'), fonts, startY, settings);

  const duties = [
    'Perform all duties faithfully, diligently, and in the best interests of the Employer.',
    'Comply with all lawful and reasonable directions of the Employer.',
    'Follow all Employer policies, procedures, and codes of conduct in force from time to time.',
    'Disclose any actual or potential conflicts of interest to the Employer promptly upon becoming aware.',
    'Not engage in any outside employment or business activity that conflicts with your duties without prior written consent.',
    'Comply with all applicable workplace health and safety laws and cooperate with the Employer\'s WHS obligations under the Work Health and Safety Act 2020 (WA) and applicable national standards.',
  ];

  if (!isContractor) {
    duties.push('All intellectual property, inventions, software, designs, and works created in the course of employment are and remain the sole property of ClickBit.');
  }

  duties.forEach(item => {
    if (y + 18 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
      .text('•', PAGE.margin + 6, y, { lineBreak: false });
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(item, PAGE.margin + 20, y, { width: CONTENT_WIDTH - 20, lineGap: 3 });
    y = doc.y + 8;
  });

  return y + 8;
}

function renderConfidentiality(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isContractor = data.employment_type === 'contractor';
  const isCasual = data.employment_type === 'casual';
  const party = isContractor ? 'Contractor' : 'Employee';

  let y = renderSectionTitle(doc, getLabel(settings, 'confidentialityTitle', 'Confidentiality & Intellectual Property'), fonts, startY, settings);

  // 1. Definition
  if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(9)
    .text('Confidential Information', PAGE.margin, y);
  y = doc.y + 4;
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(`"Confidential Information" means all non-public information relating to ClickBit\'s business, clients, personnel, finances, systems, source code, pricing, strategies, and technical data, whether disclosed orally, in writing, or by any other means, and whether or not marked as confidential.`, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 10;

  // 2. Obligations
  if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(9)
    .text('Obligations', PAGE.margin, y);
  y = doc.y + 4;
  const obligations = [
    `Hold all Confidential Information in strict confidence and not disclose it to any third party without prior written consent from ClickBit.`,
    `Use Confidential Information solely to perform duties under this ${isContractor ? 'agreement' : 'contract'} and for no other purpose.`,
    `Not reproduce, copy, or transmit Confidential Information beyond what is strictly necessary to carry out assigned work.`,
    `Immediately notify ClickBit if the ${party} becomes aware of any actual or suspected unauthorised disclosure or use of Confidential Information.`,
    `These obligations survive termination of this ${isContractor ? 'agreement' : 'contract'} without limitation in time.`,
  ];
  obligations.forEach(item => {
    if (y + 16 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text('•', PAGE.margin + 6, y, { lineBreak: false });
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9).text(item, PAGE.margin + 20, y, { width: CONTENT_WIDTH - 20, lineGap: 3 });
    y = doc.y + 6;
  });
  y += 6;

  // 3. IP Assignment
  if (!isContractor) {
    if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(9)
      .text('Intellectual Property Assignment', PAGE.margin, y);
    y = doc.y + 4;
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(`All inventions, software, creative works, designs, processes, and improvements conceived, developed, or reduced to practice by the ${party} during the course of ${isCasual ? 'this engagement' : 'employment'} (whether or not during working hours) that relate to ClickBit\'s business or use ClickBit\'s resources are the sole property of ClickBit. The ${party} hereby irrevocably assigns all such intellectual property rights to ClickBit and agrees to execute any further documents reasonably required to perfect such assignment.`, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 16;
  } else {
    if (y + 14 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text('All deliverables, code, designs, and intellectual property produced under this agreement vest immediately and exclusively in ClickBit upon creation. The Contractor retains no rights over any deliverable or derivative work.', PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 16;
  }

  return y;
}

function renderRestraintAndCompetition(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isContractor = data.employment_type === 'contractor';
  const isCasual = data.employment_type === 'casual';
  const party = isContractor ? 'Contractor' : 'Employee';
  const engagement = isContractor ? 'engagement' : 'employment';

  let y = renderSectionTitle(doc, getLabel(settings, 'restraintTitle', 'Restraint of Trade & Non-Competition'), fonts, startY, settings);

  // During employment
  if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(9)
    .text(`During ${engagement.charAt(0).toUpperCase() + engagement.slice(1)}`, PAGE.margin, y);
  y = doc.y + 4;
  const duringItems = [
    `Not perform work, provide services, or hold a direct or indirect interest in any business that competes with ClickBit without prior written approval.`,
    `Not solicit, service, or accept work from any ClickBit client or prospective client introduced to the ${party} through ClickBit.`,
    `Promptly disclose to ClickBit any business opportunity that arises in the course of ${engagement} that falls within ClickBit\'s field of business.`,
  ];
  duringItems.forEach(item => {
    if (y + 16 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text('•', PAGE.margin + 6, y, { lineBreak: false });
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9).text(item, PAGE.margin + 20, y, { width: CONTENT_WIDTH - 20, lineGap: 3 });
    y = doc.y + 6;
  });
  y += 6;

  // Post-engagement
  if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(9)
    .text(`Post-${engagement.charAt(0).toUpperCase() + engagement.slice(1)} Restraints`, PAGE.margin, y);
  y = doc.y + 4;

  const restraintPeriod = isCasual ? 'three (3) months' : 'six (6) months';
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(`For a period of ${restraintPeriod} following the end of this ${engagement}, the ${party} must not, within Australia or any jurisdiction in which ClickBit operates:`, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 6;

  const postItems = [
    `Directly or indirectly work for, consult to, or hold an interest in any business that is in direct competition with ClickBit.`,
    `Solicit, approach, or accept work from any client of ClickBit with whom the ${party} had material dealings in the 12 months prior to departure.`,
    `Induce, recruit, or encourage any ClickBit employee, contractor, or supplier to leave or reduce their engagement with ClickBit.`,
    `Use any Confidential Information of ClickBit to benefit a competitor or to solicit ClickBit\'s clients.`,
  ];
  postItems.forEach(item => {
    if (y + 16 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text('•', PAGE.margin + 6, y, { lineBreak: false });
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9).text(item, PAGE.margin + 20, y, { width: CONTENT_WIDTH - 20, lineGap: 3 });
    y = doc.y + 6;
  });
  y += 4;

  if (y + 14 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text('The parties agree these restraints are reasonable in scope and duration and are necessary to protect ClickBit\'s legitimate business interests. If any restraint is found unenforceable in its full terms, it will be read down to the minimum extent necessary to make it enforceable.', PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 16;

  return y;
}

function renderPropertyAndNotices(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isContractor = data.employment_type === 'contractor';
  const party = isContractor ? 'Contractor' : 'Employee';

  let y = renderSectionTitle(doc, getLabel(settings, 'returnPropertyTitle', 'Return of Company Property'), fonts, startY, settings);

  if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(`All equipment, devices, tools, software licences, access credentials, documents, and other property provided by ClickBit to the ${party} remain the exclusive property of ClickBit at all times.`, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 6;

  const propertyItems = [
    'All company property must be returned to ClickBit in good working condition immediately upon the termination or expiry of this contract, or earlier if requested.',
    'Company property includes, but is not limited to: laptop computers, monitors, peripherals, mobile phones, access cards, software licences, login credentials, and any physical documents or printed materials containing company information.',
    `The ${party} must not cause or permit any damage to company property beyond normal wear and tear. The ${party} may be liable for the cost of replacement or repair of any property damaged, lost, or not returned.`,
    'All data stored on company devices must be preserved intact and not deleted prior to return. Personal data may be removed from company-owned devices only with prior written approval.',
    'Access to all company systems, applications, and cloud services will be revoked immediately upon termination. The ' + party + ' must not attempt to access any company system after authorisation has been withdrawn.',
  ];

  propertyItems.forEach(item => {
    if (y + 18 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text('•', PAGE.margin + 6, y, { lineBreak: false });
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9).text(item, PAGE.margin + 20, y, { width: CONTENT_WIDTH - 20, lineGap: 3 });
    y = doc.y + 8;
  });
  y += 6;

  // Notices
  y = renderSectionTitle(doc, getLabel(settings, 'noticesTitle', 'Notices'), fonts, y, settings);
  if (y + 20 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text('Any notice required or permitted under this contract must be given in writing and delivered by one of the following methods:', PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 6;

  const noticeItems = [
    'Hand delivery to the other party\'s last known address;',
    'Sent by prepaid registered post to the other party\'s last known address (deemed received 3 business days after posting); or',
    'Sent by email to the other party\'s last known email address (deemed received on the next business day after sending, provided no delivery-failure notice is received).',
  ];
  noticeItems.forEach((item, i) => {
    if (y + 16 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(`(${String.fromCharCode(97 + i)}) ${item}`, PAGE.margin + 10, y, { width: CONTENT_WIDTH - 10, lineGap: 3 });
    y = doc.y + 6;
  });
  y += 4;

  if (y + 14 > MAX_Y) { doc.addPage(); y = PAGE.margin; }
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text('Notice from ClickBit to the Employee should be directed to the email address on file. The Employee is responsible for keeping their contact details up to date.', PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 16;

  return y;
}

function renderTermination(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  const isCasual = data.employment_type === 'casual';
  const isContractor = data.employment_type === 'contractor';
  const isAustralian = !data.work_country || data.work_country === 'Australia';

  let y = renderSectionTitle(doc, getLabel(settings, 'terminationTitle', 'Termination of Employment'), fonts, startY, settings);
  if (y + 50 > MAX_Y) { doc.addPage(); y = PAGE.margin; }

  let termText;
  if (isCasual) {
    termText = 'Casual engagements may be ended by either party at any time without notice, except where a longer period is required by an applicable Modern Award or Enterprise Agreement. There is no entitlement to ongoing engagement. Immediate cessation may occur for serious misconduct.';
  } else if (isContractor) {
    termText = 'Either party may terminate this engagement by providing two (2) weeks\u2019 written notice, or as otherwise agreed in the project scope. Immediate termination without notice may occur for material breach, insolvency, or failure to meet deliverables.';
  } else {
    termText = isAustralian
      ? `During the probationary period of three (3) months, either party may terminate this contract by giving one (1) week\u2019s written notice. After the probationary period, notice periods are as follows (in accordance with the Fair Work Act 2009):\n\n  \u2022 1 year or less of continuous service \u2014 1 week\n  \u2022 1\u20133 years of continuous service \u2014 2 weeks\n  \u2022 3\u20135 years of continuous service \u2014 3 weeks\n  \u2022 More than 5 years \u2014 4 weeks\n\nEmployees over 45 years of age with at least 2 years of continuous service receive an additional 1 week\u2019s notice.\n\nThe Employer may elect to make a payment in lieu of all or part of the notice period. Summary dismissal (without notice) may occur for serious and wilful misconduct.`
      : `This contract may be terminated by either party with one (1) week\u2019s notice during probation, or two (2) weeks\u2019 notice thereafter. Immediate termination may occur for serious misconduct, breach of confidentiality, or sustained non-performance.`;
  }

  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(termText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 20;

  // Superannuation (Australian employees / permanent only)
  if (isAustralian && !isContractor) {
    y = renderSectionTitle(doc, getLabel(settings, 'superannuationTitle', 'Superannuation'), fonts, y, settings);
    const superText = isCasual
      ? 'The Employer will make Superannuation Guarantee contributions on the Employee\u2019s behalf in accordance with the Superannuation Guarantee (Administration) Act 1992 (Cth), at the rate prescribed by law from time to time.'
      : 'The Employer will make Superannuation Guarantee (SG) contributions in accordance with the Superannuation Guarantee (Administration) Act 1992 (Cth), currently 11.5% of ordinary time earnings, into the Employee\u2019s nominated complying superannuation fund. If no fund is nominated, contributions will be made to the Employer\u2019s default fund.';
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(superText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 20;
  }

  // National Employment Standards (Australian permanent/part-time)
  if (isAustralian && !isContractor) {
    y = renderSectionTitle(doc, getLabel(settings, 'nationalEmploymentStandardsTitle', 'National Employment Standards'), fonts, y, settings);
    const nesText = isCasual
      ? 'This engagement is subject to the National Employment Standards (NES) under the Fair Work Act 2009 (Cth) to the extent they apply to casual employees, including the right to request conversion to permanent employment after 12 months of regular and systematic engagement.'
      : 'This contract is subject to the National Employment Standards (NES) under the Fair Work Act 2009 (Cth). The NES provides the following minimum entitlements (pro-rated for part-time employees where applicable): Annual Leave (4 weeks per year); Personal/Carer\u2019s Leave (10 days per year); Compassionate Leave; Parental Leave; Community Service Leave; Long Service Leave (under applicable state legislation); and Public Holidays. Any applicable Modern Award or Enterprise Agreement also applies and prevails over this contract to the extent of any inconsistency.';
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(nesText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 20;
  }

  y = renderSectionTitle(doc, getLabel(settings, 'postEmploymentObligationsTitle', 'Post-Employment Obligations'), fonts, y, settings);
  const postText = isContractor
    ? 'For six (6) months following the end of this engagement, the Contractor must not solicit any employee, contractor, or client of ClickBit. This obligation is limited to contacts made in the course of this engagement.'
    : 'For a period of six (6) months following termination of employment, the Employee must not: (a) solicit or entice any ClickBit employee or contractor to leave; (b) solicit or service any ClickBit client with whom the Employee had material dealings in the last 12 months of employment; or (c) disparage ClickBit or its directors, employees, or clients in any public or professional forum. ClickBit acknowledges these restraints are reasonable and necessary to protect its legitimate business interests.';
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(postText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 20;

  y = renderSectionTitle(doc, getLabel(settings, 'disputeResolutionTitle', 'Dispute Resolution'), fonts, y, settings);
  const disputeText = isAustralian
    ? 'In the event of a workplace dispute, the parties agree to first attempt to resolve the matter internally through good-faith discussion. If unresolved within 14 days, the matter may be escalated to a mediator agreed by both parties. If still unresolved, either party may refer the dispute to the Fair Work Commission for conciliation and, if necessary, arbitration as permitted by the Fair Work Act 2009.'
    : 'Disputes will first be addressed through good-faith internal discussion. If unresolved, matters may be referred to an agreed mediator or relevant tribunal in the applicable jurisdiction.';
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(disputeText, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 20;

  y = renderSectionTitle(doc, getLabel(settings, 'governingLawTitle', 'Governing Law'), fonts, y, settings);
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text('This contract is governed by and construed in accordance with the laws of Western Australia. Both parties submit to the non-exclusive jurisdiction of the courts of Western Australia and of the Federal Court of Australia.', PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
  y = doc.y + 20;

  if (data.terms_summary) {
    y = renderSectionTitle(doc, getLabel(settings, 'additionalTermsTitle', 'Additional Terms & Special Conditions'), fonts, y, settings);
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(data.terms_summary, PAGE.margin, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 20;
  }

  return y;
}

function renderSignatures(doc, data, fonts, startY) {
  const COLORS = getColors(data.templateSettings);
  const settings = data.templateSettings || {};
  let y = startY + 5;

  if (y + 150 > MAX_Y) { doc.addPage(); y = PAGE.margin; }

  y = renderSectionTitle(doc, getLabel(settings, 'signaturesTitle', 'Signatures'), fonts, y, settings);

  const employee = data.employee || {};
  const user = employee.user || {};
  const employeeName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employee';

  const sigManager = data.contractManager || {};
  const sigManagerUser = sigManager.user || {};
  const sigManagerName = `${sigManagerUser.first_name || ''} ${sigManagerUser.last_name || ''}`.trim() || 'ClickBit Management';
  const sigManagerTitle = sigManager.position || 'Authorised Signatory';

  const colW = CONTENT_WIDTH / 2 - 15;
  const col2X = PAGE.margin + CONTENT_WIDTH / 2 + 15;

  // ─── EMPLOYER (auto-signed) ─────────────────────────────────────────────────
  doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
    .text('For the Employer (ClickBit):', PAGE.margin, y);
  doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
    .text(sigManagerTitle, PAGE.margin + colW + 30, y, { align: 'left' });
  y += 14;

  // Cursive auto-signature — capped to column width so long names don't bleed into date
  const dateColX = PAGE.margin + colW + 30;
  doc.fillColor(COLORS.navy).font(fonts.cursive).fontSize(22)
    .text(sigManagerName, PAGE.margin, y, { width: colW, lineBreak: false });

  // Clickbit sign date = contract creation date (when it was generated/sent)
  const rawSigDate = data.created_at || data.createdAt || data.start_date || new Date().toISOString();
  const sigDate = fmtDate(new Date(rawSigDate).toISOString().split('T')[0]);
  doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(8)
    .text(sigDate, dateColX, y + 6, { width: colW, lineBreak: false });

  y += 28;

  // Signature line
  doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.margin + colW, y).stroke();
  doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
    .moveTo(dateColX, y)
    .lineTo(dateColX + colW, y).stroke();

  doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
    .text('Signature', PAGE.margin, y + 3);
  doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
    .text('Date', dateColX, y + 3);

  y += 30;

  // ─── EMPLOYEE ────────────────────────────────────────────────────────────────
  if (y + 80 > MAX_Y) { doc.addPage(); y = PAGE.margin; }

  doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
    .text('For the Employee:', PAGE.margin, y);
  y += 14;

  if (data.employee_accepted_at && data.employee_signature_name) {
    // ── Signed ──
    // Cap employee sign date: cannot be later than 1 day before contract start
    const empAcceptedAt = new Date(data.employee_accepted_at);
    let empSignDate = empAcceptedAt;
    if (data.start_date) {
      const startD = new Date(data.start_date + 'T00:00:00');
      const dayBefore = new Date(startD);
      dayBefore.setDate(dayBefore.getDate() - 1);
      if (empAcceptedAt >= startD) empSignDate = dayBefore;
    }
    const acceptedDate = fmtDate(empSignDate.toISOString().split('T')[0]);

    const empDateColX = PAGE.margin + colW + 30;
    // Constrain cursive name to column so long names don't bleed into date column
    doc.fillColor(COLORS.navy).font(fonts.cursive).fontSize(22)
      .text(data.employee_signature_name, PAGE.margin, y, { width: colW, lineBreak: false });
    doc.fillColor(COLORS.navy).font(fonts.semiBold).fontSize(8)
      .text(acceptedDate, empDateColX, y + 6, { width: colW, lineBreak: false });
    y += 28;

    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin, y)
      .lineTo(PAGE.margin + colW, y).stroke();
    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(empDateColX, y)
      .lineTo(empDateColX + colW, y).stroke();

    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text('Signature', PAGE.margin, y + 3);
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text('Date', empDateColX, y + 3);

    y += 14;
    // Digital acceptance notice (shows real timestamp for audit, display date is capped)
    doc.fillColor(COLORS.teal).font(fonts.semiBold).fontSize(7)
      .text(`✓ Digitally accepted on ${new Date(data.employee_accepted_at).toLocaleString('en-AU', { timeZone: 'Australia/Perth', dateStyle: 'long', timeStyle: 'short' })} (AWST)`, PAGE.margin, y + 3);
    y += 16;
  } else {
    // ── Pending ──
    y += 6;
    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin, y)
      .lineTo(PAGE.margin + colW, y).stroke();
    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin + CONTENT_WIDTH / 2 - 80, y)
      .lineTo(PAGE.margin + colW * 2 + 15, y).stroke();
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text('Signature', PAGE.margin, y + 3);
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text('Date', PAGE.margin + CONTENT_WIDTH / 2 - 80, y + 3);
    y += 16;
    doc.fillColor(COLORS.orange).font(fonts.semiBold).fontSize(7)
      .text('⏳ Pending employee acceptance — employee must accept via the Employee Portal to complete this contract.', PAGE.margin, y + 3);
    y += 16;
  }

  return y + 10;
}

function renderFooterOnAllPages(doc, fonts, companyAddress, settings = {}) {
  const COLORS = getColors(settings);
  const shortAddr = companyAddress.split(',').slice(0, 2).join(', ').trim();
  const footerCompany = getLabel(settings, 'footerCompanyName', 'ClickBit');
  const footerAbn = getLabel(settings, 'companyAbn', '59 267 698 766');

  const footerText = `© ${new Date().getFullYear()} ${footerCompany}  ·  ABN: ${footerAbn}  ·  ${shortAddr}`;

  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  doc.font(fonts.regular).fontSize(7);
  const footerTextWidth = doc.widthOfString(footerText);
  const footerX = PAGE.margin + (CONTENT_WIDTH / 2) - (footerTextWidth / 2);

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);

    doc.save();

    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin, FOOTER_Y)
      .lineTo(PAGE.width - PAGE.margin, FOOTER_Y)
      .stroke();

    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text(footerText, footerX, FOOTER_Y + 8, { lineBreak: false });

    if (totalPages > 1) {
      const pageText = `Page ${i + 1} of ${totalPages}`;
      const pw = doc.widthOfString(pageText);
      doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
        .text(pageText, PAGE.width - PAGE.margin - pw, FOOTER_Y + 8, { lineBreak: false });
    }

    doc.restore();
  }

  if (totalPages > 0) {
    doc.switchToPage(totalPages - 1);
  }
}

export { generateContractPDF };
