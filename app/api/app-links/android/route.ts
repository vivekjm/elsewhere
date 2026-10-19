/**
 * Lets Android open https://tripsloom.com/t/<code> links in the app (App Links). The signing certificate
 * fingerprint comes from the deployment's environment (Play Console › App signing), so nothing is hard-coded.
 */
import { env } from "cloudflare:workers";

export function GET() {
  const fingerprints = String((env as unknown as Record<string, unknown>).ANDROID_CERT_SHA256 ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  return Response.json([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.tripsloom.app", sha256_cert_fingerprints: fingerprints } }]);
}
