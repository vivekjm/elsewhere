import {
  bucket,
  sameOrigin,
  failure,
  headers,
  workspaceOwner,
} from "@/lib/server";
export async function POST(r: Request) {
  if (!sameOrigin(r)) return new Response(null, { status: 403 });
  const resolved = await workspaceOwner(r);
  if (!resolved || (!resolved.authenticated && !resolved.visitorId))
    return new Response(null, { status: 401 });
  const owner = resolved.id;
  try {
    if (Number(r.headers.get("content-length")) > 5 * 1024 * 1024 + 10000)
      return Response.json(
        { error: "Use an image smaller than 5 MB." },
        { status: 413 },
      );
    const form = await r.formData(),
      file = form.get("image");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
      return Response.json(
        { error: "Use an image smaller than 5 MB." },
        { status: 400 },
      );
    const bytes = await file.arrayBuffer(),
      b = new Uint8Array(bytes);
    const type =
      b[0] === 255 && b[1] === 216
        ? "image/jpeg"
        : b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
          ? "image/png"
          : String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...b.slice(8, 12)) === "WEBP"
            ? "image/webp"
            : null;
    if (!type)
      return Response.json(
        { error: "Choose a JPEG, PNG or WebP image." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await bucket().put(`${owner}/${id}`, bytes, {
      httpMetadata: { contentType: type },
    });
    return Response.json({ url: `/api/images/${id}` }, { headers: headers() });
  } catch (e) {
    return failure(e);
  }
}
