-- Keep client stats synchronized when a shared beneficiary allocation changes
-- 2026-09-28
drop trigger if exists trg_beneficiaire_attributions_client_stats on public.beneficiaire_attributions;
create trigger trg_beneficiaire_attributions_client_stats
after insert or update or delete on public.beneficiaire_attributions
for each row execute function public.update_client_stats();
