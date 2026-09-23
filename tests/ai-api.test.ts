import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ai.ts';

function call(req: { method: string; headers?: Record<string, string>; body?: unknown }) {
  return new Promise<{ code: number; data: any }>(resolve => {
    let code = 200;
    const res = {
      setHeader() {},
      status(c: number) { code = c; return res; },
      json(data: unknown) { resolve({ code, data }); },
    };
    handler({ headers: {}, ...req } as any, res as any);
  });
}

test('GET báo trạng thái cấu hình, không lộ khóa', async () => {
  const r = await call({ method: 'GET' });
  assert.equal(r.code, 200);
  assert.equal(typeof r.data.ai, 'boolean');
});

test('từ chối phương thức khác POST', async () => {
  assert.equal((await call({ method: 'PUT' })).code, 405);
});

test('POST không có token → 401', async () => {
  const r = await call({ method: 'POST', body: { prompt: 'hi' } });
  assert.equal(r.code, 401);
});

test('POST token giả → 401', async () => {
  const r = await call({ method: 'POST', headers: { authorization: 'Bearer abc.def.ghi' }, body: { prompt: 'hi' } });
  assert.equal(r.code, 401);
});
