import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSnapshots, isDetailedSnapshot } from '../src/utils/diff.ts';
import { computeStats, parseScores } from '../src/utils/stats.ts';
import { newId, safeUrl } from '../src/utils/ids.ts';

test('diffSnapshots phát hiện thêm/bớt/sửa theo id', () => {
  const a = { title: 'KH', distribution: [{ id: '1', topicTitle: 'Bài 1', periods: 2 }, { id: '2', topicTitle: 'Bài 2', periods: 3 }] };
  const b = { title: 'KH mới', distribution: [{ id: '1', topicTitle: 'Bài 1', periods: 4 }, { id: '3', topicTitle: 'Bài 3', periods: 1 }] };
  const d = diffSnapshots(a, b);
  assert.ok(d.some(e => e.kind === 'changed' && e.label === 'Tiêu đề' && e.after === 'KH mới'));
  assert.ok(d.some(e => e.kind === 'changed' && e.label.includes('Bài 1') && e.before === '2' && e.after === '4'));
  assert.ok(d.some(e => e.kind === 'added' && e.label.includes('Bài 3')));
  assert.ok(d.some(e => e.kind === 'removed' && e.label.includes('Bài 2')));
  assert.equal(diffSnapshots(a, a).length, 0);
  assert.equal(isDetailedSnapshot(a), true);
  assert.equal(isDetailedSnapshot({ title: 'x', totalPeriods: 3 }), false);
});

test('parseScores đọc dấu phẩy thập phân và báo giá trị lỗi', () => {
  const { scores, invalid } = parseScores('7,5\n8\n6.25; 10 11 abc\n0');
  assert.deepEqual(scores, [7.5, 8, 6.25, 10, 0]);
  assert.deepEqual(invalid, ['11', 'abc']);
  assert.deepEqual(parseScores('7.5, 8, 9').scores, [7.5, 8, 9]);
});

test('computeStats tính đúng trung bình, trung vị, tỉ lệ', () => {
  const s = computeStats([2, 4, 6, 8, 10]);
  assert.equal(s.n, 5);
  assert.equal(s.mean, 6);
  assert.equal(s.median, 6);
  assert.equal(s.passRate, 60);
  assert.equal(s.goodRate, 40);
  assert.equal(s.weakRate, 20);
  assert.equal(s.bins[9], 1); // điểm 10 nằm ở khoảng cuối
  assert.equal(computeStats([]).n, 0);
});

test('safeUrl chỉ cho phép http/https', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,hi'), null);
  assert.equal(safeUrl('not a url'), null);
  assert.equal(safeUrl('https://drive.google.com/x'), 'https://drive.google.com/x');
});

test('newId không trùng khi gọi liên tiếp', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newId('log')));
  assert.equal(ids.size, 1000);
});
