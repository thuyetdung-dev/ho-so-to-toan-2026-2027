import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  clearStoredKey,
  getStoredKey,
  getStoredModel,
  getStoredModelList,
  isKeyRemembered,
  probeModels,
  setStoredKey,
  setStoredModel,
  type GeminiModel,
} from '../../services/gemini';

interface Props {
  /** Báo cho trang cha biết đã có / chưa có khóa */
  onChange?: (hasKey: boolean) => void;
}

/** Ô "Khóa API Google Gemini": dán khóa, Hiện/Xóa, chọn mô hình, Dò. Khóa chỉ nằm trong trình duyệt. */
export const GeminiKeyPanel: React.FC<Props> = ({ onChange }) => {
  const [key, setKey] = useState(getStoredKey);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(() => (getStoredKey() ? isKeyRemembered() : true));
  const [models, setModels] = useState<GeminiModel[]>(getStoredModelList);
  const [model, setModel] = useState(getStoredModel);
  const [probing, setProbing] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(() =>
    getStoredModelList().length ? { ok: true, text: `Khóa đã kiểm tra – ${getStoredModelList().length} mô hình dùng được.` } : null,
  );

  const updateKey = (v: string, rem = remember) => {
    setKey(v);
    setStoredKey(v, rem);
    setStatus(null);
    onChange?.(!!v.trim());
  };

  const probe = async () => {
    if (!key.trim()) {
      setStatus({ ok: false, text: 'Hãy dán khóa API trước.' });
      return;
    }
    setProbing(true);
    setStatus(null);
    try {
      const list = await probeModels(key, remember);
      setModels(list);
      if (model !== 'auto' && !list.some(m => m.id === model)) {
        setModel('auto');
        setStoredModel('auto');
      }
      setStatus(
        list.length
          ? { ok: true, text: `Khóa hợp lệ – ${list.length} mô hình dùng được. "Tự động" sẽ dùng ${list[0].id}.` }
          : { ok: false, text: 'Khóa hợp lệ nhưng không có mô hình tạo văn bản nào dùng được.' },
      );
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error && !/Failed to fetch/.test(err.message) ? err.message : 'Không kết nối được Google Gemini. Kiểm tra mạng rồi bấm Dò lại.' });
    } finally {
      setProbing(false);
    }
  };

  const btn = 'px-3.5 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2" data-testid="gemini-key-panel">
      <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
        <span aria-hidden>🔑</span> Khóa API Google Gemini
      </div>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={key}
          onChange={e => updateKey(e.target.value)}
          placeholder="Dán khóa API"
          autoComplete="off"
          spellCheck={false}
          aria-label="Khóa API Google Gemini"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
        />
        <button type="button" onClick={() => setShow(s => !s)} className={btn}>
          {show ? 'Ẩn' : 'Hiện'}
        </button>
        <button
          type="button"
          onClick={() => {
            clearStoredKey();
            setKey('');
            setModels([]);
            setStatus(null);
            onChange?.(false);
          }}
          className={btn}
        >
          Xóa
        </button>
      </div>
      <div className="text-xs text-slate-500 flex flex-wrap justify-between gap-2">
        <span>
          Lấy khóa tại{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
            aistudio.google.com → Get API key
          </a>
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => {
              setRemember(e.target.checked);
              updateKey(key, e.target.checked);
            }}
          />
          Ghi nhớ trên máy này
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <select
          value={model}
          onChange={e => {
            setModel(e.target.value);
            setStoredModel(e.target.value);
          }}
          aria-label="Mô hình Gemini"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="auto">Tự động chọn mô hình</option>
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={probe} disabled={probing} className={`${btn} flex items-center gap-1.5 disabled:opacity-60`}>
          {probing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Dò
        </button>
      </div>
      {status ? (
        <p className={`text-xs flex items-start gap-1.5 ${status.ok ? 'text-emerald-700' : 'text-rose-700'}`} data-testid="gemini-status">
          {status.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {status.text}
        </p>
      ) : (
        <p className="text-xs text-slate-500">Dán khóa API rồi bấm “Dò” để kiểm tra mô hình.</p>
      )}
      <p className="text-[11px] text-slate-400">
        Khóa Gemini chỉ nằm trong trình duyệt, không được lưu vào dữ liệu của tổ hoặc gửi về máy chủ phần mềm. Máy dùng chung: bỏ chọn "Ghi nhớ trên máy này" (khóa tự xóa khi đóng trình duyệt); khi đăng xuất khóa cũng được xóa.
      </p>
    </div>
  );
};
