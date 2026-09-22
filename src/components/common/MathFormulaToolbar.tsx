import React, { useState } from 'react';
import { MathText } from '../../utils/katex-renderer';
import { Sparkles, HelpCircle } from 'lucide-react';

interface MathFormulaToolbarProps {
  onInsert: (latexSnippet: string) => void;
  compact?: boolean;
}

interface FormulaItem {
  label: string;
  latex: string;
  display: string;
  category: 'algebra' | 'calculus' | 'geometry' | 'sets_logic' | 'greek';
}

const FORMULA_PRESETS: FormulaItem[] = [
  // Đại số & cơ bản
  { label: 'Phân số', latex: '\\frac{a}{b}', display: '\\frac{a}{b}', category: 'algebra' },
  { label: 'Căn bậc hai', latex: '\\sqrt{x}', display: '\\sqrt{x}', category: 'algebra' },
  { label: 'Căn bậc n', latex: '\\sqrt[n]{x}', display: '\\sqrt[n]{x}', category: 'algebra' },
  { label: 'Số mũ', latex: 'x^{2}', display: 'x^{2}', category: 'algebra' },
  { label: 'Chỉ số dưới', latex: 'x_{1}', display: 'x_{1}', category: 'algebra' },
  { label: 'Hệ phương trình', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}', display: '\\begin{cases} x \\\\ y \\end{cases}', category: 'algebra' },
  { label: 'Cộng trừ', latex: '\\pm', display: '\\pm', category: 'algebra' },
  { label: 'Nhân', latex: '\\times', display: '\\times', category: 'algebra' },
  { label: 'Khác', latex: '\\ne', display: '\\ne', category: 'algebra' },
  { label: 'Lớn hơn bằng', latex: '\\ge', display: '\\ge', category: 'algebra' },
  { label: 'Nhỏ hơn bằng', latex: '\\le', display: '\\le', category: 'algebra' },

  // Giải tích
  { label: 'Đạo hàm', latex: "f'(x)", display: "f'(x)", category: 'calculus' },
  { label: 'Đạo hàm cấp 2', latex: "f''(x)", display: "f''(x)", category: 'calculus' },
  { label: 'Giới hạn', latex: '\\lim_{x \\to x_0} f(x)', display: '\\lim_{x \\to x_0}', category: 'calculus' },
  { label: 'Tích phân xác định', latex: '\\int_{a}^{b} f(x)\\,dx', display: '\\int_{a}^{b}', category: 'calculus' },
  { label: 'Nguyên hàm', latex: '\\int f(x)\\,dx', display: '\\int', category: 'calculus' },
  { label: 'Vô cực', latex: '+\\infty', display: '+\\infty', category: 'calculus' },
  { label: 'Âm vô cực', latex: '-\\infty', display: '-\\infty', category: 'calculus' },
  { label: 'Tổng sigma', latex: '\\sum_{i=1}^{n} a_i', display: '\\sum_{i=1}^{n}', category: 'calculus' },

  // Hình học & Vector & Tọa độ Oxyz
  { label: 'Vector u', latex: '\\vec{u}', display: '\\vec{u}', category: 'geometry' },
  { label: 'Vector AB', latex: '\\overrightarrow{AB}', display: '\\overrightarrow{AB}', category: 'geometry' },
  { label: 'Góc', latex: '\\widehat{ABC}', display: '\\widehat{A}', category: 'geometry' },
  { label: 'Vuông góc', latex: '\\perp', display: '\\perp', category: 'geometry' },
  { label: 'Song song', latex: '\\parallel', display: '\\parallel', category: 'geometry' },
  { label: 'Tam giác', latex: '\\Delta ABC', display: '\\Delta', category: 'geometry' },
  { label: 'Độ dài đoạn thẳng', latex: '|\\vec{u}|', display: '|\\vec{u}|', category: 'geometry' },
  { label: 'Tọa độ Oxyz', latex: 'M(x; y; z)', display: '(x;y;z)', category: 'geometry' },

  // Tập hợp & Logic
  { label: 'Thuộc', latex: '\\in', display: '\\in', category: 'sets_logic' },
  { label: 'Không thuộc', latex: '\\notin', display: '\\notin', category: 'sets_logic' },
  { label: 'Tập con', latex: '\\subset', display: '\\subset', category: 'sets_logic' },
  { label: 'Hợp', latex: '\\cup', display: '\\cup', category: 'sets_logic' },
  { label: 'Giao', latex: '\\cap', display: '\\cap', category: 'sets_logic' },
  { label: 'Tập rỗng', latex: '\\emptyset', display: '\\emptyset', category: 'sets_logic' },
  { label: 'Tập số thực R', latex: '\\mathbb{R}', display: '\\mathbb{R}', category: 'sets_logic' },
  { label: 'Tập số nguyên Z', latex: '\\mathbb{Z}', display: '\\mathbb{Z}', category: 'sets_logic' },
  { label: 'Tập số tự nhiên N', latex: '\\mathbb{N}', display: '\\mathbb{N}', category: 'sets_logic' },
  { label: 'Với mọi', latex: '\\forall', display: '\\forall', category: 'sets_logic' },
  { label: 'Tồn tại', latex: '\\exists', display: '\\exists', category: 'sets_logic' },
  { label: 'Suy ra', latex: '\\Rightarrow', display: '\\Rightarrow', category: 'sets_logic' },
  { label: 'Tương đương', latex: '\\Leftrightarrow', display: '\\Leftrightarrow', category: 'sets_logic' },

  // Ký tự Hy Lạp
  { label: 'alpha', latex: '\\alpha', display: '\\alpha', category: 'greek' },
  { label: 'beta', latex: '\\beta', display: '\\beta', category: 'greek' },
  { label: 'gamma', latex: '\\gamma', display: '\\gamma', category: 'greek' },
  { label: 'delta', latex: '\\delta', display: '\\delta', category: 'greek' },
  { label: 'pi', latex: '\\pi', display: '\\pi', category: 'greek' },
  { label: 'theta', latex: '\\theta', display: '\\theta', category: 'greek' },
  { label: 'omega', latex: '\\omega', display: '\\omega', category: 'greek' },
];

export const MathFormulaToolbar: React.FC<MathFormulaToolbarProps> = ({ onInsert, compact = false }) => {
  const [activeCategory, setActiveCategory] = useState<FormulaItem['category'] | 'all'>('algebra');

  const categories = [
    { id: 'algebra', label: 'Đại số & Phương trình' },
    { id: 'calculus', label: 'Giải tích & Đạo hàm' },
    { id: 'geometry', label: 'Hình học & Vector Oxyz' },
    { id: 'sets_logic', label: 'Tập hợp & Logic' },
    { id: 'greek', label: 'Ký tự Hy Lạp' },
  ] as const;

  const displayedItems = FORMULA_PRESETS.filter(
    item => activeCategory === 'all' || item.category === activeCategory
  );

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs space-y-2 select-none shadow-2xs">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {categories.map(cat => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Bấm để chèn công thức nhanh</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {displayedItems.map((item, idx) => (
          <button
            type="button"
            key={idx}
            onClick={() => onInsert(`$${item.latex}$`)}
            title={`${item.label} (chèn $${item.latex}$)`}
            className="px-2 py-1 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded text-slate-800 transition-all flex items-center justify-center min-w-[36px] shadow-2xs group"
          >
            <MathText content={`$${item.display}$`} className="text-xs group-hover:scale-105 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  );
};
