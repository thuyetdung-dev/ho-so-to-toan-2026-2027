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

test('AI kiểm tra thành viên, email xác minh và lỗi dịch vụ quyền', async () => {
  const { checkAiMembership } = await import('../api/ai.ts');
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ fields: { role: { stringValue: 'teacher' } } }), { status: 200 }); };
    assert.equal(await checkAiMembership('token', 'teacher@example.com', false), 403);
    assert.equal(calls, 0);
    assert.equal(await checkAiMembership('token', 'teacher@example.com', true), 200);
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    assert.equal(await checkAiMembership('token', 'teacher@example.com', true), 403);
    globalThis.fetch = async () => new Response(JSON.stringify({ fields: { role: { stringValue: 'unknown' } } }));
    assert.equal(await checkAiMembership('token', 'teacher@example.com', true), 403);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await checkAiMembership('token', 'teacher@example.com', true), 503);
  } finally { globalThis.fetch = original; }
});

test('quota dùng giao dịch chung, từ chối đầy, retry xung đột và không bỏ qua lỗi quyền',async()=>{
 const {consumeAiQuota}=await import('../api/ai.ts');const original=globalThis.fetch;const originalLimit=process.env.AI_RATE_LIMIT;let commits=0;let mode='conflict';const writes:any[]=[];
 try{
  process.env.AI_RATE_LIMIT='2';globalThis.fetch=async(url,init)=>{const u=String(url);if(u.endsWith(':beginTransaction'))return new Response(JSON.stringify({transaction:'TX'}));if(u.endsWith(':rollback'))return new Response('{}');if(u.includes('/aiUsage/'))return new Response(JSON.stringify({fields:{count:{integerValue:mode==='full'?'2':'1'},windowStart:{timestampValue:new Date().toISOString()}}}));if(u.endsWith(':commit')){commits++;writes.push(JSON.parse(String(init?.body)));if(mode==='deny')return new Response('{}',{status:403});if(commits===1&&mode==='conflict')return new Response(JSON.stringify({error:{status:'ABORTED'}}),{status:409});return new Response('{}');}throw Error('Unexpected URL');};
  assert.equal(await consumeAiQuota('token','uid'),'allowed');assert.equal(commits,2);assert.equal(writes[0].writes[0].update.fields.count.integerValue,'2');assert.equal(writes[0].transaction,'TX');mode='full';assert.equal(await consumeAiQuota('token','uid'),'limited');assert.equal(commits,2);mode='deny';assert.equal(await consumeAiQuota('token','uid'),'unavailable');
  globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await consumeAiQuota('token','uid'),'unavailable');
 }finally{globalThis.fetch=original;if(originalLimit===undefined)delete process.env.AI_RATE_LIMIT;else process.env.AI_RATE_LIMIT=originalLimit;}
});

test('mô hình máy chủ đọc danh sách thực tế và ưu tiên cấu hình',async()=>{
 const {resolveServerModel}=await import('../api/ai.ts');const fetchOriginal=globalThis.fetch;const envModel=process.env.GEMINI_MODEL;try{delete process.env.GEMINI_MODEL;globalThis.fetch=async()=>new Response(JSON.stringify({models:[{name:'models/gemini-9.1-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-10-pro-preview',supportedGenerationMethods:['generateContent']},{name:'models/gemini-11-image',supportedGenerationMethods:['generateContent']}]}));assert.equal(await resolveServerModel(),'gemini-9.1-flash');process.env.GEMINI_MODEL='configured-model';assert.equal(await resolveServerModel(),'configured-model');}finally{globalThis.fetch=fetchOriginal;if(envModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=envModel;}
});
