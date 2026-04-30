# Kistaro

Kistaro - dein lokales Inventarsystem - Ordnung für alles, was zählt.

Kistaro ist eine lokale Inventar- und Organisations-App auf Basis von Next.js, React, PostgreSQL und Dateisystem-Storage.

## Funktionen

- Hierarchische Locations mit Typ, Wert, Tags, Bildern und Detailseiten
- Items mit Status, Wert, Kaufdatum, Tags, Bildern, Dokumenten und Verknüpfungen
- Vorlagen für Items und Locations mit automatischer `-0000` / `0001`-Namenslogik
- Globale Suche über Locations, Items, Tags und Status
- Aktivitäts-Log für Änderungen
- Einfacher Geräte-Passwortschutz ohne Benutzerkonten
- Systemseite mit Status, Passwortwechsel, Backup, Restore und Updates

## Schnellinstallation

Für eine frische Debian-12-VM als `root`:

```bash
apt-get update -qq && apt-get install -y -qq ca-certificates curl tar sed && LATEST_TAG="$(curl -fsSL https://api.github.com/repos/NHUF/kistaro/releases/latest | sed -n 's/.*"tag_name": "\(.*\)".*/\1/p' | head -n1)" && test -n "$LATEST_TAG" && rm -rf /opt/kistaro && mkdir -p /opt/kistaro && curl -fsSL "https://github.com/NHUF/kistaro/archive/refs/tags/${LATEST_TAG}.tar.gz" | tar -xz -C /opt/kistaro --strip-components=1 && cd /opt/kistaro && bash ./deploy/proxmox/install-instance.sh
```

Der Installer fragt direkt am Anfang ein Passwort ab, bevor Updates oder Downloads starten. Dieses Passwort wird für die App-Freigabe und die lokale PostgreSQL-Datenbank verwendet. Die Standard-URL wird automatisch aus der ersten System-IP gebildet, zum Beispiel `http://192.168.5.229:3000`.

Während der Installation zeigt das Skript nur Fortschritt, den aktuellen Schritt und Fehler an. Ausführliche Details landen in `install.log`.

## Installation Aus Repository

Wenn das Repository bereits auf dem Zielsystem liegt:

```bash
bash ./deploy/proxmox/install-instance.sh
```

Das Skript erledigt:

- System-Update und Grundpakete
- Node.js und PostgreSQL
- automatische Instanz-Konfiguration
- `.env.local`
- Node-Abhängigkeiten
- leere lokale PostgreSQL-Datenbank ohne Demo-Daten und ohne Standard-Vorlagen
- Produktions-Build
- `systemd`-Service
- Start der App
- Zugangsdaten in `instance-summary.txt`

## Konfiguration

Der Installer erzeugt weiterhin `install-config.txt`, öffnet sie aber nicht mehr automatisch. Für die Erstinstallation wird sie vollständig befüllt.

Wichtige Werte:

```txt
APP_BASE_URL=http://<system-ip>:3000
APP_BIND_HOST=0.0.0.0
APP_PORT=3000
POSTGRES_DB=kistaro
POSTGRES_USER=kistaro
POSTGRES_PASSWORD=<terminal-passwort>
INVENTORY_APP_PASSWORD=<terminal-passwort>
INVENTORY_UPDATE_REPOSITORY=NHUF/kistaro
```

Spätere Anpassungen können direkt in `install-config.txt` oder `.env.local` erfolgen.

## Updates

Neue Versionen werden als GitHub Release veröffentlicht. Die Systemseite kann nach Updates suchen und diese installieren.

Konfiguration:

```txt
INVENTORY_UPDATE_REPOSITORY=NHUF/kistaro
INVENTORY_UPDATE_TOKEN=
INVENTORY_BACKUP_DIR=storage/backups
```

Der Update-Ablauf:

- Prüfen des neuesten GitHub Releases
- automatisches Datenbank-Backup
- Download und Synchronisation der neuen Version
- `.env.local`, `storage/`, `install-config.txt`, Logs und `node_modules` bleiben erhalten
- sichere lokale DB-Migrationen
- neuer Build
- Neustart des Dienstes

## Datenbank

Frische Installationen starten leer:

```bash
npm run db:setup
```

Dieser Befehl ist destruktiv und nur für Neuinstallation oder Reset gedacht.

Für bestehende Installationen:

```bash
npm run db:migrate
```

Dieser Befehl wendet nur sichere, idempotente Update-Migrationen an.

## Storage

Bilder, Dokumente und Backups liegen lokal unter:

```txt
storage/
```

Der Ordner wird nicht versioniert.

## Logo

Das Logo liegt unter:

```txt
public/kistaro-logo.png
```

Empfohlen ist ein quadratisches PNG mit transparentem Hintergrund, zum Beispiel `512x512`.

## Entwicklung

```bash
npm run dev
npm run build
npm run lint
```

## Wichtige Dateien

- `lib/db.ts`
- `lib/supabase.ts`
- `lib/local-data-server.ts`
- `lib/local-rpc-server.ts`
- `lib/local-file-storage.ts`
- `lib/system-backup.ts`
- `lib/system-updates.ts`
- `deploy/proxmox/install-instance.sh`
- `deploy/proxmox/update-instance.sh`

## Technischer Hinweis

Die UI nutzt vorübergehend weiterhin den Importnamen `supabase` aus `lib/supabase.ts`. Das ist kein echter Supabase-Client mehr, sondern ein lokaler Adapter. Dadurch bleiben bestehende Komponenten stabil, während Kistaro intern lokal mit PostgreSQL und Dateisystem arbeitet.
