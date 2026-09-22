import React from 'react';
import { FolderOpen } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DocumentsModule: React.FC = () => {
  const { documents } = useApp();
  return <section className="p-6"><h1 className="text-2xl font-bold flex gap-2"><FolderOpen />Tài liệu dùng chung</h1><p className="mt-3 text-slate-600">Có {documents.length} tài liệu trong kho.</p></section>;
};
