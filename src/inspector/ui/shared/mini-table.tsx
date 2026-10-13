import type { ReactNode } from 'react';

/** A small table inside an opened row, with a caption; it scrolls sideways within its box. */
export function MiniTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div>
      <p className="mb-0.5 px-1 text-xs text-muted-foreground">{caption}</p>
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              {head.map((label) => (
                <th key={label} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                {row.cells.map((cell, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                  <td key={i} className="px-2 py-1 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
