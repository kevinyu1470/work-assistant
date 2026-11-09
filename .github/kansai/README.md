# Kansai reliability and recovery

Production retains the existing GitHub Pages URL and the existing Supabase room. No private itinerary or share capability belongs in this repository.

- Browser: verified localStorage write-ahead journals per tab, IndexedDB fallback, automatic retry/backoff, monotonic cloud revisions, offline opening after one successful download. Different-field changes merge; same-field edits require a choice. Do not clear device storage while offline changes are pending.
- Database: `kansai_private.trip_versions` stores each acknowledged revision inside the same transaction as the active document. History is private; only the service role can call the history RPC. This is recovery history inside the same database, not independent disaster recovery or a claim of zero downtime. Runtime cannot delete/truncate rooms.
- Attachments: cancelled/unreferenced new uploads can be cleaned up; objects referenced by any historical version stay private and cannot be physically deleted by normal cleanup, so historical voucher restores still work.
- Recovery UI: click the sync status, then 歷史版本. Download a version or explicitly restore it. Restore writes a new revision, preserving the version it replaces. Resolve pending edits before restoring.
- Release: all JS/CSS references carry content fingerprints. The service worker verifies the entire manifest before activation, serves a consistent offline shell, and never forces an open page to navigate. Reload requires cloud acknowledgement, durable local storage and closed forms.
- Tests: `node .github/kansai/tests/run.mjs` from repository root. No npm dependencies. `node .github/kansai/scripts/check-live.mjs` verifies public production assets and gateway authentication without accessing travel data.
- Updates: change VERSION in `release-update.js` and the release builder to a new version before publishing, then `python3 .github/kansai/scripts/build-release.py`. Commit the generated HTML, worker and manifest together. Run checks before advancing main. Deployment success and public asset integrity are separate checks.

Apply SQL migrations before deploying the new edge handlers, then publish the tested frontend. The migration scripts contain no private data. Recovery history begins at migration installation; earlier deleted data cannot be reconstructed from versions that never existed. Monitor database/storage growth as travel edits and attachments accumulate; retention changes require preserving useful restore points first.

The `Kansai reliability` Actions workflow runs the regression suite on changes and hourly public smoke checks. The hourly job requires no travel key and cannot read private data. Its failure status provides an operational signal; notification delivery depends on the repository owner's GitHub notification settings. This is detection, not automatic provider failover. GitHub Pages' existing deployment workflow is retained.
