const REPORT_URL_KEY = 'kpi.integration.reportAppUrl';

type MemberLike = { id?: string; displayName?: string; email?: string };
type TaskLike = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  deadline?: string;
  assigneeId?: string;
  assigneeName?: string;
};

function cleanBaseUrl(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

export function getReportAppUrl() {
  if (typeof window === 'undefined') return '';
  return cleanBaseUrl(window.localStorage.getItem(REPORT_URL_KEY) || '');
}

export function setReportAppUrl(value: string) {
  if (typeof window === 'undefined') return '';
  const cleaned = cleanBaseUrl(value);
  if (cleaned) window.localStorage.setItem(REPORT_URL_KEY, cleaned);
  else window.localStorage.removeItem(REPORT_URL_KEY);
  return cleaned;
}

export function ensureReportAppUrl() {
  const current = getReportAppUrl();
  if (current) return current;
  if (typeof window === 'undefined') return '';
  const entered = window.prompt(
    'Nhập URL App Báo cáo tự động (chỉ cần thiết lập một lần trên trình duyệt này):',
    '',
  );
  return entered == null ? '' : setReportAppUrl(entered);
}

function memberEmail(member?: unknown) {
  if (!member || typeof member !== 'object') return '';
  const value = (member as Record<string, unknown>).email;
  return typeof value === 'string' ? value : '';
}

export function buildReportUrl(args: { task?: TaskLike; member?: MemberLike | unknown }) {
  const base = ensureReportAppUrl();
  if (!base) return '';
  const url = new URL(base);
  url.searchParams.set('from', 'kpi');
  const member = args.member as MemberLike | undefined;
  if (member?.id) url.searchParams.set('member', member.id);
  if (member?.displayName) url.searchParams.set('memberName', member.displayName);
  const email = memberEmail(member);
  if (email) url.searchParams.set('memberEmail', email);
  if (args.task) {
    url.searchParams.set('task', args.task.id);
    url.searchParams.set('taskTitle', args.task.title);
    if (args.task.description) url.searchParams.set('taskDescription', args.task.description);
    if (args.task.status) url.searchParams.set('taskStatus', args.task.status);
    if (args.task.deadline) {
      url.searchParams.set('taskDeadline', args.task.deadline);
      if (/^\d{4}-\d{2}-\d{2}/.test(args.task.deadline)) {
        url.searchParams.set('year', args.task.deadline.slice(0, 4));
        url.searchParams.set('month', args.task.deadline.slice(5, 7));
      }
    }
  }
  return url.toString();
}

export function openReportApp(args: { task?: TaskLike; member?: MemberLike | unknown }) {
  const url = buildReportUrl(args);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
