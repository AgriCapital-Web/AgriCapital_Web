-- Repair the client business-ID sequence so generated AGC-xxxxxx values never collide with existing clients.
DO $$
DECLARE
  v_max integer;
BEGIN
  SELECT max((substring(id_unique from 5))::integer)
  INTO v_max
  FROM public.clients
  WHERE id_unique ~ '^AGC-[0-9]{6}$';

  PERFORM setval(
    'public.clients_agc_id_seq',
    COALESCE(v_max, 1),
    v_max IS NOT NULL
  );
END $$;
