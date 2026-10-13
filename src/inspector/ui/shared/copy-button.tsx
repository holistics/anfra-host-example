import { Check, Copy } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Copy text, reporting whether the clipboard took it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A small button that copies `text`, and says so for a moment. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const onClick = async (event: MouseEvent) => {
    event.stopPropagation();
    setCopied(await copyText(text));
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('size-6 text-muted-foreground', className)}
      title={copied ? 'Copied' : `${label}: ${text}`}
      aria-label={copied ? 'Copied' : label}
      onClick={onClick}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
