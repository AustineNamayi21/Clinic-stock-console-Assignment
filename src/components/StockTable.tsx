import { Link } from 'react-router-dom';
import type { Product } from '../api/types';
import { StockFigure } from './StockBadge';

export function StockTable({ products }: { products: Product[] }) {
  return (
    <div className="fade-in">
      {/* Table layout from the sm breakpoint up */}
      <table className="hidden w-full border-collapse text-left sm:table">
        <thead>
          <tr className="border-b border-line text-xs text-slate">
            <th scope="col" className="pb-2 font-medium">
              Item
            </th>
            <th scope="col" className="pb-2 font-medium">
              Category
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Stock
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              className="border-b border-line last:border-0 hover:bg-surface"
            >
              <td className="py-3 pr-4">
                <Link
                  to={`/items/${p.id}`}
                  className="font-medium text-ink underline-offset-2 hover:text-teal hover:underline"
                >
                  {p.title}
                </Link>
                {p.brand && <span className="block text-xs text-slate">{p.brand}</span>}
              </td>
              <td className="py-3 pr-4 text-sm text-slate">{p.category}</td>
              <td className="py-3 text-right">
                <div className="flex justify-end">
                  <StockFigure stock={p.stock} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stacked cards below sm - avoids horizontal scroll at 360px */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              to={`/items/${p.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-teal"
            >
              <div className="min-w-0">
                <span className="block font-medium text-ink">{p.title}</span>
                <span className="block text-xs text-slate">{p.category}</span>
              </div>
              <StockFigure stock={p.stock} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
