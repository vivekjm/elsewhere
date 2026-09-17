import { bucket, guest, failure } from "@/lib/server";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = guest(r),
    { id } = await params;
  if (!owner || !/^([a-f0-9-]{36})$/.test(id))
    return new Response(null, { status: 404 });
  try {
    const object = await bucket().get(`${owner}/${id}`);
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
