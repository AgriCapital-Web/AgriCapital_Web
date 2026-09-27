-- Applied hotfix: normalize governance role values.
UPDATE public.user_roles SET role='associe_actionnaire' WHERE role IN ('associe','actionnaire');