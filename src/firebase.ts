import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// ignoreUndefinedProperties: Firestore từ chối mọi tài liệu có trường `undefined`
// (ví dụ approvedBy, lockedAt, dateTaught...). Trước đây các thao tác duyệt/khóa
// biên bản bị lỗi âm thầm vì lý do này.
export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  firebaseConfig.firestoreDatabaseId,
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Email chủ sở hữu hệ thống (luôn có quyền Quản trị, kể cả khi CSDL còn trống).
 * PHẢI trùng với hàm isOwner() trong firestore.rules.
 */
export const OWNER_EMAIL = 'thuyetdung@gmail.com';

export const firebaseProjectId = firebaseConfig.projectId;

/** Chuyển lỗi Firebase thành thông báo tiếng Việt dễ hiểu. */
export function describeFirebaseError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error);
  if (code.includes('permission-denied') || message.includes('insufficient permissions')) {
    return 'Bạn không có quyền thực hiện thao tác này (Firestore từ chối).';
  }
  if (code.includes('unavailable') || message.includes('offline')) {
    return 'Mất kết nối máy chủ. Dữ liệu sẽ được đồng bộ khi có mạng trở lại.';
  }
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'Bạn đã đóng cửa sổ đăng nhập.';
  }
  if (code.includes('popup-blocked')) {
    return 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên và thử lại.';
  }
  if (code.includes('unauthorized-domain')) {
    return 'Tên miền này chưa được khai báo trong Firebase Authentication (Authorized domains).';
  }
  return message;
}
