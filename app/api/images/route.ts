import {
  bucket,
  sameOrigin,
  failure,
  headers,
  workspaceOwner,
  accountDeleting,
  accountDeletionResponse,
} from "@/lib/server";
import { readLimitedBody, RequestBodyTooLarge } from "@/lib/request-body";
export async function POST(r: Request) {
  if (!sameOrigin(r)) return new Response(null, { status: 403 });
  const resolved = await workspaceOwner(r);
  if (!resolved || (!resolved.authenticated && !resolved.visitorId))
    return new Response(null, { status: 401 });
  const owner = resolved.id;
  try {
    if (await accountDeleting(owner)) return accountDeletionResponse();
    const multipart = await readLimitedBody(r, 5 * 1024 * 1024 + 65536);
    let form: FormData;
    try {
      form = await new Response(multipart, { headers: { "Content-Type": r.headers.get("content-type") || "" } }).formData();
    } catch {
      return Response.json({ error: "Choose a JPEG, PNG or WebP image." }, { status: 400 });
    }
    const file = form.get("image");
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
    const storage = bucket();
    await storage.put(`${owner}/${id}`, bytes, {
      httpMetadata: { contentType: type },
    });
    // A deletion may have started while reading the multipart upload or R2 PUT.
    if (await accountDeleting(owner)) {
      await storage.delete(`${owner}/${id}`);
      return accountDeletionResponse();
    }
    return Response.json({ url: `/api/images/${id}` }, { headers: headers() });
  } catch (e) {
    if (e instanceof RequestBodyTooLarge)
      return Response.json({ error: "Use an image smaller than 5 MB." }, { status: 413 });
    return failure(e);
  }
}
