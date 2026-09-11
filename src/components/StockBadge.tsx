import { stockLevel, STOCK_LABELS, type StockLevel } from '../lib/stockLevel';

const STYLES: Record<StockLevel, string> = {
  out: 'text-red',
  low: 'text-amber',
  ok: 'text-ink',
};

/**
 * Stock level, shown as the most legible element in any row or card.
 * Status is signalled twice - by colour and by the accompanying word -
 * so it never depends on colour perception alone.
 */
export function StockFigure({
  stock,
  size = 'md',
}: {
  stock: number;
  size?: 'md' | 'lg';
}) {
  const level = stockLevel(stock);
  return (
    <div className="flex flex-col items-end">
      <span
        className={`stock-figure font-semibold ${STYLES[level]} ${
          size === 'lg' ? 'text-4xl' : 'text-xl'
        }`}
      >
        {stock}
      </span>
      <span className={`text-xs ${level === 'ok' ? 'text-slate' : STYLES[level]}`}>
        {STOCK_LABELS[level]}
      </span>
    </div>
  );
}
