import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" style={{ animationDuration: "0.3s" }} />
        <p className="text-sm text-muted mt-3 font-medium">Loading invoicing...</p>
      </div>
    </div>
  );
}
