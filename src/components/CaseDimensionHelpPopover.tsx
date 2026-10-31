import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

interface CaseDimensionHelpPopoverProps {
  className?: string;
}

const DIMENSION_GUIDE_ITEMS = [
  {
    tag: '主体姿态',
    summary: '提取朝向、摆放及组合关系（不继承竞品外形）',
    desc: '仅提取案例中商品的镜头朝向、开合摆放与主副件组合关系；绝不继承竞品身份与外观轮廓，产品身份 100% 以自有 #Prod 为准。',
  },
  {
    tag: '环境背景',
    summary: '提取场景类型、材质与造型语言（具体布景重设计）',
    desc: '仅提取案例的空间场景类型、材质肌理与几何造型语言，围绕我方产品重新设计具体布景；不照搬竞品具体道具、公仔或背板原物。',
  },
  {
    tag: '版式骨架',
    summary: '提取信息分区、主次、图文占比和留白规律',
    desc: '仅提取画面的信息分区逻辑、视觉主次层级、图文面积占比与呼吸感留白规律；不机械复制竞品的元素坐标或完整构图。',
  },
  {
    tag: '文案版式',
    summary: '提取字体性格、字号层级、对齐和间距（不提文字内容）',
    desc: '仅提取主副标题的字体性格、字号粗细层级、对齐方式、行距及卖点容器排版形式；绝不提取或保留案例图中的字面文字内容。',
  },
  {
    tag: '文案内容',
    summary: '提取卖点主题和表达结构（依据自有资料重写）',
    desc: '提取案例的卖点切入主题与修辞表达结构，严格依据我方产品资料与指定文案重写；用户指定文案最高优先，绝不移植竞品参数与承诺。',
  },
  {
    tag: '光影色调',
    summary: '提取光向、软硬、反差及色彩关系（不继承场景物件）',
    desc: '仅提取主辅光方向、光质软硬、明暗反差比及全局冷暖色彩搭配关系；绝不顺带继承案例中的具体场景物件或装饰道具。',
  },
];

export const CaseDimensionHelpPopover: React.FC<
  CaseDimensionHelpPopoverProps
> = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 380;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < 12) left = 12;
    if (left + popoverWidth > viewportW - 12) {
      left = Math.max(12, viewportW - popoverWidth - 12);
    }

    let top = rect.bottom + 8;
    const estimatedHeight = 490;
    if (top + estimatedHeight > viewportH - 12 && rect.top > estimatedHeight) {
      top = rect.top - estimatedHeight - 8;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        title="点击查看「对标案例图 (#Case)」六维分析提取规则与锁底换款说明"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer shrink-0 ${
          open ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200' : ''
        } ${className}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </span>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: coords.top, left: coords.left, width: 380 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[9999] bg-white border border-slate-200/90 rounded-xl shadow-xl p-3.5 text-left space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>对标案例图 (#Case) · 六维分析提取规则</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  六个标签仅控制分析阶段的信息提取范围：选中=允许提取该维度，未选中=不从该案例提取该维度（不代表锁定不变）；全选也不等于照搬整图。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {DIMENSION_GUIDE_ITEMS.map((item) => (
                <div
                  key={item.tag}
                  className="p-2 rounded-lg bg-slate-50/80 border border-slate-200/60 space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 rounded shrink-0">
                      {item.tag}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 truncate">
                      {item.summary}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed space-y-0.5">
              <div>
                🔒 <strong className="text-slate-700">锁底换款（独立显式模式）</strong>：仅当开启「锁底换款」时，才将对应案例原图传入生图模型并 100% 锁定背景、构图与版式（仅替换 #Prod 产品主体）。
              </div>
              <div>
                ⚡ <strong className="text-slate-700">+约束（独立规则）</strong>：点击「+约束」输入的指令作为独立强规则注入分析与生图阶段（如：<span className="text-slate-700">“去掉图中的人手和手机”</span>）。
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
