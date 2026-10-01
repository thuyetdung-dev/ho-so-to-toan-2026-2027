import JSZip from 'jszip';

const APP_ID = 'so-sinh-hoat-chuyen-mon-to-toan';
export const BACKUP_SCHEMA_VERSION = 3;

export interface BackupImageEntry {
  planId: string;
  imageId: string;
  path: string;
  contentType: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  app: string;
  schemaVersion: number;
  createdAt: string;
  academicYear?: string;
  dataFile: string;
  dataSha256: string;
  imageCount: number;
  images: BackupImageEntry[];
}

const encoder = new TextEncoder();

async function sha256(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string'
    ? encoder.encode(data)
    : data;

  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);

  const digest = await crypto.subtle.digest(
    'SHA-256',
    safeBytes.buffer
  );

  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
function safePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_@.+-]/g, '_').slice(0, 150) || 'item';
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Ảnh trong backup không phải data URL hợp lệ.');
  const contentType = m[1] || 'application/octet-stream';
  const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg';
  return { bytes, contentType, extension: ext };
}

function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** Tạo backup ZIP: data.json không chứa base64; ảnh nằm ở images/{planId}/{imageId}.ext. */
export async function createSystemBackupZip(backup: Record<string, any>): Promise<Blob> {
  const zip = new JSZip();
  const data = structuredClone(backup);
  data.backupSchemaVersion = BACKUP_SCHEMA_VERSION;
  const imageEntries: BackupImageEntry[] = [];

  for (const plan of data.lessonPlans || []) {
    const images = plan.images || {};
    plan.images = {};
    for (const [imageId, dataUrl] of Object.entries(images as Record<string, string>)) {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
      const parsed = dataUrlToBytes(dataUrl);
      const path = `images/${safePart(String(plan.id))}/${safePart(imageId)}.${parsed.extension}`;
      zip.file(path, parsed.bytes);
      imageEntries.push({
        planId: String(plan.id), imageId, path, contentType: parsed.contentType,
        bytes: parsed.bytes.byteLength, sha256: await sha256(parsed.bytes),
      });
    }
  }

  const dataJson = JSON.stringify(data, null, 2);
  const manifest: BackupManifest = {
    app: APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    academicYear: data.config?.academicYear,
    dataFile: 'data.json',
    dataSha256: await sha256(dataJson),
    imageCount: imageEntries.length,
    images: imageEntries,
  };
  zip.file('data.json', dataJson);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('README.txt', [
    'GÓI SAO LƯU SỔ SINH HOẠT CHUYÊN MÔN TỔ TOÁN',
    `Năm học: ${manifest.academicYear || ''}`,
    `Tạo lúc: ${manifest.createdAt}`,
    `Schema: ${manifest.schemaVersion}`,
    `Số ảnh: ${manifest.imageCount}`,
    '',
    'Không chỉnh sửa thủ công manifest.json hoặc data.json nếu cần phục hồi có kiểm tra checksum.',
  ].join('\n'));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function parseSystemBackupFile(file: File): Promise<Record<string, any>> {
  if (file.name.toLowerCase().endsWith('.json')) return JSON.parse(await file.text());
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestRaw = await zip.file('manifest.json')?.async('string');
  const dataRaw = await zip.file('data.json')?.async('string');
  if (!manifestRaw || !dataRaw) throw new Error('Gói ZIP thiếu manifest.json hoặc data.json.');
  const manifest = JSON.parse(manifestRaw) as BackupManifest;
  if (manifest.app !== APP_ID || manifest.schemaVersion < 3) throw new Error('Gói backup ZIP không đúng định dạng phiên bản 3.');
  if (await sha256(dataRaw) !== manifest.dataSha256) throw new Error('Checksum data.json không khớp; tệp có thể đã bị thay đổi hoặc hỏng.');
  const data = JSON.parse(dataRaw) as Record<string, any>;
  const planById = new Map<string, any>((data.lessonPlans || []).map((p: any) => [String(p.id), p]));
  for (const entry of manifest.images || []) {
    const fileEntry = zip.file(entry.path);
    if (!fileEntry) throw new Error(`Thiếu ảnh ${entry.path} trong gói backup.`);
    const bytes = await fileEntry.async('uint8array');
    if (bytes.byteLength !== entry.bytes || await sha256(bytes) !== entry.sha256) throw new Error(`Checksum ảnh ${entry.path} không khớp.`);
    const plan = planById.get(entry.planId);
    if (!plan) throw new Error(`Ảnh ${entry.path} tham chiếu giáo án không tồn tại.`);
    plan.images ||= {};
    plan.images[entry.imageId] = bytesToDataUrl(bytes, entry.contentType);
  }
  return data;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
