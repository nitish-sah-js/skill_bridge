import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";

/** Shown only when the deployment is missing its Supabase settings. */
export function ConfigNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <Alert className="mb-6">
      <AlertTitle>Database not connected</AlertTitle>
      <AlertDescription>
        Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see README) to enable accounts.
      </AlertDescription>
    </Alert>
  );
}
