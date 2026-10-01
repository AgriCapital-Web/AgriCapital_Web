
ALTER PUBLICATION supabase_realtime DROP TABLE public.souscripteurs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.paiements;
ALTER PUBLICATION supabase_realtime DROP TABLE public.commissions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.portefeuilles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.documents_souscription;
ALTER PUBLICATION supabase_realtime DROP TABLE public.plantations;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can subscribe to their own user topic"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING ((realtime.topic()) = ('user:' || auth.uid()::text));

CREATE POLICY "Clients read own plantation photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'photos-plantations'
    AND EXISTS (
      SELECT 1
      FROM public.plantations p
      JOIN public.souscripteurs s ON s.id = p.souscripteur_id
      WHERE s.user_id = auth.uid()
        AND (
          storage.objects.name LIKE p.id::text || '/%'
          OR storage.objects.name LIKE p.souscripteur_id::text || '/%'
        )
    )
  );

CREATE POLICY "Clients read own payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'preuves-paiement'
    AND EXISTS (
      SELECT 1
      FROM public.paiements pa
      JOIN public.souscripteurs s ON s.id = pa.souscripteur_id
      WHERE s.user_id = auth.uid()
        AND (
          pa.preuve_paiement_url LIKE '%' || storage.objects.name
          OR pa.fichier_preuve_url LIKE '%' || storage.objects.name
          OR storage.objects.name LIKE pa.id::text || '/%'
          OR storage.objects.name LIKE s.id::text || '/%'
        )
    )
  );
