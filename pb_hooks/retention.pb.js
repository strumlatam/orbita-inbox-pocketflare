/// <reference path="../pb_data/types.d.ts" />

// Apaga eventos mais antigos que INBOX_RETENTION_DAYS (padrão 90; 0 = sem limite).
cronAdd("inbox-retention", "0 3 * * *", () => {
  const days = parseInt($os.getenv("INBOX_RETENTION_DAYS") || "90", 10);
  if (!days || days <= 0) return;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().replace("T", " ");
  $app.db().newQuery("DELETE FROM events WHERE received_at < {:cutoff}").bind({ cutoff }).execute();
});
