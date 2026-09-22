import React from 'react';
import { FileCheck2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ExamCreatorModule: React.FC = () => {
  const { exams, examBlueprints } = useApp();
  return <section className="p-6"><h1 className="text-2xl font-bold flex gap-2"><FileCheck2 />Tạo đề kiểm tra</h1><p className="mt-3 text-slate-600">{examBlueprints.length} ma trận, {exams.length} đề kiểm tra đã lưu.</p></section>;
};
