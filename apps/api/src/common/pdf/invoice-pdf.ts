// @ts-nocheck
/**
 * PDF Generation Service - FINAL FIX
 * Footer issue resolved by using fillAndStroke instead of text for footer
 */

import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { generateVerificationQRBuffer } from '@/finance/qr.helper';
import { formatDate } from '@/common/date-formatter';

const FONTS_DIR = process.env.FONTS_DIR || path.join(process.cwd(), 'fonts');
const FONTS = {
  regular: path.join(FONTS_DIR, 'Sora-Regular.ttf'),
  medium: path.join(FONTS_DIR, 'Sora-Medium.ttf'),
  semibold: path.join(FONTS_DIR, 'Sora-SemiBold.ttf'),
  bold: path.join(FONTS_DIR, 'Sora-Bold.ttf')
};

const COLORS = {
  teal: '#1FBBD2',
  orange: '#F39C12',
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
  margin: 48
};

const FOOTER_Y = 803;
const MAX_Y = 760;

/**
 * Main PDF Generation
 */
async function generateInvoicePDF(packageData, billingSettings = {}, templateSettings = {}, verificationCode: string | null = null): Promise<Buffer> {
  let qrBuffer = null;
  if (verificationCode) {
    try {
      qrBuffer = await generateVerificationQRBuffer(verificationCode, { width: 80 });
    } catch (err) {
      console.warn('QR generation failed:', err.message);
    }
  }

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

      let y = PAGE.margin;

      // Render content
      y = renderFirstPageHeader(doc, packageData, fonts, billingSettings);
      y = renderItemsTable(doc, packageData, fonts, y);
      y = renderTotals(doc, packageData, fonts, billingSettings, y);
      y = renderPaymentHistory(doc, packageData, fonts, y);
      y = renderNotesAndTerms(doc, packageData, fonts, y);
      y = renderPaymentGrid(doc, packageData, fonts, billingSettings, verificationCode, qrBuffer, y);
      renderStatusStamp(doc, packageData, fonts, y);

      // CRITICAL FIX: Draw footer AFTER getting final page count
      // Save current position before footer
      const currentPageBeforeFooter = doc.bufferedPageRange().count - 1;

      // Draw footer using a different approach
      renderFooterOnAllPagesSafe(doc, billingSettings, fonts);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function resolveTaxType(data) {
  // The GST treatment must come from a single source of truth so the labels
  // and the maths in renderTotals never disagree. Prefer the explicit
  // tax_type; fall back to the legacy template_type flag for old records.
  if (data.tax_type) return data.tax_type;
  if (data.template_type === 'tax_included') return 'gst_included';
  if (data.template_type === 'tax_excluded') return 'gst_calculated';
  return 'gst_included';
}

function drawFittedAmount(doc, amountText, x, y, width, requestedFontSize, color) {
  let fontSize = requestedFontSize;
  doc.fontSize(fontSize);
  while (fontSize > 8 && doc.widthOfString(amountText) > width) {
    fontSize -= 0.5;
    doc.fontSize(fontSize);
  }

  doc.fillColor(color).fontSize(fontSize)
    .text(amountText, x, y, { width, align: 'right', lineBreak: false });
}

function getInvoiceTemplateLabels(data) {
  const documentType = (data.document_type || 'invoice').toLowerCase();
  const taxRate = parseFloat(data.tax_rate) || 0;
  const taxIncludedTemplate = data.template_type === 'tax_included';
  const isInvoice = documentType === 'invoice';

  return {
    header: isInvoice ? (taxIncludedTemplate ? 'TAX INVOICE' : 'INVOICE') : documentType.toUpperCase(),
    unitPriceLabel: taxIncludedTemplate ? 'UNIT PRICE (EXCL. GST)' : 'UNIT PRICE',
    subtotalLabel: taxIncludedTemplate ? 'Subtotal (EXCL. GST)' : 'Subtotal',
    gstLabel: `GST (${taxRate.toFixed(0)}%)`,
    amountDueLabel: taxIncludedTemplate ? 'Amount Due (INCL. GST)' : 'Amount Due'
  };
}

function renderFirstPageHeader(doc, data, fonts, billingSettings) {
  // Logo
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logos', 'logo-full.png');
  const logoPathAlt = path.join(process.cwd(), 'images', 'logos', 'logo-full.png');

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, PAGE.margin, 40, { width: 100 });
  } else if (fs.existsSync(logoPathAlt)) {
    doc.image(logoPathAlt, PAGE.margin, 40, { width: 100 });
  } else {
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(24)
      .text('click', PAGE.margin, 50, { continued: true })
      .fillColor(COLORS.orange).text('bit', { continued: true })
      .fillColor(COLORS.lightGray).fontSize(10).text('.com.au', { lineBreak: false });
  }

  const templateLabels = getInvoiceTemplateLabels(data);
  doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(28)
    .text(templateLabels.header, PAGE.width - PAGE.margin - 200, 45, { width: 200, align: 'right', lineBreak: false });

  // Billing info
  const y = 110;
  doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
    .text('BILLED TO:', PAGE.margin, y, { lineBreak: false });
  doc.fillColor(COLORS.black).font(fonts.bold).fontSize(12)
    .text(data.client_name || 'N/A', PAGE.margin, y + 15, { lineBreak: false });

  if (data.client_company) {
    doc.fillColor(COLORS.gray).font(fonts.semiBold).fontSize(10)
      .text(data.client_company, PAGE.margin, y + 32, { lineBreak: false });
  }

  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
    .text(data.client_email || '', PAGE.margin, y + 48, { lineBreak: false });

  const rightX = PAGE.width - PAGE.margin - 200;
  const issueDate = formatDate(data.created_at);
  const dueDate = data.valid_until
    ? formatDate(data.valid_until)
    : formatDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  const labels = [
    { l: `${data.document_type === 'estimate' ? 'Estimate' : 'Invoice'} No.`, v: data.package_code },
    { l: 'Issue Date:', v: issueDate },
    { l: 'Due Date:', v: dueDate, highlight: true }
  ];

  labels.forEach((item, i) => {
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
      .text(item.l, rightX, y + (i * 16), { width: 70, align: 'right', lineBreak: false });
    doc.fillColor(item.highlight ? COLORS.teal : COLORS.black).font(fonts.bold).fontSize(8)
      .text(item.v, rightX + 75, y + (i * 16), { width: 125, align: 'right', lineBreak: false });
  });

  // Return Y position for next element (last content is email at y+48=158, add small gap)
  return 240;
}

function renderItemsTable(doc, data, fonts, startY) {
  const labels = getInvoiceTemplateLabels(data);
  const hasLongUnitPriceLabel = labels.unitPriceLabel.length > 'UNIT PRICE'.length;
  const cols = hasLongUnitPriceLabel
    ? { item: 235, qty: 44, price: 120, total: 100 }
    : { item: 260, qty: 50, price: 90, total: 100 };
  const startX = PAGE.margin;
  let y = startY;

  function drawHeader(yPos) {
    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
      .text('ITEM', startX, yPos, { lineBreak: false })
      .text('QTY', startX + cols.item, yPos, { width: cols.qty, align: 'center', lineBreak: false })
      .text(labels.unitPriceLabel, startX + cols.item + cols.qty, yPos, { width: cols.price, align: 'right', lineBreak: false })
      .text('TOTAL', startX + cols.item + cols.qty + cols.price, yPos, { width: cols.total, align: 'right', lineBreak: false });

    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(startX, yPos + 12)
      .lineTo(PAGE.width - PAGE.margin, yPos + 12)
      .stroke();

    return yPos + 18;
  }

  y = drawHeader(y);

  const lineItems = data.line_items || [];

  lineItems.forEach((item) => {
    const itemName = (item.name && item.name.trim() && item.name !== 'Item')
      ? item.name
      : (data.title || 'Item');
    const qty = item.quantity || 1;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const total = qty * unitPrice;

    doc.font(fonts.bold).fontSize(10);
    const nameHeight = doc.heightOfString(itemName, { width: cols.item - 20 });

    let descHeight = 0;
    if (item.description) {
      doc.font(fonts.regular).fontSize(8);
      descHeight = doc.heightOfString(item.description, { width: cols.item - 20 });
    }

    const itemHeight = Math.max(nameHeight + descHeight + 8, 30);

    if (y + itemHeight > MAX_Y) {
      doc.addPage();

      doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(8)
        .text('Continued...', PAGE.margin, PAGE.margin, {
          width: PAGE.width - PAGE.margin * 2,
          align: 'center',
          lineBreak: false
        });

      doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
        .moveTo(PAGE.margin, PAGE.margin + 15)
        .lineTo(PAGE.width - PAGE.margin, PAGE.margin + 15)
        .stroke();

      y = PAGE.margin + 30;
      y = drawHeader(y);
    }

    doc.fillColor(COLORS.black).font(fonts.bold).fontSize(10)
      .text(itemName, startX, y, { width: cols.item - 20, lineBreak: false });

    if (item.description) {
      doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(8)
        .text(item.description, startX, y + nameHeight + 1, { width: cols.item - 20, lineBreak: false });
    }

    doc.fillColor(COLORS.gray).font(fonts.medium).fontSize(9)
      .text(qty.toString(), startX + cols.item, y, { width: cols.qty, align: 'center', lineBreak: false })
      .text(`$${unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`,
        startX + cols.item + cols.qty, y, { width: cols.price, align: 'right', lineBreak: false });

    doc.fillColor(COLORS.black).font(fonts.bold)
      .text(`$${total.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`,
        startX + cols.item + cols.qty + cols.price, y, { width: cols.total, align: 'right', lineBreak: false });

    y += itemHeight;
  });

  return y + 5;
}

function renderTotals(doc, data, fonts, billingSettings, startY) {
  let y = startY;
  const labels = getInvoiceTemplateLabels(data);

  if (y + 120 > MAX_Y) {
    doc.addPage();
    y = PAGE.margin;
  }

  const width = 260;
  const x = PAGE.width - PAGE.margin - width;
  const valueOffset = 160;

  const taxType = data.tax_type || billingSettings.taxType || resolveTaxType(data);
  const taxRate = parseFloat(data.tax_rate) || parseFloat(billingSettings.taxRate) || 10;
  const subtotal = parseFloat(data.subtotal) || 0;
  const discountInput = parseFloat(data.discount_amount) || 0;
  const discountType = data.discount_type || 'amount';
  const discountAmount = discountType === 'percentage' ? (subtotal * discountInput / 100) : discountInput;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  // Recalculate tax_amount correctly based on tax type
  let taxAmount = 0;
  if (taxType === 'gst_calculated') {
    // GST calculated: add GST on top of discounted subtotal
    taxAmount = discountedSubtotal * (taxRate / 100);
  } else if (taxType === 'gst_included') {
    // GST included: the subtotal already contains GST, so back the GST component
    // out of it (subtotal - subtotal/(1+rate)). Using subtotal*rate overstated
    // the GST shown on GST-inclusive invoices.
    taxAmount = subtotal - (subtotal / (1 + taxRate / 100));
  }

  const rows = [];
  rows.push({ l: labels.subtotalLabel, v: `$${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` });

  if (taxType !== 'no_gst') {
    rows.push({ l: labels.gstLabel, v: `$${taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` });
  }

  if (discountAmount > 0) {
    const discountLabel = discountType === 'percentage' ? `Discount (${discountInput}%)` : 'Discount';
    rows.push({ l: discountLabel, v: `-$${discountAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, color: '#16A34A' });
  }

  rows.forEach((row, i) => {
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text(row.l, x, y + (i * 18), { lineBreak: false });
    doc.font(fonts.bold);
    drawFittedAmount(doc, row.v, x + valueOffset, y + (i * 18), width - valueOffset, 9, row.color || COLORS.black);
  });

  const totalY = y + (rows.length * 18) + 10;
  doc.strokeColor(COLORS.teal).lineWidth(1.5)
    .moveTo(x, totalY)
    .lineTo(PAGE.width - PAGE.margin, totalY)
    .stroke();

  const totalAmount = parseFloat(data.total_amount) || 0;
  const amountPaid = parseFloat(data.amount_paid) || 0;
  const amountDue = totalAmount - amountPaid;

  if (amountPaid > 0 && amountDue > 0) {
    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(9)
      .text('Amount Paid', x, totalY + 12, { lineBreak: false });
    doc.font(fonts.bold);
    drawFittedAmount(
      doc,
      `$${amountPaid.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      x + valueOffset,
      totalY + 12,
      width - valueOffset,
      9,
      '#16A34A'
    );

    doc.fillColor(COLORS.black).font(fonts.bold).fontSize(10)
      .text(labels.amountDueLabel, x, totalY + 30, { lineBreak: false });
    drawFittedAmount(
      doc,
      `$${amountDue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      x + valueOffset,
      totalY + 26,
      width - valueOffset,
      18,
      COLORS.teal
    );

    return totalY + 55;
  }

  doc.fillColor(COLORS.black).font(fonts.bold).fontSize(10)
    .text(labels.amountDueLabel, x, totalY + 12, { lineBreak: false });
  drawFittedAmount(
    doc,
    `$${amountDue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
    x + valueOffset,
    totalY + 8,
    width - valueOffset,
    18,
    COLORS.teal
  );

  return totalY + 40;
}

function renderPaymentHistory(doc, data, fonts, startY) {
  const payments = data.payment_history || [];
  if (payments.length === 0) return startY;

  let y = startY;
  const contentWidth = PAGE.width - (PAGE.margin * 2);
  const rowHeight = 16;
  const headerHeight = 20;
  const estimatedHeight = headerHeight + (payments.length * rowHeight) + 30;

  if (y + estimatedHeight > MAX_Y) {
    doc.addPage();
    y = PAGE.margin;
  }

  // Section header
  doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(9)
    .text('PAYMENT HISTORY', PAGE.margin, y, { lineBreak: false });
  y += 15;

  // Table header
  const cols = { date: 100, method: 110, ref: 180, amount: 100 };
  doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(7)
    .text('DATE', PAGE.margin, y, { lineBreak: false })
    .text('METHOD', PAGE.margin + cols.date, y, { lineBreak: false })
    .text('REFERENCE', PAGE.margin + cols.date + cols.method, y, { lineBreak: false })
    .text('AMOUNT', PAGE.margin + cols.date + cols.method + cols.ref, y, { width: cols.amount, align: 'right', lineBreak: false });

  y += 10;
  doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .stroke();
  y += 5;

  payments.forEach((payment) => {
    if (y + rowHeight > MAX_Y) {
      doc.addPage();
      y = PAGE.margin;
    }

    const dateStr = payment.date ? formatDate(payment.date) : '—';
    const methodStr = (payment.method || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const refStr = (payment.reference || '—').substring(0, 30);
    const amountStr = `$${payment.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(8)
      .text(dateStr, PAGE.margin, y, { lineBreak: false })
      .text(methodStr, PAGE.margin + cols.date, y, { lineBreak: false })
      .text(refStr, PAGE.margin + cols.date + cols.method, y, { lineBreak: false });
    doc.fillColor('#16A34A').font(fonts.bold).fontSize(8)
      .text(amountStr, PAGE.margin + cols.date + cols.method + cols.ref, y, { width: cols.amount, align: 'right', lineBreak: false });

    y += rowHeight;
  });

  return y + 10;
}

function renderNotesAndTerms(doc, data, fonts, startY) {
  let y = startY;

  if (data.client_notes && data.client_notes.trim()) {
    const contentWidth = PAGE.width - (PAGE.margin * 2);
    doc.font(fonts.regular).fontSize(8);
    const estimatedHeight = doc.heightOfString(data.client_notes, { width: contentWidth - 20 }) + 60;

    if (y + estimatedHeight > MAX_Y) {
      doc.addPage();
      y = PAGE.margin;
    }

    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
      .text('NOTES:', PAGE.margin, y, { lineBreak: false });

    const boxY = y + 12;
    const boxHeight = doc.heightOfString(data.client_notes, { width: contentWidth - 20 }) + 15;

    doc.roundedRect(PAGE.margin, boxY, contentWidth, boxHeight, 6)
      .fillColor(COLORS.bgSlate).fill()
      .strokeColor(COLORS.borderSlate).lineWidth(0.5).stroke();

    doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(8)
      .text(data.client_notes, PAGE.margin + 10, boxY + 8, { width: contentWidth - 20, lineBreak: false });

    y = boxY + boxHeight + 15;
  }

  if (y + 30 > MAX_Y) {
    doc.addPage();
    y = PAGE.margin;
  }

  const termsText = (data.terms && data.terms.trim())
    ? data.terms.trim()
    : 'Payment is due within 14 days of invoice date.';

  doc.fillColor(COLORS.black).font(fonts.bold).fontSize(8)
    .text('PS:', PAGE.margin, y, { continued: true, lineBreak: false });
  doc.fillColor(COLORS.gray).font(fonts.regular)
    .text(` ${termsText}`, { lineBreak: false });

  return y + 30;
}

function renderPaymentGrid(doc, data, fonts, settings, verificationCode, qrBuffer, startY) {
  let y = startY;

  const isInvoice = (data.document_type || 'invoice') !== 'estimate';
  const isPaid = data.payment_status === 'paid' || data.status === 'paid';
  const contentWidth = PAGE.width - (PAGE.margin * 2);

  // For estimates, only show verification section (no payment instructions)
  if (!isInvoice) {
    if (y + 130 > MAX_Y) {
      doc.addPage();
      y = PAGE.margin;
    }

    doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
      .moveTo(PAGE.margin, y)
      .lineTo(PAGE.width - PAGE.margin, y)
      .stroke();

    y += 20;

    // Verification box - full width for estimates
    const vHeight = 110;

    doc.roundedRect(PAGE.margin, y, contentWidth, vHeight, 10)
      .fillColor(COLORS.bgSlate).fill()
      .strokeColor(COLORS.borderSlate).lineWidth(0.5).stroke();

    doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
      .text('DOCUMENT VERIFICATION', PAGE.margin + 12, y + 12, { lineBreak: false });
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text('Scan QR or visit clickbit.com.au/verify', PAGE.margin + 12, y + 25, { lineBreak: false });

    const displayCode = verificationCode || data.verification_code || 'CB-XXXX-XXX';
    doc.fillColor(COLORS.black).font(fonts.bold).fontSize(10)
      .text(displayCode, PAGE.margin + 12, y + 45, { lineBreak: false });

    if (qrBuffer) {
      try {
        doc.image(qrBuffer, PAGE.margin + contentWidth - 70, y + 12, { width: 55 });
      } catch (qrErr) {
        console.warn('Failed to add QR code to PDF:', qrErr.message);
      }
    }

    doc.strokeColor(COLORS.borderSlate)
      .moveTo(PAGE.margin + 12, y + 65)
      .lineTo(PAGE.margin + contentWidth - 12, y + 65)
      .stroke();

    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
      .text('This estimate is valid for the period stated above. Prices may change after expiry.', PAGE.margin + 12, y + 78, { lineBreak: false });

    return y + vHeight;
  }

  // Invoice layout - unchanged: bank details + verification side by side
  if (y + 150 > MAX_Y) {
    doc.addPage();
    y = PAGE.margin;
  }

  const colWidth = (contentWidth - 40) / 2;

  doc.strokeColor(COLORS.borderSlate).lineWidth(0.5)
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .stroke();

  y += 20;

  doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(12)
    .text('Bank Transfer', PAGE.margin, y, { lineBreak: false });

  const bankY = y + 20;
  const accountName = settings.bankAccountName || 'Kauser Ahmed Methel';
  const bsb = settings.bankBSB || '013-017';
  const accountNumber = settings.bankAccountNumber || '167658357';

  const bankDetails = [
    { l: 'Account:', v: accountName },
    { l: 'BSB:', v: bsb },
    { l: 'Number:', v: accountNumber }
  ];

  bankDetails.forEach((row, i) => {
    doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(9)
      .text(row.l, PAGE.margin, bankY + (i * 15), { lineBreak: false });
    doc.fillColor(COLORS.black).font(fonts.bold)
      .text(row.v, PAGE.margin + 60, bankY + (i * 15), { lineBreak: false });
  });

  if (!isPaid && data.package_code) {
    const btnY = bankY + 55;
    const frontendUrl = process.env.FRONTEND_URL || 'https://clickbit.com.au';
    const paymentLink = `${frontendUrl}/pay/${data.package_code}`;

    doc.roundedRect(PAGE.margin, btnY, 80, 24, 4)
      .fillColor(COLORS.teal).fill();
    doc.fillColor(COLORS.white).font(fonts.bold).fontSize(9)
      .text('Pay Here', PAGE.margin, btnY + 7, { width: 80, align: 'center', lineBreak: false });

    try {
      doc.link(PAGE.margin, btnY, 80, 24, paymentLink);
    } catch (e) {
      console.warn('Failed to add payment link to PDF:', e.message);
    }
  }

  const vX = PAGE.margin + colWidth + 40;
  const vY = y;
  const vHeight = 110;

  doc.roundedRect(vX, vY, colWidth, vHeight, 10)
    .fillColor(COLORS.bgSlate).fill()
    .strokeColor(COLORS.borderSlate).lineWidth(0.5).stroke();

  doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8)
    .text('DOCUMENT VERIFICATION', vX + 12, vY + 12, { lineBreak: false });
  doc.fillColor(COLORS.lightGray).font(fonts.regular).fontSize(7)
    .text('Scan QR or visit clickbit.com.au/verify', vX + 12, vY + 25, { lineBreak: false });

  const displayCode = verificationCode || data.verification_code || 'CB-XXXX-XXX';
  doc.fillColor(COLORS.black).font(fonts.bold).fontSize(10)
    .text(displayCode, vX + 12, vY + 45, { lineBreak: false });

  if (qrBuffer) {
    try {
      doc.image(qrBuffer, vX + colWidth - 70, vY + 12, { width: 55 });
    } catch (qrErr) {
      console.warn('Failed to add QR code to PDF:', qrErr.message);
    }
  }

  doc.strokeColor(COLORS.borderSlate)
    .moveTo(vX + 12, vY + 65)
    .lineTo(vX + colWidth - 12, vY + 65)
    .stroke();

  const accountLast4 = accountNumber.slice(-4);
  doc.fillColor('#D97706').font(fonts.bold).fontSize(7)
    .text('! Bank details NEVER change', vX + 12, vY + 75, { lineBreak: false });
  doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(7)
    .text(`BSB: ${bsb} | Account: ***${accountLast4}`, vX + 12, vY + 88, { lineBreak: false });

  return y + vHeight;
}

function renderStatusStamp(doc, data, fonts, currentY) {
  const isPaid = data.payment_status === 'paid' || data.status === 'paid';
  const stampY = Math.min(currentY + 20, MAX_Y - 60);
  const stampX = PAGE.width - PAGE.margin - 120;

  doc.save();
  doc.rotate(-12, { origin: [stampX + 50, stampY + 25] });
  doc.roundedRect(stampX, stampY, 100, 50, 8)
    .lineWidth(3)
    .dash(5, { space: 3 })
    .strokeColor(isPaid ? '#22C55E' : COLORS.orange)
    .stroke();
  doc.fillColor(isPaid ? '#22C55E' : COLORS.orange)
    .font(fonts.bold)
    .fontSize(24)
    .text(isPaid ? 'PAID' : 'DUE', stampX, stampY + 12, { width: 100, align: 'center', lineBreak: false });
  doc.restore();
}

/**
 * CRITICAL FIX: Footer that doesn't create extra pages
 * Uses manual text positioning to bypass PDFKit's automatic page flow
 */
function renderFooterOnAllPagesSafe(doc, settings, fonts) {
  const contentWidth = PAGE.width - (PAGE.margin * 2);
  const abn = settings.companyAbn || settings.abn || '59 267 698 766';
  const footerText = `© ${new Date().getFullYear()} ClickBit  ·  ABN: ${abn}  ·  INNOVATION IN EVERY BIT`;

  // Get ACTUAL page count before starting - CRITICAL: Do this ONCE
  const range = doc.bufferedPageRange();
  const actualPageCount = range.count;

  console.log(`[Footer] Drawing on ${actualPageCount} pages`);

  // Store the current page we're on
  const lastPage = actualPageCount - 1;

  // Set up font once to calculate text width
  doc.font(fonts.regular).fontSize(8);
  const footerTextWidth = doc.widthOfString(footerText);
  const footerTextX = PAGE.margin + (contentWidth / 2) - (footerTextWidth / 2);

  // Draw footer on each page WITHOUT triggering page creation
  for (let i = 0; i < actualPageCount; i++) {
    // Switch to page
    doc.switchToPage(i);

    // CRITICAL: Save current state
    const originalY = doc.y;
    const originalX = doc.x;

    // Draw line using absolute coordinates (this never triggers page creation)
    doc.strokeColor(COLORS.borderSlate)
      .lineWidth(0.5)
      .moveTo(PAGE.margin, FOOTER_Y)
      .lineTo(PAGE.width - PAGE.margin, FOOTER_Y)
      .stroke();

    // CRITICAL: Save graphics state
    doc.save();

    // Set font and color
    doc.fillColor(COLORS.gray)
      .font(fonts.regular)
      .fontSize(8);

    // CRITICAL: Use explicit X,Y coordinates in text() call with NO width parameter
    // This is the key - explicit coordinates + no width = no flow checking
    doc.text(footerText, footerTextX, FOOTER_Y + 10, {
      lineBreak: false,
      continued: false
    });

    // Draw page numbers if multi-page
    if (actualPageCount > 1) {
      const pageNumText = `Page ${i + 1} of ${actualPageCount}`;
      doc.font(fonts.regular).fontSize(7);
      const pageNumWidth = doc.widthOfString(pageNumText);
      const pageNumX = PAGE.width - PAGE.margin - pageNumWidth;

      doc.fillColor(COLORS.lightGray);
      doc.text(pageNumText, pageNumX, FOOTER_Y + 10, {
        lineBreak: false,
        continued: false
      });
    }

    // Restore graphics state and original position
    doc.restore();
    doc.x = originalX;
    doc.y = originalY;
  }

  // Return to last page
  if (actualPageCount > 0) {
    doc.switchToPage(lastPage);
  }

  const finalPageCount = doc.bufferedPageRange().count;
  console.log(`[Footer] Complete. Final page count: ${finalPageCount}`);

  if (finalPageCount !== actualPageCount) {
    console.error(`[Footer] ERROR: Page count changed from ${actualPageCount} to ${finalPageCount}!`);
  }
}

function generateInvoiceNumber(sequenceNumber) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(sequenceNumber).padStart(4, '0');
  return `CLK${yearMonth}${seq}`;
}

export { generateInvoicePDF, generateInvoiceNumber };
