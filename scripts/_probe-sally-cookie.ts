// Test if Abe's active Sally session cookie still works by hitting the
// status endpoint we saw cached on his box.
const url = "http://api.lamlinks.com/api/llsm/status/WKUzMbAB5K2Ok7TlTS1llbgN76og";
const cookie = "lamlinksApiSession=3le2e2k3e0p38uttjj9qatqraa";

(async () => {
  const r = await fetch(url, {
    headers: { "Cookie": cookie, "User-Agent": "DIBS/1.0" },
  });
  console.log("status:", r.status);
  console.log("content-type:", r.headers.get("content-type"));
  console.log("set-cookie:", r.headers.get("set-cookie"));
  const body = await r.text();
  console.log("body:\n" + body.slice(0, 2000));
})();
