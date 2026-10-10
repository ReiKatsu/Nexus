# Season automation — 10 October 2026

## Product decision

No grace period. A result approved after its earned-at Season ends or closes receives Career XP only (season_id NULL), never new-Season XP for an old result. CLOSED snapshots stay final. Business dates use Asia/Jakarta. July–June periods are preserved.

## Prepared implementation

Migration 20261010104229_automate_season_rollover_and_weekly_badges.sql introduces owner-only nexus_private workers and preserves guarded public admin RPCs. A shared transaction advisory lock serializes review timestamps, XP assignment, weekly badges and snapshots. Approval stamps clock_timestamp after the lock, so all ACTIVE Squad members use one approval time even across midnight. Existing validation/XP amounts and historical ledger/badges are preserved.

Rollover checks every five minutes, atomically snapshots and closes the expired Season, then activates/creates the current July–June Season. Review also checks rollover, so a delayed cron cannot admit late Seasonal XP. The weekly badge job runs Monday 00:00 WIB. Clients cannot execute private workers. Existing contender percentage and historical additive rewards are preserved.

## Verification

PASS locally using PGlite and a structural copy of the live public schema (no production user data): SQL function compilation; exact WIB cutoff; no premature rollover; closure/new-Season activation; repeated rollover; old/new result date assignment. The actual migration functions were loaded; pg_cron extension/job installation was excluded because PGlite does not support it.

supabase/tests/season_automation_cutoff_local.sql records those local assertions. supabase/tests/season_automation_runtime_rollback.sql is prepared for an owner-authorized sandbox with admin/two-student fixtures, covering permissions, real Legacy/Verified review paths, weekly idempotence, snapshots and historical rows. It has NOT been executed. Simultaneous sessions/concurrency and actual scheduled runs have NOT been tested.

## Deployment status

NOT APPLIED. Automatic approval review rejected executing the broad migration on the connected active database, even wrapped in rollback, because of trigger/function and scheduler blast radius. No live schema, jobs, Season, XP or badges were changed by this task. Approval of this exact migration and runtime verification is required before active-database deployment. Do not report production runtime PASS or rename to an applied remote version yet.

Before deployment, validate in a full isolated Postgres/Supabase environment, run the prepared runtime regression and a two-session approval/close test, inspect security advisors, then apply the reviewed migration and confirm both cron jobs. Do not close the ongoing Season as a persistent test.

Idle Squad cleanup is outside this change and still needs G07 decisions.
