export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_requests: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          cv_url: string | null
          departement: string | null
          departement_geo_id: string | null
          district_id: string | null
          email: string
          id: string
          justification: string | null
          motif_rejet: string | null
          nom_complet: string
          photo_url: string | null
          poste_souhaite: string | null
          region_id: string | null
          role_souhaite: string
          statut: string | null
          telephone: string
          traite_le: string | null
          traite_par: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          cv_url?: string | null
          departement?: string | null
          departement_geo_id?: string | null
          district_id?: string | null
          email: string
          id?: string
          justification?: string | null
          motif_rejet?: string | null
          nom_complet: string
          photo_url?: string | null
          poste_souhaite?: string | null
          region_id?: string | null
          role_souhaite: string
          statut?: string | null
          telephone: string
          traite_le?: string | null
          traite_par?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          cv_url?: string | null
          departement?: string | null
          departement_geo_id?: string | null
          district_id?: string | null
          email?: string
          id?: string
          justification?: string | null
          motif_rejet?: string | null
          nom_complet?: string
          photo_url?: string | null
          poste_souhaite?: string | null
          region_id?: string | null
          role_souhaite?: string
          statut?: string | null
          telephone?: string
          traite_le?: string | null
          traite_par?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_requests_departement_geo_id_fkey"
            columns: ["departement_geo_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_requests_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_requests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_notes: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          annee_contrat: number | null
          created_at: string | null
          date_calcul: string | null
          date_validation: string | null
          id: string
          montant_base: number | null
          montant_commission: number | null
          paiement_id: string | null
          periode: string | null
          plantation_id: string | null
          profile_id: string | null
          souscripteur_id: string | null
          statut: string | null
          taux_applique: number | null
          taux_commission: number | null
          type_commission: string
          valide_par: string | null
        }
        Insert: {
          annee_contrat?: number | null
          created_at?: string | null
          date_calcul?: string | null
          date_validation?: string | null
          id?: string
          montant_base?: number | null
          montant_commission?: number | null
          paiement_id?: string | null
          periode?: string | null
          plantation_id?: string | null
          profile_id?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          taux_applique?: number | null
          taux_commission?: number | null
          type_commission: string
          valide_par?: string | null
        }
        Update: {
          annee_contrat?: number | null
          created_at?: string | null
          date_calcul?: string | null
          date_validation?: string | null
          id?: string
          montant_base?: number | null
          montant_commission?: number | null
          paiement_id?: string | null
          periode?: string | null
          plantation_id?: string | null
          profile_id?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          taux_applique?: number | null
          taux_commission?: number | null
          type_commission?: string
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_plantation_id_fkey"
            columns: ["plantation_id"]
            isOneToOne: false
            referencedRelation: "plantations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configurations_systeme: {
        Row: {
          categorie: string
          cle: string
          created_at: string
          description: string | null
          id: string
          modifiable: boolean
          type_valeur: string
          updated_at: string
          valeur: string
        }
        Insert: {
          categorie?: string
          cle: string
          created_at?: string
          description?: string | null
          id?: string
          modifiable?: boolean
          type_valeur?: string
          updated_at?: string
          valeur?: string
        }
        Update: {
          categorie?: string
          cle?: string
          created_at?: string
          description?: string | null
          id?: string
          modifiable?: boolean
          type_valeur?: string
          updated_at?: string
          valeur?: string
        }
        Relationships: []
      }
      conventions_foncieres: {
        Row: {
          caution_par_ha: number | null
          caution_totale: number | null
          code_dom: string | null
          code_parc: string | null
          code_sp: string | null
          created_at: string | null
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          date_signature: string | null
          domaine_id: string | null
          duree_ans: number | null
          fichier_convention_url: string | null
          id: string
          notes: string | null
          parcelle_id: string | null
          part_agricapital_ha: number | null
          part_agricapital_pct: number | null
          part_proprietaire_ha: number | null
          part_proprietaire_pct: number | null
          proprietaire_id: string
          reference: string | null
          sous_prefecture_id: string | null
          statut: string | null
          surface_totale_ha: number | null
          type_convention: string
          updated_at: string | null
        }
        Insert: {
          caution_par_ha?: number | null
          caution_totale?: number | null
          code_dom?: string | null
          code_parc?: string | null
          code_sp?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          date_signature?: string | null
          domaine_id?: string | null
          duree_ans?: number | null
          fichier_convention_url?: string | null
          id?: string
          notes?: string | null
          parcelle_id?: string | null
          part_agricapital_ha?: number | null
          part_agricapital_pct?: number | null
          part_proprietaire_ha?: number | null
          part_proprietaire_pct?: number | null
          proprietaire_id: string
          reference?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          surface_totale_ha?: number | null
          type_convention?: string
          updated_at?: string | null
        }
        Update: {
          caution_par_ha?: number | null
          caution_totale?: number | null
          code_dom?: string | null
          code_parc?: string | null
          code_sp?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          date_signature?: string | null
          domaine_id?: string | null
          duree_ans?: number | null
          fichier_convention_url?: string | null
          id?: string
          notes?: string | null
          parcelle_id?: string | null
          part_agricapital_ha?: number | null
          part_agricapital_pct?: number | null
          part_proprietaire_ha?: number | null
          part_proprietaire_pct?: number | null
          proprietaire_id?: string
          reference?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          surface_totale_ha?: number | null
          type_convention?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conventions_foncieres_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conventions_foncieres_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conventions_foncieres_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires_terres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conventions_foncieres_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      cotitulaires_mandataires: {
        Row: {
          created_at: string | null
          date_naissance: string | null
          est_mandataire: boolean | null
          id: string
          lien_proprietaire: string | null
          lieu_naissance: string | null
          nom: string
          numero_piece: string | null
          prenoms: string | null
          proprietaire_id: string
          telephone: string | null
          type_piece: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          date_naissance?: string | null
          est_mandataire?: boolean | null
          id?: string
          lien_proprietaire?: string | null
          lieu_naissance?: string | null
          nom: string
          numero_piece?: string | null
          prenoms?: string | null
          proprietaire_id: string
          telephone?: string | null
          type_piece?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          date_naissance?: string | null
          est_mandataire?: boolean | null
          id?: string
          lien_proprietaire?: string | null
          lieu_naissance?: string | null
          nom?: string
          numero_piece?: string | null
          prenoms?: string | null
          proprietaire_id?: string
          telephone?: string | null
          type_piece?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotitulaires_mandataires_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires_terres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotitulaires_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires_terres"
            referencedColumns: ["id"]
          },
        ]
      }
      departements: {
        Row: {
          code: string | null
          created_at: string | null
          est_actif: boolean | null
          id: string
          nom: string
          region_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          nom: string
          region_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departements_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string | null
          created_at: string | null
          est_actif: boolean | null
          id: string
          nom: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          nom: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      documents_convention: {
        Row: {
          created_at: string | null
          designation: string
          fichier_url: string | null
          id: string
          notes: string | null
          parcelle_id: string | null
          proprietaire_id: string | null
          statut: string | null
          type_document: string
          updated_at: string | null
          uploaded_by: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string | null
          designation: string
          fichier_url?: string | null
          id?: string
          notes?: string | null
          parcelle_id?: string | null
          proprietaire_id?: string | null
          statut?: string | null
          type_document: string
          updated_at?: string | null
          uploaded_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string | null
          designation?: string
          fichier_url?: string | null
          id?: string
          notes?: string | null
          parcelle_id?: string | null
          proprietaire_id?: string | null
          statut?: string | null
          type_document?: string
          updated_at?: string | null
          uploaded_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_convention_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_convention_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires_terres"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_souscription: {
        Row: {
          created_at: string | null
          fichier_url: string
          id: string
          observations: string | null
          souscripteur_id: string | null
          statut: string | null
          type_document: string
          updated_at: string | null
          uploaded_by: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string | null
          fichier_url: string
          id?: string
          observations?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          type_document: string
          updated_at?: string | null
          uploaded_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string | null
          fichier_url?: string
          id?: string
          observations?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          type_document?: string
          updated_at?: string | null
          uploaded_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_souscription_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_souscription_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      domaines: {
        Row: {
          code_dom: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          nom: string
          sous_prefecture_id: string | null
          updated_at: string | null
          village: string | null
        }
        Insert: {
          code_dom: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          nom: string
          sous_prefecture_id?: string | null
          updated_at?: string | null
          village?: string | null
        }
        Update: {
          code_dom?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          nom?: string
          sous_prefecture_id?: string | null
          updated_at?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domaines_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          actif: boolean | null
          created_at: string | null
          id: string
          nom: string
          region_id: string | null
          responsable_id: string | null
          superviseur_id: string | null
          type_equipe: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          id?: string
          nom: string
          region_id?: string | null
          responsable_id?: string | null
          superviseur_id?: string | null
          type_equipe?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          id?: string
          nom?: string
          region_id?: string | null
          responsable_id?: string | null
          superviseur_id?: string | null
          type_equipe?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_superviseur_id_fkey"
            columns: ["superviseur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grille_remuneration: {
        Row: {
          actif: boolean | null
          annee_application: number | null
          created_at: string | null
          description: string | null
          id: string
          montant: number | null
          role_cible: string
          taux_pourcentage: number | null
          type_remuneration: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          annee_application?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          montant?: number | null
          role_cible: string
          taux_pourcentage?: number | null
          type_remuneration: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          annee_application?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          montant?: number | null
          role_cible?: string
          taux_pourcentage?: number | null
          type_remuneration?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      historique_activites: {
        Row: {
          action: string
          ancien_valeurs: Json | null
          created_at: string | null
          details: string | null
          id: string
          ip_address: string | null
          nouvelles_valeurs: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          ancien_valeurs?: Json | null
          created_at?: string | null
          details?: string | null
          id?: string
          ip_address?: string | null
          nouvelles_valeurs?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          ancien_valeurs?: Json | null
          created_at?: string | null
          details?: string | null
          id?: string
          ip_address?: string | null
          nouvelles_valeurs?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      kkiapay_events: {
        Row: {
          amount: number | null
          created_at: string | null
          fees: number | null
          id: string
          paiement_id: string | null
          processed: boolean | null
          processed_at: string | null
          raw_payload: Json | null
          reference: string | null
          signature_valid: boolean | null
          source: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          fees?: number | null
          id?: string
          paiement_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json | null
          reference?: string | null
          signature_valid?: boolean | null
          source?: string | null
          status: string
          transaction_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          fees?: number | null
          id?: string
          paiement_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json | null
          reference?: string | null
          signature_valid?: boolean | null
          source?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: []
      }
      lead_historique: {
        Row: {
          acteur_id: string | null
          action: string
          ancienne_valeur: string | null
          champ: string | null
          commentaire: string | null
          created_at: string
          id: string
          lead_id: string
          nouvelle_valeur: string | null
        }
        Insert: {
          acteur_id?: string | null
          action: string
          ancienne_valeur?: string | null
          champ?: string | null
          commentaire?: string | null
          created_at?: string
          id?: string
          lead_id: string
          nouvelle_valeur?: string | null
        }
        Update: {
          acteur_id?: string | null
          action?: string
          ancienne_valeur?: string | null
          champ?: string | null
          commentaire?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          nouvelle_valeur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_historique_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_relances: {
        Row: {
          canal: string
          commentaire: string | null
          commercial_id: string | null
          created_at: string
          date_relance: string
          id: string
          lead_id: string
          prochaine_relance: string | null
          resultat: string
        }
        Insert: {
          canal: string
          commentaire?: string | null
          commercial_id?: string | null
          created_at?: string
          date_relance?: string
          id?: string
          lead_id: string
          prochaine_relance?: string | null
          resultat: string
        }
        Update: {
          canal?: string
          commentaire?: string | null
          commercial_id?: string | null
          created_at?: string
          date_relance?: string
          id?: string
          lead_id?: string
          prochaine_relance?: string | null
          resultat?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_relances_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          commentaire: string | null
          converti_at: string | null
          created_at: string
          created_by: string | null
          creneau_prefere: string | null
          date_contact_souhaitee: string | null
          delai_demarrage: string | null
          dispose_terrain: boolean
          email: string | null
          est_diaspora: boolean
          id: string
          id_unique: string | null
          mode_contact_prefere: string | null
          nom: string
          pays_diaspora: string | null
          prenoms: string
          prochaine_relance_at: string | null
          region_residence: string
          source: string
          souscripteur_id: string | null
          statut: string
          superficie_a_valoriser_ha: number | null
          superficie_disponible_ha: number | null
          superficie_souhaitee_ha: number | null
          telephone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          commentaire?: string | null
          converti_at?: string | null
          created_at?: string
          created_by?: string | null
          creneau_prefere?: string | null
          date_contact_souhaitee?: string | null
          delai_demarrage?: string | null
          dispose_terrain?: boolean
          email?: string | null
          est_diaspora?: boolean
          id?: string
          id_unique?: string | null
          mode_contact_prefere?: string | null
          nom: string
          pays_diaspora?: string | null
          prenoms: string
          prochaine_relance_at?: string | null
          region_residence: string
          source?: string
          souscripteur_id?: string | null
          statut?: string
          superficie_a_valoriser_ha?: number | null
          superficie_disponible_ha?: number | null
          superficie_souhaitee_ha?: number | null
          telephone: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          commentaire?: string | null
          converti_at?: string | null
          created_at?: string
          created_by?: string | null
          creneau_prefere?: string | null
          date_contact_souhaitee?: string | null
          delai_demarrage?: string | null
          dispose_terrain?: boolean
          email?: string | null
          est_diaspora?: boolean
          id?: string
          id_unique?: string | null
          mode_contact_prefere?: string | null
          nom?: string
          pays_diaspora?: string | null
          prenoms?: string
          prochaine_relance_at?: string | null
          region_residence?: string
          source?: string
          souscripteur_id?: string | null
          statut?: string
          superficie_a_valoriser_ha?: number | null
          superficie_disponible_ha?: number | null
          superficie_souhaitee_ha?: number | null
          telephone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      lots_hectares: {
        Row: {
          centroid_lat: number | null
          centroid_lng: number | null
          certifie_geometre: boolean | null
          convention_id: string | null
          created_at: string | null
          created_by: string | null
          date_attribution: string | null
          date_certification: string | null
          fichier_plan_url: string | null
          geometre_nom: string | null
          id: string
          notes: string | null
          numero_h: number
          parcelle_id: string | null
          polygone_gps: Json | null
          reference: string | null
          souscripteur_id: string | null
          statut: string | null
          surface_ha: number | null
          updated_at: string | null
        }
        Insert: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          certifie_geometre?: boolean | null
          convention_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_attribution?: string | null
          date_certification?: string | null
          fichier_plan_url?: string | null
          geometre_nom?: string | null
          id?: string
          notes?: string | null
          numero_h: number
          parcelle_id?: string | null
          polygone_gps?: Json | null
          reference?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          surface_ha?: number | null
          updated_at?: string | null
        }
        Update: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          certifie_geometre?: boolean | null
          convention_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_attribution?: string | null
          date_certification?: string | null
          fichier_plan_url?: string | null
          geometre_nom?: string | null
          id?: string
          notes?: string | null
          numero_h?: number
          parcelle_id?: string | null
          polygone_gps?: Json | null
          reference?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          surface_ha?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_hectares_convention_id_fkey"
            columns: ["convention_id"]
            isOneToOne: false
            referencedRelation: "conventions_foncieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_hectares_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_hectares_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_hectares_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      offres: {
        Row: {
          actif: boolean | null
          avantages: Json | null
          code: string
          contribution_mensuelle_par_ha: number
          couleur: string | null
          created_at: string | null
          description: string | null
          duree_installation_mois: number
          duree_paiement_mois: number
          duree_production_ans: number
          gestion_type: string
          id: string
          montant_cash_par_ha: number
          montant_da_par_ha: number
          montant_depot_initial_par_ha: number
          montant_total_par_ha: number
          nom: string
          ordre: number | null
          pourcentage_revenus_reverses: number
          redevance_production_par_ha_an: number
          tranches_paiement: Json
          type_offre: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          avantages?: Json | null
          code: string
          contribution_mensuelle_par_ha?: number
          couleur?: string | null
          created_at?: string | null
          description?: string | null
          duree_installation_mois?: number
          duree_paiement_mois?: number
          duree_production_ans?: number
          gestion_type?: string
          id?: string
          montant_cash_par_ha?: number
          montant_da_par_ha?: number
          montant_depot_initial_par_ha?: number
          montant_total_par_ha?: number
          nom: string
          ordre?: number | null
          pourcentage_revenus_reverses?: number
          redevance_production_par_ha_an?: number
          tranches_paiement?: Json
          type_offre?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          avantages?: Json | null
          code?: string
          contribution_mensuelle_par_ha?: number
          couleur?: string | null
          created_at?: string | null
          description?: string | null
          duree_installation_mois?: number
          duree_paiement_mois?: number
          duree_production_ans?: number
          gestion_type?: string
          id?: string
          montant_cash_par_ha?: number
          montant_da_par_ha?: number
          montant_depot_initial_par_ha?: number
          montant_total_par_ha?: number
          nom?: string
          ordre?: number | null
          pourcentage_revenus_reverses?: number
          redevance_production_par_ha_an?: number
          tranches_paiement?: Json
          type_offre?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          telephone: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          telephone: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          telephone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      paiements: {
        Row: {
          annee: number | null
          cancelled_at: string | null
          created_at: string | null
          created_by: string | null
          date_echeance: string | null
          date_paiement: string | null
          date_upload_preuve: string | null
          date_validation: string | null
          est_depot_initial: boolean
          fichier_preuve_url: string | null
          id: string
          id_transaction: string | null
          jours_couverts: number
          jours_retard: number
          kkiapay_transaction_id: string | null
          metadata: Json | null
          mode_paiement: string | null
          montant: number
          montant_paye: number | null
          montant_theorique: number | null
          notes: string | null
          numero_echeance: number | null
          observations: string | null
          operateur_mobile_money: string | null
          periode_debut: string | null
          periode_fin: string | null
          phase: string | null
          plantation_id: string | null
          preuve_paiement_url: string | null
          reference: string | null
          refund_reason: string | null
          refund_requested_at: string | null
          refunded_at: string | null
          souscripteur_id: string | null
          statut: string | null
          type_paiement: string | null
          type_preuve: string | null
          updated_at: string | null
          valide_par: string | null
        }
        Insert: {
          annee?: number | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string | null
          date_paiement?: string | null
          date_upload_preuve?: string | null
          date_validation?: string | null
          est_depot_initial?: boolean
          fichier_preuve_url?: string | null
          id?: string
          id_transaction?: string | null
          jours_couverts?: number
          jours_retard?: number
          kkiapay_transaction_id?: string | null
          metadata?: Json | null
          mode_paiement?: string | null
          montant?: number
          montant_paye?: number | null
          montant_theorique?: number | null
          notes?: string | null
          numero_echeance?: number | null
          observations?: string | null
          operateur_mobile_money?: string | null
          periode_debut?: string | null
          periode_fin?: string | null
          phase?: string | null
          plantation_id?: string | null
          preuve_paiement_url?: string | null
          reference?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          type_paiement?: string | null
          type_preuve?: string | null
          updated_at?: string | null
          valide_par?: string | null
        }
        Update: {
          annee?: number | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string | null
          date_paiement?: string | null
          date_upload_preuve?: string | null
          date_validation?: string | null
          est_depot_initial?: boolean
          fichier_preuve_url?: string | null
          id?: string
          id_transaction?: string | null
          jours_couverts?: number
          jours_retard?: number
          kkiapay_transaction_id?: string | null
          metadata?: Json | null
          mode_paiement?: string | null
          montant?: number
          montant_paye?: number | null
          montant_theorique?: number | null
          notes?: string | null
          numero_echeance?: number | null
          observations?: string | null
          operateur_mobile_money?: string | null
          periode_debut?: string | null
          periode_fin?: string | null
          phase?: string | null
          plantation_id?: string | null
          preuve_paiement_url?: string | null
          reference?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          type_paiement?: string | null
          type_preuve?: string | null
          updated_at?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_plantation_id_fkey"
            columns: ["plantation_id"]
            isOneToOne: false
            referencedRelation: "plantations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      parcelles: {
        Row: {
          code_parc: string | null
          convention_id: string | null
          created_at: string | null
          created_by: string | null
          date_convention: string | null
          departement_id: string | null
          district_id: string | null
          domaine_id: string | null
          duree_convention: number | null
          id: string
          id_unique: string | null
          localisation_gps_lat: number | null
          localisation_gps_lng: number | null
          nom: string | null
          notes: string | null
          polygone_gps: Json | null
          proprietaire_id: string | null
          reference_convention: string | null
          region_id: string | null
          sous_prefecture_id: string | null
          statut: string | null
          surface_agricapital_ha: number
          surface_attribuee_ha: number
          surface_disponible_ha: number
          surface_proprietaire_ha: number
          surface_totale_ha: number
          updated_at: string | null
          updated_by: string | null
          village: string | null
        }
        Insert: {
          code_parc?: string | null
          convention_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_convention?: string | null
          departement_id?: string | null
          district_id?: string | null
          domaine_id?: string | null
          duree_convention?: number | null
          id?: string
          id_unique?: string | null
          localisation_gps_lat?: number | null
          localisation_gps_lng?: number | null
          nom?: string | null
          notes?: string | null
          polygone_gps?: Json | null
          proprietaire_id?: string | null
          reference_convention?: string | null
          region_id?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          surface_agricapital_ha?: number
          surface_attribuee_ha?: number
          surface_disponible_ha?: number
          surface_proprietaire_ha?: number
          surface_totale_ha?: number
          updated_at?: string | null
          updated_by?: string | null
          village?: string | null
        }
        Update: {
          code_parc?: string | null
          convention_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_convention?: string | null
          departement_id?: string | null
          district_id?: string | null
          domaine_id?: string | null
          duree_convention?: number | null
          id?: string
          id_unique?: string | null
          localisation_gps_lat?: number | null
          localisation_gps_lng?: number | null
          nom?: string | null
          notes?: string | null
          polygone_gps?: Json | null
          proprietaire_id?: string | null
          reference_convention?: string | null
          region_id?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          surface_agricapital_ha?: number
          surface_attribuee_ha?: number
          surface_disponible_ha?: number
          surface_proprietaire_ha?: number
          surface_totale_ha?: number
          updated_at?: string | null
          updated_by?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelles_convention_id_fkey"
            columns: ["convention_id"]
            isOneToOne: false
            referencedRelation: "conventions_foncieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "proprietaires_terres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      plantations: {
        Row: {
          age_plants: number | null
          alerte_non_paiement: boolean | null
          alerte_visite_retard: boolean | null
          altitude: number | null
          chef_village_nom: string | null
          chef_village_telephone: string | null
          created_at: string | null
          created_by: string | null
          date_activation: string | null
          date_plantation: string | null
          date_signature_contrat: string | null
          densite_plants: number | null
          departement_id: string | null
          derniere_visite: string | null
          district_id: string | null
          document_foncier_date_delivrance: string | null
          document_foncier_numero: string | null
          document_foncier_type: string | null
          id: string
          id_unique: string | null
          latitude: number | null
          localisation_gps_lat: number | null
          localisation_gps_lng: number | null
          localite: string | null
          longitude: number | null
          montant_contribution_mensuelle: number | null
          montant_da: number | null
          montant_da_paye: number | null
          nom: string | null
          nom_plantation: string | null
          nombre_plants: number | null
          notes: string | null
          notes_internes: string | null
          parcelle_id: string | null
          polygone_gps: Json | null
          prochaine_visite: string | null
          region_id: string | null
          sous_prefecture_id: string | null
          souscripteur_id: string | null
          statut: string | null
          statut_global: string | null
          superficie_activee: number | null
          superficie_ha: number | null
          type_culture: string | null
          updated_at: string | null
          updated_by: string | null
          variete: string | null
          village: string | null
          village_nom: string | null
        }
        Insert: {
          age_plants?: number | null
          alerte_non_paiement?: boolean | null
          alerte_visite_retard?: boolean | null
          altitude?: number | null
          chef_village_nom?: string | null
          chef_village_telephone?: string | null
          created_at?: string | null
          created_by?: string | null
          date_activation?: string | null
          date_plantation?: string | null
          date_signature_contrat?: string | null
          densite_plants?: number | null
          departement_id?: string | null
          derniere_visite?: string | null
          district_id?: string | null
          document_foncier_date_delivrance?: string | null
          document_foncier_numero?: string | null
          document_foncier_type?: string | null
          id?: string
          id_unique?: string | null
          latitude?: number | null
          localisation_gps_lat?: number | null
          localisation_gps_lng?: number | null
          localite?: string | null
          longitude?: number | null
          montant_contribution_mensuelle?: number | null
          montant_da?: number | null
          montant_da_paye?: number | null
          nom?: string | null
          nom_plantation?: string | null
          nombre_plants?: number | null
          notes?: string | null
          notes_internes?: string | null
          parcelle_id?: string | null
          polygone_gps?: Json | null
          prochaine_visite?: string | null
          region_id?: string | null
          sous_prefecture_id?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          statut_global?: string | null
          superficie_activee?: number | null
          superficie_ha?: number | null
          type_culture?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variete?: string | null
          village?: string | null
          village_nom?: string | null
        }
        Update: {
          age_plants?: number | null
          alerte_non_paiement?: boolean | null
          alerte_visite_retard?: boolean | null
          altitude?: number | null
          chef_village_nom?: string | null
          chef_village_telephone?: string | null
          created_at?: string | null
          created_by?: string | null
          date_activation?: string | null
          date_plantation?: string | null
          date_signature_contrat?: string | null
          densite_plants?: number | null
          departement_id?: string | null
          derniere_visite?: string | null
          district_id?: string | null
          document_foncier_date_delivrance?: string | null
          document_foncier_numero?: string | null
          document_foncier_type?: string | null
          id?: string
          id_unique?: string | null
          latitude?: number | null
          localisation_gps_lat?: number | null
          localisation_gps_lng?: number | null
          localite?: string | null
          longitude?: number | null
          montant_contribution_mensuelle?: number | null
          montant_da?: number | null
          montant_da_paye?: number | null
          nom?: string | null
          nom_plantation?: string | null
          nombre_plants?: number | null
          notes?: string | null
          notes_internes?: string | null
          parcelle_id?: string | null
          polygone_gps?: Json | null
          prochaine_visite?: string | null
          region_id?: string | null
          sous_prefecture_id?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          statut_global?: string | null
          superficie_activee?: number | null
          superficie_ha?: number | null
          type_culture?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variete?: string | null
          village?: string | null
          village_nom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantations_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantations_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantations_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantations_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantations_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      portefeuilles: {
        Row: {
          created_at: string | null
          dernier_versement_date: string | null
          dernier_versement_montant: number | null
          id: string
          solde_commissions: number | null
          total_gagne: number | null
          total_retire: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dernier_versement_date?: string | null
          dernier_versement_montant?: number | null
          id?: string
          solde_commissions?: number | null
          total_gagne?: number | null
          total_retire?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dernier_versement_date?: string | null
          dernier_versement_montant?: number | null
          id?: string
          solde_commissions?: number | null
          total_gagne?: number | null
          total_retire?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          actif: boolean | null
          adresse_mail_secondaire: string | null
          contact_urgence_nom: string | null
          contact_urgence_photo_url: string | null
          contact_urgence_prenom: string | null
          contact_urgence_telephone1: string | null
          contact_urgence_telephone2: string | null
          created_at: string | null
          departement: string | null
          district_id: string | null
          email: string | null
          equipe_id: string | null
          id: string
          nom_complet: string
          numero_piece_identite: string | null
          photo_url: string | null
          piece_identite_url: string | null
          poste: string | null
          quartier: string | null
          region_id: string | null
          relation_rh: string | null
          taux_commission: number | null
          telephone: string | null
          telephone_secondaire: string | null
          type_piece_identite: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
          ville: string | null
          whatsapp: string | null
        }
        Insert: {
          actif?: boolean | null
          adresse_mail_secondaire?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_photo_url?: string | null
          contact_urgence_prenom?: string | null
          contact_urgence_telephone1?: string | null
          contact_urgence_telephone2?: string | null
          created_at?: string | null
          departement?: string | null
          district_id?: string | null
          email?: string | null
          equipe_id?: string | null
          id?: string
          nom_complet: string
          numero_piece_identite?: string | null
          photo_url?: string | null
          piece_identite_url?: string | null
          poste?: string | null
          quartier?: string | null
          region_id?: string | null
          relation_rh?: string | null
          taux_commission?: number | null
          telephone?: string | null
          telephone_secondaire?: string | null
          type_piece_identite?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          ville?: string | null
          whatsapp?: string | null
        }
        Update: {
          actif?: boolean | null
          adresse_mail_secondaire?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_photo_url?: string | null
          contact_urgence_prenom?: string | null
          contact_urgence_telephone1?: string | null
          contact_urgence_telephone2?: string | null
          created_at?: string | null
          departement?: string | null
          district_id?: string | null
          email?: string | null
          equipe_id?: string | null
          id?: string
          nom_complet?: string
          numero_piece_identite?: string | null
          photo_url?: string | null
          piece_identite_url?: string | null
          poste?: string | null
          quartier?: string | null
          region_id?: string | null
          relation_rh?: string | null
          taux_commission?: number | null
          telephone?: string | null
          telephone_secondaire?: string | null
          type_piece_identite?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          ville?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_equipe"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean | null
          applique_toutes_offres: boolean | null
          cible: string
          code: string | null
          created_at: string | null
          date_debut: string
          date_fin: string
          description: string | null
          id: string
          montant_fixe_reduction: number | null
          nom: string
          offre_ids: Json | null
          pourcentage_reduction: number | null
          type_promotion: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          applique_toutes_offres?: boolean | null
          cible?: string
          code?: string | null
          created_at?: string | null
          date_debut: string
          date_fin: string
          description?: string | null
          id?: string
          montant_fixe_reduction?: number | null
          nom: string
          offre_ids?: Json | null
          pourcentage_reduction?: number | null
          type_promotion?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          applique_toutes_offres?: boolean | null
          cible?: string
          code?: string | null
          created_at?: string | null
          date_debut?: string
          date_fin?: string
          description?: string | null
          id?: string
          montant_fixe_reduction?: number | null
          nom?: string
          offre_ids?: Json | null
          pourcentage_reduction?: number | null
          type_promotion?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      proprietaires_terres: {
        Row: {
          caution_par_ha: number | null
          caution_totale: number | null
          civilite: string | null
          co_titulaire_lien: string | null
          co_titulaire_nom: string | null
          co_titulaire_piece: string | null
          co_titulaire_telephone: string | null
          coordonnees_gps: string | null
          created_at: string | null
          created_by: string | null
          croquis_joint: boolean | null
          date_delivrance_piece: string | null
          date_naissance: string | null
          denomination_sociale: string | null
          departement_id: string | null
          district_id: string | null
          domicile: string | null
          email: string | null
          fichier_piece_recto_url: string | null
          fichier_piece_verso_url: string | null
          id: string
          id_unique: string | null
          leader_communautaire_nom: string | null
          leader_communautaire_qualite: string | null
          lieu_naissance: string | null
          limites_est: string | null
          limites_nord: string | null
          limites_ouest: string | null
          limites_sud: string | null
          nom: string
          nom_complet: string | null
          nom_mere: string | null
          nom_pere: string | null
          nom_representant: string | null
          nombre_membres: number | null
          nombre_parcelles: number | null
          notes: string | null
          numero_enregistrement: string | null
          numero_piece: string | null
          part_agricapital_ha: number | null
          part_agricapital_pct: number | null
          part_proprietaire_ha: number | null
          part_proprietaire_pct: number | null
          photo_profil_url: string | null
          prenoms: string | null
          reference_cadastrale: string | null
          region_id: string | null
          representant_agricapital_nom: string | null
          representant_agricapital_qualite: string | null
          servitudes: string | null
          sous_prefecture_id: string | null
          statut: string | null
          statut_foncier: string | null
          surface_totale_declaree_ha: number | null
          surface_totale_ha: number | null
          telephone: string
          temoin_proprietaire_nom: string | null
          temoin_proprietaire_qualite: string | null
          type_piece: string | null
          type_proprietaire: string | null
          updated_at: string | null
          updated_by: string | null
          village: string | null
          voisin_1_cote: string | null
          voisin_1_nom: string | null
          voisin_2_cote: string | null
          voisin_2_nom: string | null
          whatsapp: string | null
        }
        Insert: {
          caution_par_ha?: number | null
          caution_totale?: number | null
          civilite?: string | null
          co_titulaire_lien?: string | null
          co_titulaire_nom?: string | null
          co_titulaire_piece?: string | null
          co_titulaire_telephone?: string | null
          coordonnees_gps?: string | null
          created_at?: string | null
          created_by?: string | null
          croquis_joint?: boolean | null
          date_delivrance_piece?: string | null
          date_naissance?: string | null
          denomination_sociale?: string | null
          departement_id?: string | null
          district_id?: string | null
          domicile?: string | null
          email?: string | null
          fichier_piece_recto_url?: string | null
          fichier_piece_verso_url?: string | null
          id?: string
          id_unique?: string | null
          leader_communautaire_nom?: string | null
          leader_communautaire_qualite?: string | null
          lieu_naissance?: string | null
          limites_est?: string | null
          limites_nord?: string | null
          limites_ouest?: string | null
          limites_sud?: string | null
          nom: string
          nom_complet?: string | null
          nom_mere?: string | null
          nom_pere?: string | null
          nom_representant?: string | null
          nombre_membres?: number | null
          nombre_parcelles?: number | null
          notes?: string | null
          numero_enregistrement?: string | null
          numero_piece?: string | null
          part_agricapital_ha?: number | null
          part_agricapital_pct?: number | null
          part_proprietaire_ha?: number | null
          part_proprietaire_pct?: number | null
          photo_profil_url?: string | null
          prenoms?: string | null
          reference_cadastrale?: string | null
          region_id?: string | null
          representant_agricapital_nom?: string | null
          representant_agricapital_qualite?: string | null
          servitudes?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          statut_foncier?: string | null
          surface_totale_declaree_ha?: number | null
          surface_totale_ha?: number | null
          telephone: string
          temoin_proprietaire_nom?: string | null
          temoin_proprietaire_qualite?: string | null
          type_piece?: string | null
          type_proprietaire?: string | null
          updated_at?: string | null
          updated_by?: string | null
          village?: string | null
          voisin_1_cote?: string | null
          voisin_1_nom?: string | null
          voisin_2_cote?: string | null
          voisin_2_nom?: string | null
          whatsapp?: string | null
        }
        Update: {
          caution_par_ha?: number | null
          caution_totale?: number | null
          civilite?: string | null
          co_titulaire_lien?: string | null
          co_titulaire_nom?: string | null
          co_titulaire_piece?: string | null
          co_titulaire_telephone?: string | null
          coordonnees_gps?: string | null
          created_at?: string | null
          created_by?: string | null
          croquis_joint?: boolean | null
          date_delivrance_piece?: string | null
          date_naissance?: string | null
          denomination_sociale?: string | null
          departement_id?: string | null
          district_id?: string | null
          domicile?: string | null
          email?: string | null
          fichier_piece_recto_url?: string | null
          fichier_piece_verso_url?: string | null
          id?: string
          id_unique?: string | null
          leader_communautaire_nom?: string | null
          leader_communautaire_qualite?: string | null
          lieu_naissance?: string | null
          limites_est?: string | null
          limites_nord?: string | null
          limites_ouest?: string | null
          limites_sud?: string | null
          nom?: string
          nom_complet?: string | null
          nom_mere?: string | null
          nom_pere?: string | null
          nom_representant?: string | null
          nombre_membres?: number | null
          nombre_parcelles?: number | null
          notes?: string | null
          numero_enregistrement?: string | null
          numero_piece?: string | null
          part_agricapital_ha?: number | null
          part_agricapital_pct?: number | null
          part_proprietaire_ha?: number | null
          part_proprietaire_pct?: number | null
          photo_profil_url?: string | null
          prenoms?: string | null
          reference_cadastrale?: string | null
          region_id?: string | null
          representant_agricapital_nom?: string | null
          representant_agricapital_qualite?: string | null
          servitudes?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          statut_foncier?: string | null
          surface_totale_declaree_ha?: number | null
          surface_totale_ha?: number | null
          telephone?: string
          temoin_proprietaire_nom?: string | null
          temoin_proprietaire_qualite?: string | null
          type_piece?: string | null
          type_proprietaire?: string | null
          updated_at?: string | null
          updated_by?: string | null
          village?: string | null
          voisin_1_cote?: string | null
          voisin_1_nom?: string | null
          voisin_2_cote?: string | null
          voisin_2_nom?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proprietaires_terres_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proprietaires_terres_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proprietaires_terres_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proprietaires_terres_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          attempts: number
          blocked_until: string | null
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          action?: string
          attempts?: number
          blocked_until?: string | null
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          action?: string
          attempts?: number
          blocked_until?: string | null
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string | null
          created_at: string | null
          district_id: string | null
          est_active: boolean | null
          id: string
          nom: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          district_id?: string | null
          est_active?: boolean | null
          id?: string
          nom: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          district_id?: string | null
          est_active?: boolean | null
          id?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      remboursements: {
        Row: {
          created_at: string | null
          date_traitement: string | null
          id: string
          mode_remboursement: string | null
          montant: number
          motif: string | null
          numero_compte: string | null
          paiement_id: string | null
          souscripteur_id: string | null
          statut: string | null
          traite_par: string | null
        }
        Insert: {
          created_at?: string | null
          date_traitement?: string | null
          id?: string
          mode_remboursement?: string | null
          montant: number
          motif?: string | null
          numero_compte?: string | null
          paiement_id?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          traite_par?: string | null
        }
        Update: {
          created_at?: string | null
          date_traitement?: string | null
          id?: string
          mode_remboursement?: string | null
          montant?: number
          motif?: string | null
          numero_compte?: string | null
          paiement_id?: string | null
          souscripteur_id?: string | null
          statut?: string | null
          traite_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remboursements_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_souscripteur_id_fkey"
            columns: ["souscripteur_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      retraits_portefeuille: {
        Row: {
          created_at: string | null
          date_demande: string | null
          date_traitement: string | null
          id: string
          mode_paiement: string | null
          montant: number
          numero_compte: string | null
          portefeuille_id: string | null
          statut: string | null
          traite_par: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date_demande?: string | null
          date_traitement?: string | null
          id?: string
          mode_paiement?: string | null
          montant: number
          numero_compte?: string | null
          portefeuille_id?: string | null
          statut?: string | null
          traite_par?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date_demande?: string | null
          date_traitement?: string | null
          id?: string
          mode_paiement?: string | null
          montant?: number
          numero_compte?: string | null
          portefeuille_id?: string | null
          statut?: string | null
          traite_par?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retraits_portefeuille_portefeuille_id_fkey"
            columns: ["portefeuille_id"]
            isOneToOne: false
            referencedRelation: "portefeuilles"
            referencedColumns: ["id"]
          },
        ]
      }
      sous_prefectures: {
        Row: {
          code: string | null
          code_sp: string | null
          created_at: string | null
          departement_id: string | null
          est_active: boolean | null
          id: string
          nom: string
          sp_assigned_at: string | null
        }
        Insert: {
          code?: string | null
          code_sp?: string | null
          created_at?: string | null
          departement_id?: string | null
          est_active?: boolean | null
          id?: string
          nom: string
          sp_assigned_at?: string | null
        }
        Update: {
          code?: string | null
          code_sp?: string | null
          created_at?: string | null
          departement_id?: string | null
          est_active?: boolean | null
          id?: string
          nom?: string
          sp_assigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sous_prefectures_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
        ]
      }
      souscripteurs: {
        Row: {
          annee_contrat: number | null
          banque_operateur: string | null
          civilite: string | null
          code_sp_contrat: string | null
          compte_actif: boolean
          contrat_debut_at: string | null
          contrat_fin_at: string | null
          created_at: string | null
          created_by: string | null
          da_paye_at: string | null
          date_delivrance_piece: string | null
          date_naissance: string | null
          departement_id: string | null
          district_id: string | null
          documents_valides_at: string | null
          domicile: string | null
          domicile_residence: string | null
          email: string | null
          fichier_piece_recto_url: string | null
          fichier_piece_url: string | null
          fichier_piece_verso_url: string | null
          id: string
          id_unique: string | null
          jours_contrat_total: number
          jours_payes: number
          jours_retard: number
          lieu_naissance: string | null
          localite: string | null
          mensualite_montant: number | null
          montant_promo_applique: number
          montant_total_contrat: number
          nationalite: string | null
          nom: string | null
          nom_complet: string | null
          nom_famille: string | null
          nom_titulaire_compte: string | null
          nombre_plantations: number | null
          numero_compte: string | null
          numero_contrat: string | null
          numero_ordre_global: number | null
          numero_piece: string | null
          offre_id: string | null
          parcelle_id: string | null
          phase_actuelle: string
          photo_profil_url: string | null
          prenoms: string | null
          prochaine_echeance: string | null
          promotion_id: string | null
          region_id: string | null
          sous_prefecture_id: string | null
          statut: string | null
          statut_global: string | null
          statut_marital: string | null
          taux_journalier_ha: number
          telephone: string
          total_hectares: number | null
          type_compte: string | null
          type_piece: string | null
          type_souscripteur: string | null
          type_souscripteur_foncier: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          annee_contrat?: number | null
          banque_operateur?: string | null
          civilite?: string | null
          code_sp_contrat?: string | null
          compte_actif?: boolean
          contrat_debut_at?: string | null
          contrat_fin_at?: string | null
          created_at?: string | null
          created_by?: string | null
          da_paye_at?: string | null
          date_delivrance_piece?: string | null
          date_naissance?: string | null
          departement_id?: string | null
          district_id?: string | null
          documents_valides_at?: string | null
          domicile?: string | null
          domicile_residence?: string | null
          email?: string | null
          fichier_piece_recto_url?: string | null
          fichier_piece_url?: string | null
          fichier_piece_verso_url?: string | null
          id?: string
          id_unique?: string | null
          jours_contrat_total?: number
          jours_payes?: number
          jours_retard?: number
          lieu_naissance?: string | null
          localite?: string | null
          mensualite_montant?: number | null
          montant_promo_applique?: number
          montant_total_contrat?: number
          nationalite?: string | null
          nom?: string | null
          nom_complet?: string | null
          nom_famille?: string | null
          nom_titulaire_compte?: string | null
          nombre_plantations?: number | null
          numero_compte?: string | null
          numero_contrat?: string | null
          numero_ordre_global?: number | null
          numero_piece?: string | null
          offre_id?: string | null
          parcelle_id?: string | null
          phase_actuelle?: string
          photo_profil_url?: string | null
          prenoms?: string | null
          prochaine_echeance?: string | null
          promotion_id?: string | null
          region_id?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          statut_global?: string | null
          statut_marital?: string | null
          taux_journalier_ha?: number
          telephone: string
          total_hectares?: number | null
          type_compte?: string | null
          type_piece?: string | null
          type_souscripteur?: string | null
          type_souscripteur_foncier?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          annee_contrat?: number | null
          banque_operateur?: string | null
          civilite?: string | null
          code_sp_contrat?: string | null
          compte_actif?: boolean
          contrat_debut_at?: string | null
          contrat_fin_at?: string | null
          created_at?: string | null
          created_by?: string | null
          da_paye_at?: string | null
          date_delivrance_piece?: string | null
          date_naissance?: string | null
          departement_id?: string | null
          district_id?: string | null
          documents_valides_at?: string | null
          domicile?: string | null
          domicile_residence?: string | null
          email?: string | null
          fichier_piece_recto_url?: string | null
          fichier_piece_url?: string | null
          fichier_piece_verso_url?: string | null
          id?: string
          id_unique?: string | null
          jours_contrat_total?: number
          jours_payes?: number
          jours_retard?: number
          lieu_naissance?: string | null
          localite?: string | null
          mensualite_montant?: number | null
          montant_promo_applique?: number
          montant_total_contrat?: number
          nationalite?: string | null
          nom?: string | null
          nom_complet?: string | null
          nom_famille?: string | null
          nom_titulaire_compte?: string | null
          nombre_plantations?: number | null
          numero_compte?: string | null
          numero_contrat?: string | null
          numero_ordre_global?: number | null
          numero_piece?: string | null
          offre_id?: string | null
          parcelle_id?: string | null
          phase_actuelle?: string
          photo_profil_url?: string | null
          prenoms?: string | null
          prochaine_echeance?: string | null
          promotion_id?: string | null
          region_id?: string | null
          sous_prefecture_id?: string | null
          statut?: string | null
          statut_global?: string | null
          statut_marital?: string | null
          taux_journalier_ha?: number
          telephone?: string
          total_hectares?: number | null
          type_compte?: string | null
          type_piece?: string | null
          type_souscripteur?: string | null
          type_souscripteur_foncier?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "souscripteurs_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "offres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "v_prix_effectif_offres"
            referencedColumns: ["offre_id"]
          },
          {
            foreignKeyName: "souscripteurs_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      souscription_lots: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_attribution: string | null
          id: string
          lot_id: string
          notes: string | null
          souscripteur_id: string
          surface_ha: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_attribution?: string | null
          id?: string
          lot_id: string
          notes?: string | null
          souscripteur_id: string
          surface_ha?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_attribution?: string | null
          id?: string
          lot_id?: string
          notes?: string | null
          souscripteur_id?: string
          surface_ha?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "souscription_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots_hectares"
            referencedColumns: ["id"]
          },
        ]
      }
      souscriptions_brouillon: {
        Row: {
          created_at: string | null
          created_by: string
          donnees: Json | null
          etape_actuelle: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          donnees?: Json | null
          etape_actuelle?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          donnees?: Json | null
          etape_actuelle?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tickets_techniques: {
        Row: {
          assigne_a: string | null
          created_at: string | null
          cree_par: string | null
          date_resolution: string | null
          description: string | null
          id: string
          plantation_id: string | null
          priorite: string | null
          statut: string | null
          titre: string
          updated_at: string | null
        }
        Insert: {
          assigne_a?: string | null
          created_at?: string | null
          cree_par?: string | null
          date_resolution?: string | null
          description?: string | null
          id?: string
          plantation_id?: string | null
          priorite?: string | null
          statut?: string | null
          titre: string
          updated_at?: string | null
        }
        Update: {
          assigne_a?: string | null
          created_at?: string | null
          cree_par?: string | null
          date_resolution?: string | null
          description?: string | null
          id?: string
          plantation_id?: string | null
          priorite?: string | null
          statut?: string | null
          titre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_techniques_assigne_a_fkey"
            columns: ["assigne_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_techniques_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_techniques_plantation_id_fkey"
            columns: ["plantation_id"]
            isOneToOne: false
            referencedRelation: "plantations"
            referencedColumns: ["id"]
          },
        ]
      }
      transferts_paiements: {
        Row: {
          created_at: string | null
          effectue_par: string | null
          id: string
          montant: number
          motif: string | null
          souscripteur_dest_id: string | null
          souscripteur_source_id: string | null
          statut: string | null
        }
        Insert: {
          created_at?: string | null
          effectue_par?: string | null
          id?: string
          montant: number
          motif?: string | null
          souscripteur_dest_id?: string | null
          souscripteur_source_id?: string | null
          statut?: string | null
        }
        Update: {
          created_at?: string | null
          effectue_par?: string | null
          id?: string
          montant?: number
          motif?: string | null
          souscripteur_dest_id?: string | null
          souscripteur_source_id?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferts_dest_id_fkey"
            columns: ["souscripteur_dest_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferts_dest_id_fkey"
            columns: ["souscripteur_dest_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
          {
            foreignKeyName: "transferts_paiements_souscripteur_dest_id_fkey"
            columns: ["souscripteur_dest_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferts_paiements_souscripteur_dest_id_fkey"
            columns: ["souscripteur_dest_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
          {
            foreignKeyName: "transferts_paiements_souscripteur_source_id_fkey"
            columns: ["souscripteur_source_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferts_paiements_souscripteur_source_id_fkey"
            columns: ["souscripteur_source_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
          {
            foreignKeyName: "transferts_source_id_fkey"
            columns: ["souscripteur_source_id"]
            isOneToOne: false
            referencedRelation: "souscripteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferts_source_id_fkey"
            columns: ["souscripteur_source_id"]
            isOneToOne: false
            referencedRelation: "v_souscripteur_synthese"
            referencedColumns: ["souscripteur_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      villages: {
        Row: {
          created_at: string | null
          est_actif: boolean | null
          id: string
          nom: string
          sous_prefecture_id: string | null
        }
        Insert: {
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          nom: string
          sous_prefecture_id?: string | null
        }
        Update: {
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string
          sous_prefecture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "villages_sous_prefecture_id_fkey"
            columns: ["sous_prefecture_id"]
            isOneToOne: false
            referencedRelation: "sous_prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_assignments: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          user_id: string
          zone_id: string
          zone_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id: string
          zone_id: string
          zone_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id?: string
          zone_id?: string
          zone_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_prix_effectif_offres: {
        Row: {
          code: string | null
          di_base: number | null
          di_effectif: number | null
          nom: string | null
          offre_id: string | null
          total_base: number | null
          total_effectif: number | null
        }
        Insert: {
          code?: string | null
          di_base?: never
          di_effectif?: never
          nom?: string | null
          offre_id?: string | null
          total_base?: number | null
          total_effectif?: never
        }
        Update: {
          code?: string | null
          di_base?: never
          di_effectif?: never
          nom?: string | null
          offre_id?: string | null
          total_base?: number | null
          total_effectif?: never
        }
        Relationships: []
      }
      v_souscripteur_synthese: {
        Row: {
          compte_actif: boolean | null
          contrat_debut_at: string | null
          contrat_fin_at: string | null
          duree_paiement_mois: number | null
          gestion_type: string | null
          id_unique: string | null
          jours_retard: number | null
          mois_payes: number | null
          mois_restants: number | null
          montant_total_contrat: number | null
          nom_complet: string | null
          offre_id: string | null
          offre_nom: string | null
          phase_actuelle: string | null
          pourcentage_avancement: number | null
          pourcentage_revenus_reverses: number | null
          prochaine_echeance: string | null
          reste_a_payer: number | null
          souscripteur_id: string | null
          taux_journalier_ha: number | null
          total_hectares: number | null
          total_paye: number | null
        }
        Relationships: [
          {
            foreignKeyName: "souscripteurs_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "offres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscripteurs_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "v_prix_effectif_offres"
            referencedColumns: ["offre_id"]
          },
        ]
      }
    }
    Functions: {
      assign_sp_code: { Args: { _sp_id: string }; Returns: string }
      can_supervise_leads: { Args: { _user_id: string }; Returns: boolean }
      cleanup_expired_otp: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      compute_commission_for_paiement: {
        Args: { p_paiement_id: string }
        Returns: undefined
      }
      create_depot_initial: {
        Args: { _souscripteur_id: string }
        Returns: string
      }
      current_profile_id: { Args: never; Returns: string }
      finalize_portal_payment: {
        Args: {
          _metadata?: Json
          _paiement_id: string
          _provider_amount?: number
          _transaction_id?: string
          _validated_at?: string
        }
        Returns: Json
      }
      generate_parcelle_id: { Args: never; Returns: string }
      generate_plantation_id: { Args: never; Returns: string }
      generate_proprietaire_id: { Args: never; Returns: string }
      generate_souscripteur_id: { Args: never; Returns: string }
      get_subscriber_effective_di: {
        Args: { _souscripteur_id: string }
        Returns: number
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_demo: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_overdue_payments: { Args: never; Returns: undefined }
      notify_hierarchy: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      reassign_lead: {
        Args: { _lead_id: string; _motif?: string; _new_owner: string }
        Returns: undefined
      }
      recompute_contrat_totaux: {
        Args: { _souscripteur_id: string }
        Returns: undefined
      }
      recompute_pending_di: { Args: never; Returns: undefined }
      resolve_username_email: { Args: { _username: string }; Returns: string }
      simuler_paiement_fractionne: {
        Args: { _montant: number; _souscripteur_id: string }
        Returns: {
          jours_couverts: number
          periode_debut: string
          periode_fin: string
          phase: string
          taux_journalier: number
        }[]
      }
      username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
