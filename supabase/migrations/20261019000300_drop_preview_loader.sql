-- Removes the one-off helper used to load iTunes preview URLs during setup.
-- Its execute grants were already revoked; this drops it for good.
-- From now on, refresh previews with scripts/refresh-previews.ts (uses the secret key).
drop function if exists public.tmp_load_previews(text, jsonb);
delete from private.settings where key = 'preview_loader_secret';
