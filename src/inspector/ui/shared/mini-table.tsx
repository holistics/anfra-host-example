import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** A small table inside an opened row, with a caption; it scrolls sideways within its box. */
export function MiniTable({
  caption,
  head,
  rows,
}: {
  caption?: ReactNode;
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div>
      {caption && <div className="mb-0.5 px-1 text-xs text-muted-foreground">{caption}</div>}
      <div className="rounded-md border bg-background">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {head.map((label, i) => (
                <TableHead
                  key={label}
                  className={cn(!label && i === 0 && 'w-6 pr-0', i === 1 && head[0] === '' && 'pl-1')}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                {row.cells.map((cell, i) => (
                  <TableCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                    key={i}
                    className={cn(
                      'align-top',
                      i === 0 && head[0] === '' && 'w-6 pr-0',
                      i === 1 && head[0] === '' && 'pl-1',
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
