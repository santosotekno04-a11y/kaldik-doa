'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T = any> {
  columns: Column<any>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  idField?: string;
  pageSize?: number;
  compact?: boolean;
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, loading, emptyMessage = 'Tidak ada data',
  onRowClick, selectedIds, onSelectionChange, idField = 'id', pageSize = 20, compact = false, rowClassName
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / pageSize);
  const pagedData = data.slice(page * pageSize, (page + 1) * pageSize);

  const allSelected = pagedData.length > 0 && pagedData.every(r => selectedIds?.includes(String(r[idField])));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedIds?.filter(id => !pagedData.some(r => String(r[idField]) === id)) || []);
    } else {
      const newIds = [...(selectedIds || [])];
      pagedData.forEach(r => {
        const id = String(r[idField]);
        if (!newIds.includes(id)) newIds.push(id);
      });
      onSelectionChange(newIds);
    }
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds?.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...(selectedIds || []), id]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 border-t border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {onSelectionChange && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'text-xs font-semibold text-gray-500 uppercase tracking-wider',
                    compact ? 'px-3 py-2' : 'px-4 py-3',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.align === 'left' && 'text-left',
                    !col.align && 'text-left'
                  )}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedData.map((row, idx) => {
                const id = String(row[idField]);
                const isSelected = selectedIds?.includes(id);
                return (
                  <tr
                    key={id || idx}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-indigo-50/50',
                      isSelected && 'bg-indigo-50/30',
                      rowClassName?.(row)
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {onSelectionChange && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={cn(
                          'text-sm text-gray-700',
                          compact ? 'px-3 py-2' : 'px-4 py-3',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                      >
                        {col.render ? col.render(row) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} dari {data.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
              <ChevronsLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-xs text-gray-600">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
