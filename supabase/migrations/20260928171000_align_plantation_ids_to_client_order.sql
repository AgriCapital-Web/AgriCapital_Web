-- Keep current plantation identifiers aligned with the canonical Client/dossier order.
-- Future PLT identifiers continue monotonically from this corrected registry.
begin;

update public.plantations
set id_unique = 'PLT-TEMP-' || id::text
where id_unique is null or id_unique like 'PLT-%';

with ordered as (
  select p.id, row_number() over (order by c.id_unique, p.created_at, p.id) as rn
  from public.plantations p
  join public.clients c on c.id=p.client_id
)
update public.plantations p
set id_unique = 'PLT-' || lpad(o.rn::text,6,'0')
from ordered o
where o.id=p.id;

select setval(
  'public.plantations_plt_id_seq',
  greatest(coalesce((select max(nullif(substring(id_unique from 5),'')::integer) from public.plantations where id_unique like 'PLT-%'),1),1),
  true
);

commit;