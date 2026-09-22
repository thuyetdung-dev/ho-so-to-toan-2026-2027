import React from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AnalyticsModule: React.FC = () => {
  const { examResults } = useApp();
  return <section className="p-6"><h1 className="text-2xl font-bold flex gap-2"><ChartNoAxesCombined />Phân tích kết quả</h1><p className="mt-3 text-slate-600">Có {examResults.length} bảng kết quả để phân tích.</p></section>;
};
