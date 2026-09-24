import * as XLSX from '@e965/xlsx';
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
  // Theo mẫu của tổ: tiết theo TKB + dòng "Quy đổi nhiệm vụ" (không có lớp) và "Quy đổi chủ nhiệm"
  const row = (gv: string, lop: string, khoi: number | '', mon: string, tiet: number, nv = '') => ({
    'Họ và tên giáo viên': gv, 'Lớp': lop, 'Khối': khoi, 'Môn/Chuyên đề': mon, 'Số tiết/tuần': tiet, 'Nhiệm vụ kiêm nhiệm': nv, 'Học kỳ': 'HK1',
  });
  const sample = [
    row('Nguyễn Văn A', '12A01', 12, 'Toán', 3),
    row('Nguyễn Văn A', '12A01', 12, 'Toán 2', 1),
    row('Nguyễn Văn A', '12A01', 12, 'Chuyên đề Toán', 1),
    row('Nguyễn Văn A', '11B02', 11, 'Toán', 3),
    row('Nguyễn Văn A', '', '', 'Quy đổi nhiệm vụ', 3, 'TTCM'),
    row('Trần Thị B', '10C03', 10, 'Toán', 3),
    row('Trần Thị B', '10C03', 10, 'Hoạt động', 2),
    row('Trần Thị B', '10C03', 10, 'CTH (tiết chủ nhiệm theo TKB)', 1),
    row('Trần Thị B', '10C03', 10, 'Quy đổi chủ nhiệm', 3, 'GVCN 10C03 (CTH trong TKB)'),
  ];
  const guide = [
    { 'Hướng dẫn': 'Mỗi dòng là một môn/nhiệm vụ của một giáo viên. Tiết theo TKB: Toán, Toán 2, Chuyên đề Toán, Hoạt động, CTH.' },
    { 'Hướng dẫn': 'Tiết quy đổi: dòng "Quy đổi nhiệm vụ" (để trống cột Lớp, ghi mã TTCM, TPCM, CT-CĐCS, UVBCH-CĐ, TTCĐ vào cột Nhiệm vụ kiêm nhiệm).' },
    { 'Hướng dẫn': 'Chủ nhiệm: dòng "Quy đổi chủ nhiệm" ghi lớp và "GVCN <lớp>" vào cột Nhiệm vụ kiêm nhiệm.' },
    { 'Hướng dẫn': 'Phần mềm tự tính: Tổng tiết/tuần = Tiết theo TKB + Tiết quy đổi, và lập bảng tổng hợp như sheet TongHop.' },
  ];
  exportToExcel([{ name: 'PhanCong', data: sample }, { name: 'HuongDan', data: guide }], 'Mau_Phan_Cong_Chuyen_Mon_To_Toan');
}

/**
 * Parse uploaded Excel file
 */
export async function parseExcelFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[pickAssignmentSheet(wb)], { defval: '' });
}

/**
 * Chọn sheet phân công: file của tổ có 2 sheet (TongHop, PhanCong) – sheet đầu là bảng tổng hợp.
 * Ưu tiên sheet có cột "Lớp" và "Số tiết/tuần"; nếu không có thì sheet tên PhanCong; cuối cùng sheet đầu.
 */
export function pickAssignmentSheet(wb: { SheetNames: string[]; Sheets: Record<string, any> }): string {
  const headerOf = (name: string) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' });
    return (rows[0] || []).map(v => String(v).normalize('NFC').trim().toLowerCase());
  };
  const byHeader = wb.SheetNames.find(n => {
    const h = headerOf(n);
    return h.includes('lớp') && h.some(x => x.startsWith('số tiết'));
  });
  return byHeader || wb.SheetNames.find(n => /phan\s*cong/i.test(n.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) || wb.SheetNames[0];
}

