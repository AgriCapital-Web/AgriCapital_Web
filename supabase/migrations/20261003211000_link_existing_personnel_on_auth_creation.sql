-- When an existing personnel record receives its first Auth account,
-- attach the new Auth user to that same profile instead of creating a duplicate.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $func$
DECLARE
  v_username text;
  v_pending boolean;
  v_existing_profile uuid;
BEGIN
  v_username := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))));
  v_pending := NULLIF(NEW.raw_user_meta_data->>'pending_role', '') IS NOT NULL;
  v_existing_profile := NULLIF(NEW.raw_user_meta_data->>'existing_profile_id','')::uuid;

  IF v_existing_profile IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id=v_existing_profile AND user_id IS NULL) THEN
    UPDATE public.profiles
    SET user_id=NEW.id,
        email=COALESCE(NEW.email,email),
        nom_complet=COALESCE(NULLIF(NEW.raw_user_meta_data->>'nom_complet',''),nom_complet),
        username=COALESCE(NULLIF(v_username,''),username),
        actif=CASE WHEN v_pending THEN false ELSE actif END
    WHERE id=v_existing_profile;
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id,user_id,email,nom_complet,username,actif)
  VALUES (
    NEW.id,NEW.id,NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nom_complet',''),split_part(NEW.email,'@',1)),
    v_username,
    NOT v_pending
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id=EXCLUDED.user_id,
    email=EXCLUDED.email,
    nom_complet=EXCLUDED.nom_complet,
    username=EXCLUDED.username,
    actif=CASE WHEN v_pending THEN false ELSE public.profiles.actif END;

  RETURN NEW;
END;
$func$;