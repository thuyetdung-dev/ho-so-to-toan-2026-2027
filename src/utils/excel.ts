import * as XLSX from 'xlsx';
import type { Assignment } from '../types';

/**
 * Sanitize text to prevent CSV/Excel Formula Injection (DDE attacks)
 * if cell starts with =, +, -, @, \t, \r, prepend a single quote
 */
export function sanitizeCellValue(val: any): any {
  if (typeof val === 'string') {
    if (['=', '+', '-', '@', '\t', '\r'].some(prefix => val.startsWith(prefix))) {
      return `'${val}`;
    }
  }
  return val;
}

/**
 * Download workbook as xlsx file in browser
 */
export function exportToExcel(sheets: { name: string; data: any[] }[], fileName: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const sanitizedData = s.data.map(row => {
      const cleanRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        cleanRow[k] = sanitizeCellValue(v);
      }
      return cleanRow;
    });
    const ws = XLSX.utils.json_to_sheet(sanitizedData);
    XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * Template generators
 */
export function downloadAssignmentTemplate() {
  const sample = [
    {
      'Họ và tên giáo viên': 'Nguyễn Văn A',
      'Lớp': '10A1',
      'Khối': 10,
      'Môn/Chuyên đề': 'Toán',
      'Số tiết/tuần': 4,
      'Nhiệm vụ kiêm nhiệm': 'Chủ nhiệm 10A1',
      'Học kỳ': 'HK1',
    },
    {
      'Họ và tên giáo viên': 'Trần Thị B',
      'Lớp': '11A2',
      'Khối': 11,
      'Môn/Chuyên đề': 'Toán',
      'Số tiết/tuần': 4,
      'Nhiệm vụ kiêm nhiệm': 'Bồi dưỡng HSG',
      'Học kỳ': 'HK1',
    },
  ];
  exportToExcel([{ name: 'PhanCong', data: sample }], 'Mau_Phan_Cong_Chuyen_Mon_To_Toan');
}

/**
 * Parse uploaded Excel file
 */
export async function parseExcelFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

