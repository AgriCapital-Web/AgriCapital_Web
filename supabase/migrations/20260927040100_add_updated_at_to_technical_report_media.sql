ALTER TABLE public.rapports_visites_medias ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.rapports_visites_medias SET updated_at=created_at WHERE updated_at IS NULL;
CREATE OR REPLACE FUNCTION public.touch_technical_media_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_touch_technical_media_updated_at ON public.rapports_visites_medias;
CREATE TRIGGER trg_touch_technical_media_updated_at BEFORE UPDATE ON public.rapports_visites_medias FOR EACH ROW EXECUTE FUNCTION public.touch_technical_media_updated_at();