-- Nettoyage structurel : anciennes migrations empilées avaient créé plusieurs triggers updated_at identiques.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT event_object_table AS table_name, trigger_name,
           row_number() OVER (PARTITION BY event_object_table ORDER BY trigger_name) AS rn
    FROM information_schema.triggers
    WHERE trigger_schema='public'
      AND action_statement='EXECUTE FUNCTION update_updated_at_column()'
  LOOP
    IF r.rn > 1 THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.trigger_name, r.table_name);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS recompute_pending_di_after_promotions_change ON public.promotions;
