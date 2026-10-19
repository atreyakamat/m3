# Database and migrations

Alembic revision `20261019_01` creates users, role assignments, facilities, sites, pseudonymous patients, dated site assignments, travel events, clinical assessments, samples, diagnostic tests, follow-ups, molecular results, sessions, and audit events. UUIDs are server-generated opaque identifiers; patient codes are random opaque labels and neither phone numbers nor identifiers appear in QR data (QR is deferred).

Core relationships are `patient → site assignments/travel/assessments/samples/follow-ups`; `sample → diagnostic tests`; and `sample → molecular results`. Routine diagnostic and research tables are intentionally distinct. Pending, indeterminate, not-tested, inconclusive, detected, and not-detected are stored as distinct values.

Apply migrations with `docker compose run --rm api alembic upgrade head`, then generate only training data with `docker compose run --rm api python -m app.seed`. The seed is idempotent and has six clearly disclosed demo accounts. It contains no real health data.

The initial migration creates indexes for patient code, phone, status, due date, sample code, and dated site assignments. The bootstrap migration uses the SQLAlchemy metadata so the full normalized prototype schema can initialize from an empty database. Future production schema changes must be new Alembic revision files, never edits to this revision.
