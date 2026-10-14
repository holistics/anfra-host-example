import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** A small table inside an opened row, with a caption; it scrolls sideways within its box. */
export function MiniTable({
  caption,
  head,
  rows,
}: {
  caption: ReactNode;
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div>
      <div className="mb-0.5 px-1 text-xs text-muted-foreground">{caption}</div>
      <div className="rounded-md border bg-background">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {head.map((label) => (
                <TableHead key={label} className="h-7 text-muted-foreground">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                {row.cells.map((cell, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                  <TableCell key={i} className="px-2 py-1 align-top whitespace-normal">
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
