/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const events = new Collection({
    type: "base",
    name: "events",
    // sem regras = só superuser (painel/API admin)
    fields: [
      { type: "text", name: "source", required: true, max: 200 },
      { type: "text", name: "method", max: 16 },
      { type: "text", name: "path", max: 2000 },
      { type: "text", name: "query", max: 10000 },
      { type: "json", name: "headers", maxSize: 200000 },
      { type: "text", name: "body", max: 1100000 },
      { type: "text", name: "content_type", max: 500 },
      { type: "text", name: "ip", max: 100 },
      { type: "text", name: "dedupe_key", max: 500 },
      { type: "bool", name: "truncated" },
      { type: "autodate", name: "received_at", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE INDEX idx_events_source_received ON events (source, received_at)",
      "CREATE UNIQUE INDEX idx_events_dedupe ON events (source, dedupe_key) WHERE dedupe_key != ''",
    ],
  });
  app.save(events);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("events"));
});
