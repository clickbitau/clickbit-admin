export function getInvoiceSampleData() {
  return {
    document_type: 'invoice',
    package_code: 'CLKINV-26-01-09-002',
    created_at: '2026-01-09T00:00:00.000Z',
    valid_until: '2026-01-31T00:00:00.000Z',
    client_name: 'Saiful',
    client_company: 'iGenius & Oracle Education',
    client_email: 'info@igeniusprofessionals.com.au',
    client_notes: 'Cost Breakdown:\n1. 10 Nov 2025 - Creation of 9 static images - 2 hours\n2. 16 Dec 2025 - Changing of images - 0.5 hours\n3. 31 Dec 2025 - Video Slider Creation - 1 hour',
    terms: 'Payment is due within 14 days of invoice date.',
    subtotal: '147.91',
    tax_rate: '10',
    tax_type: 'gst_calculated',
    total_amount: '105.53',
    amount_paid: '0',
    payment_status: 'sent',
    discount_amount: '0',
    discount_type: 'amount',
    line_items: [
      { name: 'Meta Ads Creation', description: '+ (9 Static Ads + 1 Video Reel)', quantity: 3.5, unit_price: '45' },
    ],
    payment_history: [],
  };
}

export function getPayslipSampleData() {
  const employee = {
    user: { first_name: 'John', last_name: 'Smith', email: 'john.smith@clickbit.com.au' },
    position: 'Senior Developer',
    employment_type: 'full_time',
    employee_number: 'EMP-001',
    tax_file_number: '***-***-123',
    hourly_rate: '45.00',
    currency: 'AUD',
    bank_name: 'Commonwealth Bank',
    bank_account_name: 'John Smith',
    bank_bsb: '062-000',
    bank_account_number: '12345678',
    super_fund_name: 'Australian Super',
    annual_leave_balance: '76.0',
    sick_leave_balance: '38.0',
  };

  const payslip = {
    id: 123,
    payment_date: '2026-01-16',
    pay_period_start: '2026-01-01',
    pay_period_end: '2026-01-14',
    currency: 'AUD',
    gross_pay: '3420.00',
    tax_withheld: '684.00',
    superannuation: '393.30',
    net_pay: '2736.00',
    ytd_gross: '44460.00',
    ytd_tax: '8892.00',
    ytd_super: '5112.90',
    leave_data: {
      annual_opening: 76,
      annual_accrued: 2.92,
      annual_taken: 0,
      annual_balance: 78.92,
      sick_opening: 38,
      sick_accrued: 0,
      sick_taken: 0,
      sick_balance: 38,
    },
  };

  return { employee, payslip };
}

export function getContractSampleData() {
  const employee = {
    user: { first_name: 'John', last_name: 'Smith', email: 'john.smith@clickbit.com.au' },
    address: '19 Drysdale Approach',
    city: 'Baldivis',
    state: 'WA',
    postcode: '6171',
    country: 'Australia',
  };

  const contractManager = {
    user: { first_name: 'Jane', last_name: 'Doe', email: 'jane.doe@clickbit.com.au' },
    position: 'HR Manager',
  };

  return {
    employee,
    contractManager,
    companyAddress: '19 Drysdale Approach, Baldivis, WA 6171',
    contract_number: 'CTR-2026-001',
    position: 'Senior Developer',
    employment_type: 'full_time',
    department: 'Engineering',
    start_date: '2026-02-01',
    end_date: null,
    hourly_rate: '45.00',
    salary: '120000',
    pay_frequency: 'fortnightly',
    currency: 'AUD',
    default_weekly_hours: 38,
    work_country: 'Australia',
    work_schedule: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
    },
    responsibilities: 'Carry out duties faithfully and in the best interests of the company.\nPerform assigned tasks to a high standard of quality and timeliness.\nCollaborate effectively with team members and stakeholders.',
    terms_summary: 'This contract is subject to the National Employment Standards and any applicable modern award.',
    special_conditions: '',
    additional_terms: '',
    employee_signature_name: 'John Smith',
    employee_accepted_at: '2026-01-20',
    manager_signature_name: 'Jane Doe',
  };
}
