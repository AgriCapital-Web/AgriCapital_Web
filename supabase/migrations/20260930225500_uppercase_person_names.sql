create or replace function public.uppercase_person_names()
returns trigger language plpgsql set search_path='public' as $$
begin
  if tg_table_name='clients' then
    new.nom_famille=upper(nullif(trim(new.nom_famille),''));
    new.prenoms=upper(nullif(trim(new.prenoms),''));
    new.nom_complet=upper(nullif(trim(new.nom_complet),''));
    new.nom=upper(nullif(trim(new.nom),''));
    new.nom_pere=upper(nullif(trim(new.nom_pere),''));
    new.nom_mere=upper(nullif(trim(new.nom_mere),''));
    new.contact_urgence_nom=upper(nullif(trim(new.contact_urgence_nom),''));
  elsif tg_table_name='profiles' then
    new.nom_complet=upper(nullif(trim(new.nom_complet),''));
  elsif tg_table_name='proprietaires_terres' then
    new.nom=upper(nullif(trim(new.nom),''));
    new.prenoms=upper(nullif(trim(new.prenoms),''));
    new.nom_complet=upper(nullif(trim(new.nom_complet),''));
    new.nom_pere=upper(nullif(trim(new.nom_pere),''));
    new.nom_mere=upper(nullif(trim(new.nom_mere),''));
    new.nom_representant=upper(nullif(trim(new.nom_representant),''));
    new.co_titulaire_nom=upper(nullif(trim(new.co_titulaire_nom),''));
    new.temoin_proprietaire_nom=upper(nullif(trim(new.temoin_proprietaire_nom),''));
    new.representant_agricapital_nom=upper(nullif(trim(new.representant_agricapital_nom),''));
    new.leader_communautaire_nom=upper(nullif(trim(new.leader_communautaire_nom),''));
    new.voisin_1_nom=upper(nullif(trim(new.voisin_1_nom),''));
    new.voisin_2_nom=upper(nullif(trim(new.voisin_2_nom),''));
  else
    new.nom=upper(nullif(trim(new.nom),''));
    new.prenoms=upper(nullif(trim(new.prenoms),''));
  end if;
  return new;
end $$;
drop trigger if exists trg_uppercase_person_names_clients on public.clients;
create trigger trg_uppercase_person_names_clients before insert or update on public.clients for each row execute function public.uppercase_person_names();
drop trigger if exists trg_uppercase_person_names_profiles on public.profiles;
create trigger trg_uppercase_person_names_profiles before insert or update on public.profiles for each row execute function public.uppercase_person_names();
drop trigger if exists trg_uppercase_person_names_proprietaires on public.proprietaires_terres;
create trigger trg_uppercase_person_names_proprietaires before insert or update on public.proprietaires_terres for each row execute function public.uppercase_person_names();
drop trigger if exists trg_uppercase_person_names_cotitulaires on public.cotitulaires_mandataires;
create trigger trg_uppercase_person_names_cotitulaires before insert or update on public.cotitulaires_mandataires for each row execute function public.uppercase_person_names();
drop trigger if exists trg_uppercase_person_names_client_cotitulaires on public.client_cotitulaires_mandataires;
create trigger trg_uppercase_person_names_client_cotitulaires before insert or update on public.client_cotitulaires_mandataires for each row execute function public.uppercase_person_names();
drop trigger if exists trg_uppercase_person_names_leads on public.leads;
create trigger trg_uppercase_person_names_leads before insert or update on public.leads for each row execute function public.uppercase_person_names();
update public.clients set nom_famille=upper(nom_famille),prenoms=upper(prenoms),nom_complet=upper(nom_complet),nom=upper(nom),nom_pere=upper(nom_pere),nom_mere=upper(nom_mere),contact_urgence_nom=upper(contact_urgence_nom);
update public.profiles set nom_complet=upper(nom_complet);
update public.proprietaires_terres set nom=upper(nom),prenoms=upper(prenoms),nom_complet=upper(nom_complet),nom_pere=upper(nom_pere),nom_mere=upper(nom_mere),nom_representant=upper(nom_representant),co_titulaire_nom=upper(co_titulaire_nom),temoin_proprietaire_nom=upper(temoin_proprietaire_nom),representant_agricapital_nom=upper(representant_agricapital_nom),leader_communautaire_nom=upper(leader_communautaire_nom),voisin_1_nom=upper(voisin_1_nom),voisin_2_nom=upper(voisin_2_nom);
update public.cotitulaires_mandataires set nom=upper(nom),prenoms=upper(prenoms);
update public.client_cotitulaires_mandataires set nom=upper(nom),prenoms=upper(prenoms);
update public.leads set nom=upper(nom),prenoms=upper(prenoms);
