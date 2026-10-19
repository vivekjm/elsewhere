/** Lets iOS open https://tripsloom.com/t/<code> links in the app (universal links). */
export function GET() {
  return Response.json({
    applinks: { details: [{ appIDs: ["MQSHWS846N.com.tripsloom.ios"], components: [{ "/": "/t/*", comment: "Shared trip invites" }, { "/": "/r/*", comment: "Trip plans to copy" }] }] },
  });
}
