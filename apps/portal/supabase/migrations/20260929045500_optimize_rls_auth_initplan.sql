do $$
declare r record; q text;
begin
  for r in
    select schemaname,tablename,policyname,qual,with_check
    from pg_policies
    where (qual ilike '%auth.uid()%' or with_check ilike '%auth.uid()%')
      and schemaname='public'
  loop
    if r.qual is not null then
      q := replace(r.qual, 'auth.uid()', '(select auth.uid())');
      execute format('alter policy %I on %I.%I using (%s)', r.policyname,r.schemaname,r.tablename,q);
    end if;
    if r.with_check is not null then
      q := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
      execute format('alter policy %I on %I.%I with check (%s)', r.policyname,r.schemaname,r.tablename,q);
    end if;
  end loop;
end $$;

alter policy "Users can subscribe to their own user topic"
on realtime.messages
using (realtime.topic() = ('user:'::text || ((select auth.uid()))::text));