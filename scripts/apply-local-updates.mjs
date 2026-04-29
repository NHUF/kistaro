// Update migrations are intentionally separated from db:setup.
// db:setup is destructive and only belongs to fresh installs/resets.
// Future schema changes should be added here as safe, idempotent migrations.
console.log("Keine lokalen Update-Migrationen erforderlich.");
