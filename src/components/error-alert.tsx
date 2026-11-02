import { CircleAlert } from 'lucide-react';

/** The page's own failure, as a danger alert. */
export function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mx-auto grid max-w-lg grid-cols-[auto_1fr] gap-x-2 rounded-xl border border-danger-default bg-danger-secondary-default px-2.5 py-2 text-body text-default"
    >
      <CircleAlert className="size-4 translate-y-0.5 icon-danger-default" />
      <p className="text-pretty text-weak">{children}</p>
    </div>
  );
}
