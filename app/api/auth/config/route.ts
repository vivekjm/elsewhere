import { headers, supabaseConfig } from "@/lib/server";

/** The publishable key is safe for the browser; secrets never leave the Worker. */
export function GET() {
  const config = supabaseConfig();
  if (!config)
    return Response.json(
      { configured: false },
      { status: 503, headers: headers() },
    );
  return Response.json(
    { configured: true, url: config.url, publishableKey: config.key },
    { headers: headers() },
  );
}
