/**
 * Fake CDP Core Service Binding for Landing loyalty check testing.
 */
export class FakeCdp {
  constructor(responder) {
    this.responder = responder;
    this.calls = [];
  }

  async fetch(urlOrReq, init = {}) {
    const url = new URL(typeof urlOrReq === "string" ? urlOrReq : urlOrReq.url);
    let parsedBody = init.body;
    if (typeof init.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    const callRecord = {
      url,
      path: url.pathname,
      method: (init.method || "GET").toUpperCase(),
      headers: init.headers,
      body: parsedBody,
    };
    this.calls.push(callRecord);

    const res = await this.responder(callRecord);
    if (res instanceof Response) return res;

    const status = res.status ?? 200;
    const bodyStr = typeof res.body === "string" ? res.body : JSON.stringify(res.body ?? res);
    return new Response(bodyStr, {
      status,
      headers: { "content-type": "application/json", ...(res.headers || {}) },
    });
  }
}
