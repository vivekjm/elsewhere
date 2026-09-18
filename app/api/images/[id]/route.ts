import { bucket, failure, workspaceOwner } from "@/lib/server";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await workspaceOwner(r),
    { id } = await params;
  if (
    !resolved ||
    (!resolved.authenticated && !resolved.visitorId) ||
    !/^([a-f0-9-]{36})$/.test(id)
  )
    return new Response(null, { status: 404 });
  try {
    const object = await bucket().get(`${resolved.id}/${id}`);
    if (!object) return new Response(null, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
