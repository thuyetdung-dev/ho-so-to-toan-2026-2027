import JSZip from 'jszip';
import { dataUrlToBytes, downloadBlob } from './systemBackupPackage';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '\ufeff';
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  return '\ufeff' + [keys.map(csvCell).join(','), ...rows.map(r => keys.map(k => csvCell(r[k])).join(','))].join('\r\n');
};
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export interface PeriodDossierInput {
  academicYear: string;
  term: string;
  startDate: string;
  endDate: string;
  schoolName: string;
  departmentName: string;
  report: Record<string, unknown>;
  members: any[];
  assignments: any[];
  departmentPlans: any[];
  teacherPlans: any[];
  lessonPlans: any[];
  meetings: any[];
  observations: any[];
  specialTopics: any[];
  trainings: any[];
  initiatives: any[];
  reportSnapshots: any[];
}

export async function exportPeriodDossier(input: PeriodDossierInput): Promise<void> {
  const zip = new JSZip();
  const meta = {
    app: 'so-sinh-hoat-chuyen-mon-to-toan',
    dossierSchemaVersion: 1,
    exportedAt: new Date().toISOString(),
    academicYear: input.academicYear,
    term: input.term,
    startDate: input.startDate,
    endDate: input.endDate,
    schoolName: input.schoolName,
    departmentName: input.departmentName,
  };
  zip.file('00_MANIFEST.json', JSON.stringify(meta, null, 2));
  zip.file('01_BAO_CAO_TONG_HOP.json', JSON.stringify(input.report, null, 2));
  zip.file('02_THANH_VIEN.csv', toCsv(input.members.map(m => ({id:m.id,hoTen:m.displayName,email:m.email,vaiTro:m.role,trangThai:m.status}))));
  zip.file('03_PHAN_CONG.csv', toCsv(input.assignments.map(a => ({id:a.id,giaoVienId:a.teacherId,lop:a.className||a.classId,mon:a.subject,soTiet:a.periodsPerWeek||a.periods,namHoc:a.academicYear,hocKy:a.term}))));
  zip.file('04_KE_HOACH_TO.json', JSON.stringify(input.departmentPlans, null, 2));
  zip.file('05_KE_HOACH_GIAO_VIEN.json', JSON.stringify(input.teacherPlans, null, 2));
  zip.file('06_GIAO_AN/DANH_MUC.csv', toCsv(input.lessonPlans.map(p => ({id:p.id,giaoVien:p.teacherName||p.teacherId,tieuDe:p.title||p.topicTitle,khoi:p.grade,tuan:p.week,status:p.status,updatedAt:p.updatedAt}))));
  for (const raw of input.lessonPlans) {
    const plan = structuredClone(raw);
    const images = plan.images || {};
    plan.images = {};
    for (const [imageId, dataUrl] of Object.entries(images as Record<string,string>)) {
      if (typeof dataUrl !== 'string') throw new Error(`Ảnh không hợp lệ: ${imageId}`);
      let encoded = dataUrl;
      if (dataUrl.startsWith('https://')) {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`Không tải được ảnh ${imageId}: ${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error(`Tệp ${imageId} không phải ảnh`);
        encoded = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error(`Không đọc được ảnh ${imageId}`));reader.readAsDataURL(blob);});
      }
      if (!encoded.startsWith('data:image/')) throw new Error(`Ảnh chưa tải đầy đủ: ${imageId}`);
      const parsed = dataUrlToBytes(encoded);
      const imagePath = `06_GIAO_AN/ANH/${safe(String(plan.id))}/${safe(imageId)}.${parsed.extension}`;
      zip.file(imagePath, parsed.bytes);
      plan.images[imageId] = imagePath;
    }
    zip.file(`06_GIAO_AN/HO_SO/${safe(String(plan.id))}.json`, JSON.stringify(plan, null, 2));
  }
  zip.file('07_SINH_HOAT_CHUYEN_MON.json', JSON.stringify(input.meetings, null, 2));
  zip.file('08_DU_GIO.json', JSON.stringify(input.observations, null, 2));
  zip.file('09_CHUYEN_DE.json', JSON.stringify(input.specialTopics, null, 2));
  zip.file('10_BOI_DUONG.json', JSON.stringify(input.trainings, null, 2));
  zip.file('11_SANG_KIEN.json', JSON.stringify(input.initiatives, null, 2));
  zip.file('12_BAO_CAO_DA_CHOT.json', JSON.stringify(input.reportSnapshots, null, 2));

  const counts = [
    ['Thành viên', input.members.length], ['Phân công', input.assignments.length], ['Kế hoạch tổ', input.departmentPlans.length],
    ['Kế hoạch giáo viên', input.teacherPlans.length], ['Giáo án', input.lessonPlans.length], ['SHCM', input.meetings.length],
    ['Dự giờ', input.observations.length], ['Chuyên đề', input.specialTopics.length], ['Bồi dưỡng', input.trainings.length],
  ];
  zip.file('MUC_LUC.html', `<!doctype html><meta charset="utf-8"><title>Hồ sơ ${esc(input.term)} ${esc(input.academicYear)}</title>
  <style>body{font:14px Arial;max-width:900px;margin:40px auto;line-height:1.55}h1{color:#17365d}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}.meta{background:#f5f7fa;padding:14px}</style>
  <h1>HỒ SƠ CHUYÊN MÔN ĐIỆN TỬ – ${esc(input.departmentName)}</h1><div class="meta"><b>${esc(input.schoolName)}</b><br>Năm học: ${esc(input.academicYear)}<br>Giai đoạn: ${esc(input.term)} (${esc(input.startDate)} – ${esc(input.endDate)})<br>Xuất lúc: ${esc(meta.exportedAt)}</div>
  <h2>Mục lục dữ liệu</h2><table><tr><th>Nhóm hồ sơ</th><th>Số lượng</th></tr>${counts.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</table>
  <p>Gói hồ sơ này là bản xuất điện tử có cấu trúc; các tệp JSON/CSV giữ mã hồ sơ để đối chiếu với audit/deep-link trong hệ thống.</p>`);
  zip.file('README.txt', 'Gói hồ sơ cuối kỳ/năm được xuất từ Sổ Sinh hoạt Chuyên môn Tổ Toán. Giữ nguyên cấu trúc ZIP để phục vụ lưu trữ và đối chiếu minh chứng.');

  const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  downloadBlob(blob, `Ho_So_${safe(input.term)}_${safe(input.academicYear)}_${new Date().toISOString().slice(0,10)}.zip`);
}
