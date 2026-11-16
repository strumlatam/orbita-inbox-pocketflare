/// <reference path="../pb_data/types.d.ts" />

// Receptor universal: ANY /in/{source} grava tudo cru na collection `events`.
// Responde 200 mesmo quando o evento já existe (dedupe), para o remetente não reenviar.

// Handlers do JSVM rodam isolados: nada do escopo do arquivo é visível dentro deles.
for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
  routerAdd(method, "/in/{source}", (e) => {
    const MAX_BODY = 1000000; // 1 MB gravado; acima disso trunca
    const DEDUPE_HEADERS = ["svix-id", "webhook-id", "x-request-id", "x-github-delivery", "idempotency-key"];
    const token = $os.getenv("INBOX_TOKEN");
    if (token) {
      const given = e.request.url.query().get("k") || e.request.header.get("x-inbox-token");
      if (given !== token) {
        return e.json(401, { ok: false });
      }
    }

    const source = e.request.pathValue("source");
    const raw = toString(e.request.body);
    const truncated = raw.length > MAX_BODY;

    // http.Header não é enumerável no JSVM; requestInfo().headers vem em minúsculas e com "_" no lugar de "-".
    const headers = {};
    try {
      const info = e.requestInfo().headers;
      for (const name of Object.keys(info)) {
        headers[name.replace(/_/g, "-")] = info[name];
      }
    } catch (err) {
      headers["content-type"] = e.request.header.get("content-type") || "";
    }
    delete headers["x-inbox-token"];

    let dedupe = "";
    for (const h of DEDUPE_HEADERS) {
      if (headers[h]) { dedupe = String(headers[h]); break; }
    }

    // não grava o token na query
    const q = e.request.url.query();
    q.del("k");

    if (dedupe) {
      let existing = null;
      try {
        existing = $app.findFirstRecordByFilter("events", "source = {:s} && dedupe_key = {:d}", { s: source, d: dedupe });
      } catch (_) {}
      if (existing) {
        return e.json(200, { ok: true, duplicate: true });
      }
    }

    const record = new Record($app.findCollectionByNameOrId("events"));
    record.set("source", source);
    record.set("method", e.request.method);
    record.set("path", e.request.url.path);
    record.set("query", q.encode());
    record.set("headers", headers);
    record.set("body", truncated ? raw.slice(0, MAX_BODY) : raw);
    record.set("content_type", e.request.header.get("content-type") || "");
    record.set("ip", e.realIP());
    record.set("dedupe_key", dedupe);
    record.set("truncated", truncated);

    try {
      $app.save(record);
    } catch (err) {
      // corrida entre dois envios simultâneos do mesmo id: o índice único barra o segundo
      if (dedupe) {
        return e.json(200, { ok: true, duplicate: true });
      }
      $app.logger().error("inbox save failed", "source", source, "error", String(err));
      return e.json(500, { ok: false });
    }
    return e.json(200, { ok: true, id: record.id });
  }, $apis.bodyLimit(0));
}
