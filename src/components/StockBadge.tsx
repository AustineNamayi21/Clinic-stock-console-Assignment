import type { CSSProperties } from 'react';
import { stockLevel, STOCK_LABELS, type StockLevel } from '../lib/stockLevel';

const NUMBER_STYLES: Record<StockLevel, string> = {
  out: 'text-red',
  low: 'text-amber',
  ok: 'text-ink',
};

const LABEL_STYLES: Record<StockLevel, string> = {
  out: 'text-red',
  low: 'text-amber',
  ok: 'text-slate',
};

/** The vial fills to the count, capped here, with a tick at the low threshold. */
const VIAL_CAPACITY = 100;

/**
 * A small vial filled to the current count. Decorative: the number and the
 * status word next to it carry the information, so it is hidden from
 * assistive technology.
 */
export function StockVial({
  stock,
  size = 'md',
  index = 0,
}: {
  stock: number;
  size?: 'md' | 'lg';
  /** Position in a list, used to stagger the fill animation. */
  index?: number;
}) {
  const level = stockLevel(stock);
  const fill = Math.min(stock, VIAL_CAPACITY) / VIAL_CAPACITY;
  const style = { '--fill': fill, '--i': index } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      data-level={level}
      className={`vial block shrink-0 ${size === 'lg' ? 'h-20 w-6' : 'h-9 w-3'}`}
    >
      <span className="vial-fill" style={style} />
      <span className="vial-tick" />
    </span>
  );
}

/**
 * Stock level, shown as the most legible element in any row or card.
 * Status is signalled three ways - colour, the accompanying word and the
 * vial - so it never depends on colour perception alone.
 */
export function StockFigure({
  stock,
  size = 'md',
  index,
}: {
  stock: number;
  size?: 'md' | 'lg';
  index?: number;
}) {
  const level = stockLevel(stock);
  const large = size === 'lg';

  return (
    <div className={`flex items-center ${large ? 'gap-4' : 'gap-3'}`}>
      <div className="flex flex-col items-end">
        <span
          className={`stock-figure leading-none font-bold ${NUMBER_STYLES[level]} ${
            large ? 'text-5xl sm:text-6xl' : 'text-2xl'
          }`}
        >
          {/* Keyed by value so a corrected count animates into place. */}
          <span key={stock} className={large ? 'count-change' : undefined}>
            {stock}
          </span>
        </span>
        <span
          className={`mt-1 font-semibold whitespace-nowrap ${LABEL_STYLES[level]} ${
            large ? 'text-sm' : 'text-xs'
          }`}
        >
          {STOCK_LABELS[level]}
        </span>
      </div>
      <StockVial stock={stock} size={size} index={index} />
    </div>
  );
}
