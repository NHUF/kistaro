# Kistaro

Kistaro - dein lokales Inventarsystem - Ordnung für alles, was zählt.

Kistaro ist eine modulare Inventar- und Organisations-App auf Basis von Next.js, React, lokaler PostgreSQL-Datenbank und lokalem Dateispeicher.

Der aktuelle Stand deckt vor allem die Inventarisierung ab:
- hierarchische Locations
- Items mit Status, Tags, Bildern und Dokumenten
- Vorlagen
- globale Suche
- Aktivitäts-Log
- einfacher Geräte-Passwortschutz ohne Accounts
- Systemseite mit Status, Passwortwechsel, Backup, Restore und Updates

## Schnellinstallation

Für eine frische Debian-12-VM als `root`:

```bash
apt-get update -qq && apt-get install -y -qq ca-certificates curl tar && rm -rf /opt/kistaro && mkdir -p /opt/kistaro && curl -fsSL https://github.com/NHUF/kistaro/archive/refs/tags/v0.1.2.tar.gz | tar -xz -C /opt/kistaro --strip-components=1 && cd /opt/kistaro && bash ./deploy/proxmox/install-instance.sh
```

Das Skript erstellt beim ersten Lauf `install-config.txt`, öffnet sie in `nano` und setzt danach die Installation automatisch fort.

## Zielbild

Die App soll als geschlossene Instanz auf einem Proxmox-Server laufen:
- bevorzugt in einer Debian-12-VM
- mit lokaler PostgreSQL-Datenbank
- mit lokalem Dateispeicher für Bilder und Dokumente
- mit automatischem Start nach Reboot
- mit Updates über GitHub Releases
- mit einem einzigen Installationsbefehl

## Manuelle Installation aus vorhandenem Repository

Wenn das Repository bereits auf dem Zielsystem liegt:

```bash
bash ./deploy/proxmox/install-instance.sh
```

Das Skript erledigt:
- `apt-get update`
- `apt-get upgrade`
- Installation von Node.js
- Installation von PostgreSQL
- Erzeugung von `install-config.txt`
- Öffnen der Konfiguration in `nano`
- Schreiben von `.env.local`
- Installation der Node-Abhängigkeiten
- Anwendung des lokalen Datenbankschemas ohne Demo-Daten
- Produktions-Build
- Einrichtung eines `systemd`-Dienstes
- Start der App
- Ausgabe der Zugangsdaten in `instance-summary.txt`

Während der Installation zeigt das Skript nur den aktuellen Schritt, einen kleinen Fortschritt und `erledigt` an. Ausführliche Ausgaben werden in `install.log` geschrieben. Wenn ein Schritt fehlschlägt, zeigt der Installer automatisch die letzten relevanten Log-Zeilen.

## Konfiguration

Die Datei `install-config.txt` wird automatisch erzeugt und enthält unter anderem:

```txt
APP_BASE_URL=http://127.0.0.1:3000
APP_BIND_HOST=0.0.0.0
APP_PORT=3000
POSTGRES_DB=kistaro
POSTGRES_USER=kistaro
POSTGRES_PASSWORD=
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DATABASE_URL=
INVENTORY_STORAGE_DIR=storage
INVENTORY_APP_PASSWORD=
INVENTORY_APP_SECRET=auto
INVENTORY_UPDATE_REPOSITORY=NHUF/kistaro
INVENTORY_UPDATE_TOKEN=
INVENTORY_BACKUP_DIR=storage/backups
```

Mindestens prüfen oder ausfüllen:
- `APP_BASE_URL`: die spätere Browser-Adresse, zum Beispiel `http://192.168.5.229:3000`
- `INVENTORY_APP_PASSWORD`: das Passwort zum Freischalten neuer Geräte
- `POSTGRES_PASSWORD`: ein eigenes lokales Datenbank-Passwort
- `INVENTORY_UPDATE_REPOSITORY`: GitHub Repository im Format `owner/repo`

Wenn `DATABASE_URL` leer bleibt, wird sie aus den `POSTGRES_*`-Werten erzeugt. Für das öffentliche Kistaro-Repository bleibt `INVENTORY_UPDATE_TOKEN` leer.

## Lokale Datenbank

Das lokale Schema wird mit diesem Befehl angewendet:

```bash
npm run db:setup
```

Das Skript `scripts/apply-local-schema.mjs` verwendet die vorhandenen Migrationen, filtert Supabase-spezifische Rollen, Grants und Storage-Policies heraus und lässt die Demo-Datenmigration bewusst aus:

```txt
supabase/migrations/20260425160046_seed_sample_apartment_inventory.sql
```

Damit startet eine neue lokale Installation leer. Wichtig: `npm run db:setup` ist destruktiv und nur für Neuinstallation oder Reset gedacht.

Für Updates gibt es einen getrennten, nicht-destruktiven Pfad:

```bash
npm run db:migrate
```

## Storage

Bilder und Dokumente liegen lokal unter:

```txt
storage/uploads/
```

Der Pfad kann über `INVENTORY_STORAGE_DIR` geändert werden. Der komplette `storage/`-Ordner wird nicht versioniert.

## Logo

Ein eigenes Logo kann unter diesem Pfad abgelegt werden:

```txt
public/kistaro-logo.png
```

Nach einem Build oder Update erscheint es automatisch in der Seitenleiste und in der mobilen Kopfzeile. Empfohlen ist ein quadratisches PNG mit transparentem Hintergrund, zum Beispiel `512x512`.

## Backup und Restore

Die Systemseite bietet:
- Datenbank-Backup herunterladen
- Backup hochladen
- Restore-Modus: `Ersetzen`

Das Backup ist eine `.zip` mit:

```txt
database.sql
```

Intern wird dafür `pg_dump` verwendet. Beim Restore wird `psql` verwendet.

## Updates über GitHub Releases

Neue Versionen werden als GitHub Release veröffentlicht. Die Systemseite kann die neueste Release-Version prüfen und ein Update starten.

Konfiguration in `install-config.txt` oder `.env.local`:

```txt
INVENTORY_UPDATE_REPOSITORY=NHUF/kistaro
INVENTORY_UPDATE_TOKEN=
INVENTORY_BACKUP_DIR=storage/backups
```

Der Update-Ablauf:
- Die Systemseite fragt GitHub Releases ab.
- Vor der Installation wird automatisch ein Datenbank-Backup erstellt.
- Das neue Release wird geladen und in die bestehende Installation synchronisiert.
- `.env.local`, `storage/`, `install-config.txt`, Logs und `node_modules` werden nicht aus dem Release überschrieben.
- Danach werden Abhängigkeiten aktualisiert, sichere DB-Migrationen geprüft, der Build erstellt und der Dienst neu gestartet.

## Entwicklung

```bash
npm run dev
```

Im Netzwerk erreichbar:

```bash
npm run dev:network
```

Produktions-Build:

```bash
npm run build
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

Die UI nutzt vorübergehend weiterhin den Importnamen `supabase` aus `lib/supabase.ts`. Das ist kein echter Supabase-Client mehr, sondern ein lokaler Adapter. Dadurch bleiben bestehende Komponenten stabil, während die App intern auf PostgreSQL und Dateisystem umgestellt ist.
