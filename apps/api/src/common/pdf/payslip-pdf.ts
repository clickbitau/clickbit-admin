/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-promise-reject-errors */
// @ts-nocheck
/**
 * ClickBit HR - Payslip Generation Service
 * Replicates the Unified Design System with Sora typography.
 */

import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { generateVerificationQRBuffer } from '@/finance/qr.helper';
import { formatDate } from '@/common/date-formatter';

// Configuration & Design Tokens
const BASE_COLORS = {
  teal: '#1FBBD2',
  tealDark: '#0EA5B7',
  orange: '#F39C12',
  navy: '#1E3A5F',
  black: '#0F172A',
  gray: '#475569',
  lightGray: '#94A3B8',
  border: '#E2E8F0',
  bgLight: '#F8FAFC',
  success: '#10B981',
  white: '#FFFFFF'
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 48
};

function getColors(settings) {
  return { ...BASE_COLORS, ...(settings?.colors || {}) };
}

function getLabel(settings, key, fallback) {
  return settings?.labels?.[key] ?? fallback;
}

function isVisible(settings, key, fallback = true) {
  return settings?.visibility?.[key] ?? fallback;
}

// Font paths
const FONTS_DIR = process.env.FONTS_DIR || path.join(process.cwd(), 'fonts');
const FONTS = {
  regular: path.join(FONTS_DIR, 'Sora-Regular.ttf'),
  medium: path.join(FONTS_DIR, 'Sora-Medium.ttf'),
  semibold: path.join(FONTS_DIR, 'Sora-SemiBold.ttf'),
  bold: path.join(FONTS_DIR, 'Sora-Bold.ttf')
};

/**
 * Format Helpers
 */
const fmt = (val, dec = 2) => parseFloat(val || 0).toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const censor = (text, showLast = 3) => {
  if (!text) return 'N/A';
  const str = String(text);
  return str.length <= showLast ? str : '***' + str.slice(-showLast);
};

/**
 * Currency symbol mapping
 * Note: Use text codes for currencies whose symbols aren't in Sora font
 */
const getCurrencySymbol = (currency) => {
  const symbols = {
    'AUD': '$',
    'USD': '$',
    'BDT': 'BDT ',  // Taka symbol (৳) not in Sora font
    'EUR': 'EUR ',  // Euro symbol may not render
    'GBP': 'GBP ',  // Pound symbol may not render
    'INR': 'INR ',  // Rupee symbol may not render
    'NZD': '$',
    'CAD': '$',
    'SGD': '$',
    'JPY': 'JPY '
  };
  return symbols[currency] || (currency ? `${currency} ` : '$');
};

/**
 * Format money with currency symbol
 */
const fmtMoney = (val, currency = 'AUD', dec = 2) => {
  const symbol = getCurrencySymbol(currency);
  const amount = fmt(val, dec);
  return `${symbol}${amount}`;
};

/**
 * Generate Payslip PDF
 */
async function generatePayslipPDF(payslip, employee, company = {}, templateSettings = {}, verificationCode: string | null = null): Promise<Buffer> {
  payslip.templateSettings = templateSettings || {};
  const settings = payslip.templateSettings;
  const COLORS = getColors(settings);

  let qrBuffer = null;
  if (verificationCode && isVisible(settings, 'showVerification', true)) {
    try {
      qrBuffer = await generateVerificationQRBuffer(verificationCode, { width: 60 });
    } catch (err) {
      console.warn('Failed to generate verification QR code:', err.message);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, autoFirstPage: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Register Fonts
      const fonts = {
        regular: fs.existsSync(FONTS.regular) ? 'Sora' : 'Helvetica',
        medium: fs.existsSync(FONTS.medium) ? 'Sora-Medium' : 'Helvetica',
        semiBold: fs.existsSync(FONTS.semibold) ? 'Sora-SemiBold' : 'Helvetica-Bold',
        bold: fs.existsSync(FONTS.bold) ? 'Sora-Bold' : 'Helvetica-Bold'
      };

      if (fs.existsSync(FONTS.regular)) {
        doc.registerFont('Sora', FONTS.regular);
        doc.registerFont('Sora-Medium', FONTS.medium);
        doc.registerFont('Sora-SemiBold', FONTS.semibold);
        doc.registerFont('Sora-Bold', FONTS.bold);
      }

      const contentWidth = PAGE.width - (PAGE.margin * 2);
      let y = PAGE.margin;

      // 1. Branding & Decorative Waves
      doc.save().opacity(0.1).fillColor(COLORS.teal);
      doc.path('M44.7,-76.4C58.1,-69.2,69.2,-58.1,77.2,-44.7C85.2,-31.3,90.1,-15.7,88.4,-0.9C86.8,13.8,78.6,27.7,68.9,39.6C59.2,51.5,48,61.4,35.1,68.3C22.2,75.2,7.7,79,-7.4,77.7C-22.5,76.4,-38.3,70.1,-51.2,60.1C-64.1,50.1,-74.1,36.5,-79.1,21.3C-84.1,6.1,-84.1,-10.6,-78.3,-25.1C-72.5,-39.6,-60.9,-51.9,-47.5,-59.1C-34.1,-66.3,-18.9,-68.4,-3,-63.2C12.9,-58,25.8,-63.4,44.7,-76.4Z')
        .translate(PAGE.width - 100, 40).fill().restore();

      // Logo - larger size (80px)
      const logoPath = path.join(process.cwd(), 'public', 'images', 'logos', 'logo-full.png');
      const logoPathAlt = path.join(process.cwd(), 'images', 'logos', 'logo-full.png');

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, PAGE.margin, y, { width: 80 });
      } else if (fs.existsSync(logoPathAlt)) {
        doc.image(logoPathAlt, PAGE.margin, y, { width: 80 });
      } else {
        doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(22).text('click', PAGE.margin, y, { continued: true });
        doc.fillColor(COLORS.orange).text('bit');
      }

      // Generate proper payslip number: PS-YYYY-MMDD-XXX
      const paymentDate = new Date(payslip.payment_date);
      const payYear = paymentDate.getFullYear();
      const payMonth = String(paymentDate.getMonth() + 1).padStart(2, '0');
      const payDay = String(paymentDate.getDate()).padStart(2, '0');
      const payslipNumber = `PS-${payYear}-${payMonth}${payDay}-${String(payslip.id).padStart(3, '0')}`;

      // Header Text
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(26).text(getLabel(settings, 'payslipHeader', 'PAYSLIP'), PAGE.width - PAGE.margin - 200, y, { width: 200, align: 'right' });
      doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(9).text(payslipNumber, PAGE.width - PAGE.margin - 200, y + 30, { width: 200, align: 'right' });

      // Company Info (Left) - 2 lines down from logo (+24 extra)
      y += 60;
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(9).text(company.name || 'ClickBIT Pty Ltd', PAGE.margin, y);
      doc.fillColor(COLORS.gray).font(fonts.medium).fontSize(8).text(company.address || '19 Drysdale Approach, Baldivis, WA 6171', PAGE.margin, y + 12);
      doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(8).text(`ABN: ${company.abn || '59 267 698 766'}`, PAGE.margin, y + 24);

      // Period Box (Right) - label left, date right
      const periodX = PAGE.width - PAGE.margin - 170;
      doc.roundedRect(periodX, y - 5, 170, 45, 8).fillColor(COLORS.bgLight).fill().strokeColor(COLORS.border).lineWidth(0.5).stroke();

      // Pay period: label left, date right
      doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(7).text(getLabel(settings, 'payPeriodLabel', 'PAY PERIOD:'), periodX + 8, y + 6);
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(7).text(`${formatDate(payslip.pay_period_start)} - ${formatDate(payslip.pay_period_end)}`, periodX + 8, y + 6, { width: 154, align: 'right' });

      doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(periodX + 8, y + 20).lineTo(periodX + 162, y + 20).stroke();

      // Date paid: label left, date right
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(7).text(getLabel(settings, 'datePaidLabel', 'DATE PAID:'), periodX + 8, y + 28);
      doc.text(formatDate(payslip.payment_date), periodX + 8, y + 28, { width: 154, align: 'right' });

      // 2. Employee Info - 2 more lines down (+24 = total 4 lines)
      y += 70;
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text(getLabel(settings, 'employeeProfileLabel', 'EMPLOYEE PROFILE'), PAGE.margin, y);
      y += 14;

      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(13).text(`${employee.user?.first_name || ''} ${employee.user?.last_name || ''}`, PAGE.margin, y);
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(9).text((employee.position || 'Employee').toUpperCase(), PAGE.margin, y + 16);

      // Address - parse JSON object if needed
      let employeeAddress = 'N/A';
      const rawAddress = employee.address || employee.user?.address;
      if (rawAddress) {
        if (typeof rawAddress === 'object' && rawAddress !== null) {
          const parts = [];
          if (rawAddress.street) parts.push(rawAddress.street);
          if (rawAddress.city) parts.push(rawAddress.city);
          if (rawAddress.state) parts.push(rawAddress.state);
          if (rawAddress.postal_code) parts.push(rawAddress.postal_code);
          employeeAddress = parts.length > 0 ? parts.join(', ') : 'N/A';
        } else if (typeof rawAddress === 'string') {
          try {
            const parsed = JSON.parse(rawAddress);
            if (typeof parsed === 'object' && parsed !== null) {
              const parts = [];
              if (parsed.street) parts.push(parsed.street);
              if (parsed.city) parts.push(parsed.city);
              if (parsed.state) parts.push(parsed.state);
              if (parsed.postal_code) parts.push(parsed.postal_code);
              employeeAddress = parts.length > 0 ? parts.join(', ') : 'N/A';
            } else {
              employeeAddress = rawAddress;
            }
          } catch (e) {
            employeeAddress = rawAddress;
          }
        }
      }
      doc.fillColor(COLORS.gray).font(fonts.medium).fontSize(8).text(employeeAddress, PAGE.margin, y + 30, { width: 200 });

      // Employee Meta Grid (Right of profile)
      const metaX = PAGE.margin + 220;
      const metaY = y;
      const drawMeta = (label, val, mx, my) => {
        doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(7).text(label.toUpperCase(), mx, my);
        doc.fillColor(COLORS.black).font(fonts.bold).fontSize(8).text(val, mx, my + 10);
      };
      drawMeta('Employee ID', employee.employee_number || `EMP-${employee.id}`, metaX, metaY);
      drawMeta('Tax File Number', censor(employee.tax_file_number, 3), metaX + 100, metaY);
      drawMeta('Employment Type', (employee.employment_type || 'full_time').replace('_', '-').toUpperCase(), metaX, metaY + 28);

      // Get currency for this payslip
      const currency = payslip.currency || employee.currency || 'AUD';
      const currencySymbol = getCurrencySymbol(currency);
      drawMeta('Base Rate', `${currencySymbol}${fmt(employee.hourly_rate)} / hr`, metaX + 100, metaY + 28);

      // 3. Earnings Table
      y += 65;
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(9).text(getLabel(settings, 'earningsDeductionsLabel', 'EARNINGS & DEDUCTIONS'), PAGE.margin, y);
      y += 14;

      const tblCols = { desc: PAGE.margin, hrs: 250, rate: 310, cur: 390, ytd: 470 };
      doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(7);
      doc.text('DESCRIPTION', tblCols.desc, y);
      doc.text('HOURS', tblCols.hrs, y, { width: 50, align: 'center' });
      doc.text('RATE', tblCols.rate, y, { width: 60, align: 'right' });
      doc.text('THIS PAY', tblCols.cur, y, { width: 70, align: 'right' });
      doc.text('YTD', tblCols.ytd, y, { width: 70, align: 'right' });

      y += 12;
      doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(PAGE.margin, y).lineTo(PAGE.width - PAGE.margin, y).stroke();
      y += 8;

      const drawRow = (desc, hrs, rate, cur, ytd, isBold = false) => {
        doc.fillColor(isBold ? COLORS.black : COLORS.gray).font(isBold ? fonts.bold : fonts.regular).fontSize(8);
        doc.text(desc, tblCols.desc, y);
        doc.text(hrs !== null && hrs !== undefined ? fmt(hrs, 1) : '-', tblCols.hrs, y, { width: 50, align: 'center' });
        doc.text(rate ? `${currencySymbol}${fmt(rate)}` : '-', tblCols.rate, y, { width: 60, align: 'right' });
        doc.text(cur < 0 ? `-${currencySymbol}${fmt(Math.abs(cur))}` : `${currencySymbol}${fmt(cur)}`, tblCols.cur, y, { width: 70, align: 'right' });
        doc.text(ytd < 0 ? `-${currencySymbol}${fmt(Math.abs(ytd))}` : `${currencySymbol}${fmt(ytd)}`, tblCols.ytd, y, { width: 70, align: 'right' });
        y += 14;
      };

      // Calculate hours from gross_pay / hourly_rate
      const hourlyRate = parseFloat(employee.hourly_rate) || 0;
      const grossPay = parseFloat(payslip.gross_pay) || 0;
      const totalHours = hourlyRate > 0 ? (grossPay / hourlyRate) : 0;

      drawRow('Ordinary Hours (Salary)', totalHours, employee.hourly_rate, payslip.gross_pay, payslip.ytd_gross, true);
      drawRow('PAYG Withholding (Tax)', null, null, -payslip.tax_withheld, -payslip.ytd_tax);
      drawRow('SG Contribution (Super)', null, null, payslip.superannuation, payslip.ytd_super);

      // 4. Leave Balances Section - 2 more lines down (+24 = total 6 lines)
      y += 28;
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(9).text(getLabel(settings, 'leaveBalancesLabel', 'LEAVE BALANCES'), PAGE.margin, y);
      y += 14;

      const lvCols = { type: PAGE.margin, open: 210, added: 290, taken: 370, balance: 460 };
      doc.fillColor(COLORS.lightGray).font(fonts.bold).fontSize(7);
      doc.text('LEAVE TYPE', lvCols.type, y);
      doc.text('OPENING', lvCols.open, y, { width: 60, align: 'center' });
      doc.text('ADDED', lvCols.added, y, { width: 60, align: 'center' });
      doc.text('TAKEN', lvCols.taken, y, { width: 60, align: 'center' });
      doc.text('BALANCE', lvCols.balance, y, { width: 80, align: 'right' });

      y += 12;
      doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(PAGE.margin, y).lineTo(PAGE.width - PAGE.margin, y).stroke();
      y += 8;

      // Use historical leave_data snapshot from payslip, NOT current employee balances
      const leave = payslip.leave_data || {};

      // Annual Leave - use historical snapshot values
      const annualOpening = parseFloat(leave.annual_opening) || parseFloat(employee.annual_leave_balance) || 0;
      const annualAccrued = parseFloat(leave.annual_accrued) || 2.92;
      const annualTaken = parseFloat(leave.annual_taken) || 0;
      const annualBalance = parseFloat(leave.annual_balance) || parseFloat(employee.annual_leave_balance) || 0;

      // Sick Leave - use historical snapshot values
      const sickOpening = parseFloat(leave.sick_opening) || parseFloat(employee.sick_leave_balance) || 0;
      const sickAccrued = parseFloat(leave.sick_accrued) || 0;
      const sickTaken = parseFloat(leave.sick_taken) || 0;
      const sickBalance = parseFloat(leave.sick_balance) || parseFloat(employee.sick_leave_balance) || 0;

      // Annual Leave Row
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(8);
      doc.text('Annual Leave', lvCols.type, y);
      doc.font(fonts.medium).text(`${fmt(annualOpening, 1)} hrs`, lvCols.open, y, { width: 60, align: 'center' });
      doc.fillColor(COLORS.teal).text(`+${fmt(annualAccrued, 2)}`, lvCols.added, y, { width: 60, align: 'center' });
      doc.fillColor(COLORS.gray).text(`-${fmt(annualTaken, 1)}`, lvCols.taken, y, { width: 60, align: 'center' });
      doc.fillColor(COLORS.black).font(fonts.bold).text(`${fmt(annualBalance, 1)} hrs`, lvCols.balance, y, { width: 80, align: 'right' });
      y += 14;

      // Sick Leave Row
      doc.text('Personal (Sick) Leave', lvCols.type, y);
      doc.font(fonts.medium).text(`${fmt(sickOpening, 1)} hrs`, lvCols.open, y, { width: 60, align: 'center' });
      doc.fillColor(COLORS.lightGray).text(sickAccrued > 0 ? `+${fmt(sickAccrued, 2)}` : '-', lvCols.added, y, { width: 60, align: 'center' });
      doc.fillColor(COLORS.gray).text(`-${fmt(sickTaken, 1)}`, lvCols.taken, y, { width: 60, align: 'center' });
      doc.fillColor(COLORS.black).font(fonts.bold).text(`${fmt(sickBalance, 1)} hrs`, lvCols.balance, y, { width: 80, align: 'right' });
      y += 20;

      // 5. Payment & Super Grids
      const gridW = (contentWidth - 16) / 2;

      doc.roundedRect(PAGE.margin, y, gridW, 55, 8).fillColor(COLORS.bgLight).fill().strokeColor(COLORS.border).stroke();
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text(getLabel(settings, 'bankDisbursementLabel', 'BANK DISBURSEMENT'), PAGE.margin + 10, y + 8);
      doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(7).text(getLabel(settings, 'disbursedToLabel', 'Disbursed to') + ` ${employee.bank_name || 'Bank'}`, PAGE.margin + 10, y + 20);
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(8).text(employee.bank_account_name || 'Employee', PAGE.margin + 10, y + 32);
      doc.text(`BSB: ${censor(employee.bank_bsb, 3)} | ACC: ${censor(employee.bank_account_number, 3)}`, PAGE.margin + 10, y + 44);

      const superX = PAGE.margin + gridW + 16;
      doc.roundedRect(superX, y, gridW, 55, 8).fillColor(COLORS.bgLight).fill().strokeColor(COLORS.border).stroke();
      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text(getLabel(settings, 'superannuationLabel', 'SUPERANNUATION'), superX + 10, y + 8);
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(8).text(employee.super_fund_name || 'N/A', superX + 10, y + 20);

      doc.strokeColor(COLORS.border).moveTo(superX + 8, y + 34).lineTo(superX + gridW - 8, y + 34).stroke();

      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(9).text(getLabel(settings, 'netPayLabel', 'NET PAY'), superX + 10, y + 40);
      doc.fontSize(16).text(`${currencySymbol}${fmt(payslip.net_pay)}`, superX + 60, y + 36, { width: gridW - 78, align: 'right' });

      // 6. Security Footer & Verification
      y += 65;
      doc.strokeColor(COLORS.border).lineWidth(1).moveTo(PAGE.margin, y).lineTo(PAGE.width - PAGE.margin, y).stroke();
      y += 10;

      doc.fillColor(COLORS.teal).font(fonts.bold).fontSize(8).text(getLabel(settings, 'documentVerificationLabel', 'DOCUMENT VERIFICATION'), PAGE.margin, y);
      doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(7).text(getLabel(settings, 'verifyUrlLabel', 'Verify at clickbit.com.au/verify'), PAGE.margin, y + 11);

      // Use verification code if available, otherwise generate display code from payslip number
      const displayCode = verificationCode || payslipNumber;
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(9).text(displayCode, PAGE.margin, y + 22);

      if (qrBuffer) {
        doc.image(qrBuffer, PAGE.margin + 140, y, { width: 40 });
      }

      const msgX = PAGE.width - PAGE.margin - 160;
      doc.roundedRect(msgX, y, 160, 40, 8).fillColor(COLORS.bgLight).fill().strokeColor(COLORS.border).stroke();
      doc.fillColor(COLORS.black).font(fonts.bold).fontSize(7).text(getLabel(settings, 'hrMessageLabel', 'HR MESSAGE'), msgX + 8, y + 5);
      doc.fillColor(COLORS.gray).font(fonts.medium).fontSize(7).text(getLabel(settings, 'hrMessageText', 'Innovation is at our core. Thank you for your continued contribution.'), msgX + 8, y + 16, { width: 144, lineGap: 1 });

      // 7. PAID Stamp
      const stampY = y + 48;
      doc.save().rotate(-12, { origin: [PAGE.width - 90, stampY + 20] });
      if (isVisible(settings, 'showPaidStamp', true)) {
        doc.roundedRect(PAGE.width - 125, stampY, 85, 40, 6).lineWidth(2.5).dash(4, { space: 2 }).strokeColor(COLORS.success).stroke();
        doc.fillColor(COLORS.success).font(fonts.bold).fontSize(20).text(getLabel(settings, 'paidStampLabel', 'PAID'), PAGE.width - 125, stampY + 10, { width: 85, align: 'center' });
      }
      doc.restore();

      // Final Footer - ABSOLUTELY positioned at page bottom, no new page trigger
      const footerText = `© ${new Date().getFullYear()} ${getLabel(settings, 'footerCompanyName', 'ClickBit')}  ·  ABN: ${company.abn || getLabel(settings, 'companyAbn', '59 267 698 766')}  ·  ${getLabel(settings, 'footerTagline', 'INNOVATION IN EVERY BIT')}`;
      doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(PAGE.margin, PAGE.height - 38).lineTo(PAGE.width - PAGE.margin, PAGE.height - 38).stroke();
      doc.fillColor(COLORS.gray).font(fonts.regular).fontSize(8);
      doc.page.margins.bottom = 0; // Disable bottom margin to prevent new page
      doc.text(footerText, PAGE.margin, PAGE.height - 28, { width: contentWidth, align: 'center', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export { generatePayslipPDF };
