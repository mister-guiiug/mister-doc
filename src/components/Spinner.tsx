import { Loader2 } from 'lucide-react';

export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="size-8 animate-spin text-teal-600" />
        {label && <p className="text-sm">{label}</p>}
      </div>
    </div>
  );
}
