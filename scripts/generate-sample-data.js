import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../samples');

if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

console.log('📊 Generating realistic test Excel workbooks...');

// 1. Standard Business Directory (.xlsx) with 2 worksheets
const workbook1 = XLSX.utils.book_new();

// Sheet 1: Employees
const employeesHeaders = ['ID', 'Name', 'Mobile', 'Email', 'Department', 'Designation', 'City', 'Joining Date'];
const employeesRows = [
  ['00101', 'Aarav Sharma', '09876543210', 'aarav.sharma@example.com', 'Engineering', 'Lead Architect', 'Bengaluru', '2022-01-15'],
  ['00102', 'Diya Patel', '09812345678', 'diya.patel@example.com', 'Product Management', 'Principal PM', 'Mumbai', '2021-06-20'],
  ['00103', 'Rohan Verma', '09845678901', 'rohan.verma@example.com', 'Sales & Marketing', 'Regional Director', 'Delhi', '2020-03-10'],
  ['00104', 'Sneha Kulkarni', '09823456789', 'sneha.k@example.com', 'Human Resources', 'HR Business Partner', 'Pune', '2023-02-01'],
  ['00105', 'Vikram Singh', '09834567890', 'vikram.singh@example.com', 'Engineering', 'Senior DevOps Engineer', 'Hyderabad', '2022-09-18'],
  ['00106', 'Pooja Iyer', '09856789012', 'pooja.iyer@example.com', 'Finance', 'Financial Analyst', 'Chennai', '2021-11-05'],
  ['00107', 'Kabir Mehta', '09867890123', 'kabir.m@example.com', 'Legal & Compliance', 'Legal Counsel', 'Gurugram', '2023-07-22'],
  ['00108', 'Ananya Nair', '09878901234', 'ananya.nair@example.com', 'Engineering', 'Full Stack Developer', 'Kochi', '2024-04-12'],
  ['00109', 'Aditya Joshi', '09889012345', 'aditya.joshi@example.com', 'Customer Support', 'Support Manager', 'Kolkata', '2022-08-30'],
  ['00110', 'Meera Reddy', '09890123456', 'meera.reddy@example.com', 'Design', 'Staff UI/UX Designer', 'Bengaluru', '2021-04-14'],
];

const ws1 = XLSX.utils.aoa_to_sheet([employeesHeaders, ...employeesRows]);
// Explicit string types for ID and Mobile to preserve leading zeroes
const range1 = XLSX.utils.decode_range(ws1['!ref']);
for (let R = 1; R <= range1.e.r; ++R) {
  const cId = XLSX.utils.encode_cell({ r: R, c: 0 });
  if (ws1[cId]) ws1[cId].t = 's';
  const cMob = XLSX.utils.encode_cell({ r: R, c: 2 });
  if (ws1[cMob]) ws1[cMob].t = 's';
}
XLSX.utils.book_append_sheet(workbook1, ws1, 'Employees');

// Sheet 2: Contractors
const contractorsHeaders = ['Emp ID', 'Full Name', 'Contact Number', 'E-mail Address', 'Agency', 'Hourly Rate', 'Contract End'];
const contractorsRows = [
  ['00201', 'David Miller', '09711223344', 'david.m@contractor.net', 'Apex Staffing', '$75/hr', '2026-12-31'],
  ['00202', 'Elena Rostova', '09722334455', 'elena.r@contractor.net', 'Global Tech Solutions', '$85/hr', '2027-03-31'],
  ['00203', 'Carlos Gomez', '09733445566', 'carlos.g@contractor.net', 'Apex Staffing', '$70/hr', '2026-10-15'],
];
const ws2 = XLSX.utils.aoa_to_sheet([contractorsHeaders, ...contractorsRows]);
const range2 = XLSX.utils.decode_range(ws2['!ref']);
for (let R = 1; R <= range2.e.r; ++R) {
  const cId = XLSX.utils.encode_cell({ r: R, c: 0 });
  if (ws2[cId]) ws2[cId].t = 's';
  const cMob = XLSX.utils.encode_cell({ r: R, c: 2 });
  if (ws2[cMob]) ws2[cMob].t = 's';
}
XLSX.utils.book_append_sheet(workbook1, ws2, 'Contractors');

const file1Path = path.join(SAMPLES_DIR, 'sample_business_records.xlsx');
XLSX.writeFile(workbook1, file1Path);
console.log(`✅ Created: ${file1Path}`);

// 2. Duplicate detection test workbook
const workbook2 = XLSX.utils.book_new();
const dupHeaders = ['Record ID', 'Full Name', 'Phone', 'Email', 'Department', 'Notes'];
const dupRows = [
  ['00101', 'Aarav Sharma', '09876543210', 'aarav.sharma@example.com', 'Engineering', 'Original Row'],
  ['00101', 'Aarav Sharma Duplicate', '09876543210', 'aarav.duplicate@example.com', 'Engineering', 'Duplicate Row within Same Upload'],
  ['00102', 'Diya Patel (Updated)', '09812345678', 'diya.updated@example.com', 'Product Management', 'Should update existing if Merge mode'],
  ['00301', 'Farhan Akhtar', '09744556677', 'farhan.a@example.com', 'Marketing', 'Brand Strategist'],
  ['', 'Missing ID Row', '09700000000', 'missing@example.com', 'Operations', 'Should be skipped due to empty ID'],
];
const wsDup = XLSX.utils.aoa_to_sheet([dupHeaders, ...dupRows]);
const rangeDup = XLSX.utils.decode_range(wsDup['!ref']);
for (let R = 1; R <= rangeDup.e.r; ++R) {
  const cId = XLSX.utils.encode_cell({ r: R, c: 0 });
  if (wsDup[cId]) wsDup[cId].t = 's';
  const cMob = XLSX.utils.encode_cell({ r: R, c: 2 });
  if (wsDup[cMob]) wsDup[cMob].t = 's';
}
XLSX.utils.book_append_sheet(workbook2, wsDup, 'DuplicatesTest');

const file2Path = path.join(SAMPLES_DIR, 'sample_with_duplicates.xlsx');
XLSX.writeFile(workbook2, file2Path);
console.log(`✅ Created: ${file2Path}`);

// 3. Formula Injection security test workbook
const workbook3 = XLSX.utils.book_new();
const secHeaders = ['ID', 'Name', 'Mobile', 'Email', 'Company', 'Security Test Payload'];
const secRows = [
  ['00401', '=cmd|\' /C calc\'!A0', '09111111111', 'calc@test.com', 'PenTest Corp', '=1+1'],
  ['00402', '+100Bonus', '09222222222', 'bonus@test.com', 'PenTest Corp', '@SUM(A1:A10)'],
  ['00403', '-50Penalty', '09333333333', 'penalty@test.com', 'PenTest Corp', '-2*5'],
];
const wsSec = XLSX.utils.aoa_to_sheet([secHeaders, ...secRows]);
XLSX.utils.book_append_sheet(workbook3, wsSec, 'SecurityTest');

const file3Path = path.join(SAMPLES_DIR, 'sample_security_payloads.xlsx');
XLSX.writeFile(workbook3, file3Path);
console.log(`✅ Created: ${file3Path}`);

console.log('🎉 Sample Excel files ready in samples/ directory.');
