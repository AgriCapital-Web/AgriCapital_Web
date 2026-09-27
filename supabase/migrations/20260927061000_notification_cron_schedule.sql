-- 2026-09-27 : planification notification worker sans secret custom.
do $$
declare jid integer;
begin
  select jobid into jid from cron.job where jobname='agricapital-notification-automation' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
  perform cron.schedule(
    'agricapital-notification-automation',
    '*/5 * * * *',
    $$select net.http_post(
      url:='https://rfzfsmpsuempafhkqhra.supabase.co/functions/v1/notification-cron',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb,
      timeout_milliseconds:=10000
    );$$
  );
end $$;
