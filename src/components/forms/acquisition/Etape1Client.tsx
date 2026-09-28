import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileUploadVisual } from "@/components/ui/file-upload-visual";
import CountryPhoneInput from "@/components/common/CountryPhoneInput";
import PieceTypeSelect from "@/components/common/PieceTypeSelect";

// Validation helpers
const validatePhone = (phone: string) => /^\d{6,15}$/.test(phone.replace(/\D/g, ""));
const COUNTRY_CODES = [
  { code: "+225", label: "Côte d’Ivoire" }, { code: "+33", label: "France" }, { code: "+1", label: "USA / Canada" },
  { code: "+32", label: "Belgique" }, { code: "+41", label: "Suisse" }, { code: "+44", label: "Royaume-Uni" },
  { code: "+49", label: "Allemagne" }, { code: "+221", label: "Sénégal" }, { code: "+226", label: "Burkina Faso" },
  { code: "+223", label: "Mali" }, { code: "+224", label: "Guinée" }, { code: "+237", label: "Cameroun" },
  { code: "+228", label: "Togo" }, { code: "+229", label: "Bénin" }, { code: "+212", label: "Maroc" },
];
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateText = (text: string, minLength: number, maxLength: number) => 
  text && text.length >= minLength && text.length <= maxLength;

interface Etape1Props {
  formData: any;
  updateFormData: (data: any) => void;
}

export const Etape1Client = ({ formData, updateFormData }: Etape1Props) => {
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [sousPrefectures, setSousPrefectures] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [phoneCountry, setPhoneCountry] = useState(formData.telephone_indicatif || "+225");
  const [whatsappCountry, setWhatsappCountry] = useState(formData.whatsapp_indicatif || "+225");

  const handleFileChange = (field: string, file: File | null, preview: string) => {
    updateFormData({
      [`${field}_file`]: file,
      [`${field}_preview`]: preview,
    });
  };

  const validateField = (field: string, value: any) => {
    const errors = { ...validationErrors };
    
    switch(field) {
      case 'telephone':
      case 'whatsapp':
        if (value && !validatePhone(value)) {
          errors[field] = "Doit contenir entre 6 et 15 chiffres";
        } else {
          delete errors[field];
        }
        break;
      case 'email':
        if (value && !validateEmail(value)) {
          errors[field] = "Email invalide";
        } else {
          delete errors[field];
        }
        break;
      case 'nom_complet':
      case 'prenoms':
        if (!validateText(value, 2, 100)) {
          errors[field] = "Doit contenir entre 2 et 100 caractères";
        } else {
          delete errors[field];
        }
        break;
    }
    
    setValidationErrors(errors);
  };

  const handlePhoneChange = (field: "telephone" | "whatsapp", value: string, country: string) => {
    const local = value.replace(/\D/g, "").replace(/^0+/, "");
    const formatted = local ? country + local : "";
    updateFormData({ [field]: formatted, [field + "_indicatif"]: country, [field + "_local"]: local });
    validateField(field, local);
  };

  const handleInputChange = (field: string, value: any) => {
    updateFormData({ [field]: value });
    validateField(field, value);
  };

  // Charger les districts
  useEffect(() => {
    const fetchDistricts = async () => {
      const { data } = await (supabase as any)
        .from("districts")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (data) setDistricts(data);
    };
    fetchDistricts();
  }, []);

  // Charger régions quand district change
  useEffect(() => {
    if (formData.district_id) {
      const fetchRegions = async () => {
        const { data } = await (supabase as any)
          .from("v_geo_regions")
          .select("*")
          .eq("district_id", formData.district_id)
          .eq("est_active_effectif", true)
          .order("nom");
        if (data) setRegions(data);
      };
      fetchRegions();
    }
  }, [formData.district_id]);

  // Charger départements quand région change
  useEffect(() => {
    if (formData.region_id) {
      const fetchDepartements = async () => {
        const { data } = await (supabase as any)
          .from("v_geo_departements")
          .select("*")
          .eq("region_id", formData.region_id)
          .eq("est_active_effectif", true)
          .order("nom");
        if (data) setDepartements(data);
      };
      fetchDepartements();
    }
  }, [formData.region_id]);

  // Charger sous-préfectures quand département change
  useEffect(() => {
    if (formData.departement_id) {
      const fetchSousPrefectures = async () => {
        const { data } = await (supabase as any)
          .from("v_geo_sous_prefectures")
          .select("*")
          .eq("departement_id", formData.departement_id)
          .eq("est_active_effectif", true)
          .order("nom");
        if (data) setSousPrefectures(data);
      };
      fetchSousPrefectures();
    }
  }, [formData.departement_id]);


  useEffect(() => { if (!formData.sous_prefecture_id) { setVillages([]); return; } (async()=>{const {data}=await (supabase as any).from("v_geo_villages").select("id,nom").eq("sous_prefecture_id",formData.sous_prefecture_id).eq("est_actif_effectif",true).order("nom");setVillages(data||[]);})(); }, [formData.sous_prefecture_id]);\n\n  const [parcelles, setParcelles] = useState<any[]>([]);
  const [parcelleSearch, setParcelleSearch] = useState("");
  const [loadingParcelles, setLoadingParcelles] = useState(false);

  // Load available parcelles for sans_terre
  useEffect(() => {
    if (formData.type_client === "sans_terre" || !formData.type_client) {
      const fetchParcelles = async () => {
        setLoadingParcelles(true);
        let query = (supabase as any)
          .from("parcelles")
          .select("id, id_unique, nom, surface_disponible_ha, village, region_id, departement_id")
          .gt("surface_disponible_ha", 0)
          .in("statut", ["disponible", "partiellement_attribuee"])
          .order("id_unique")
          .limit(50);
        
        if (parcelleSearch) {
          query = query.or(`id_unique.ilike.%${parcelleSearch}%,nom.ilike.%${parcelleSearch}%,village.ilike.%${parcelleSearch}%`);
        }
        
        const { data } = await query;
        setParcelles(data || []);
        setLoadingParcelles(false);
      };
      fetchParcelles();
    }
  }, [formData.type_client, parcelleSearch]);

  return (
    <div className="space-y-6">
      {/* Type de client */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Type de Client</CardTitle>
          <CardDescription>Choisissez le profil du client</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateFormData({ type_client: "sans_terre", parcelle_id: null })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                formData.type_client === "sans_terre" || !formData.type_client
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold">Sans terre</div>
              <p className="text-sm text-muted-foreground mt-1">
                Offres PalmInvest / PalmInvest+ — AgriCapital fournit la terre
              </p>
            </button>
            <button
              type="button"
              onClick={() => updateFormData({ type_client: "avec_terre", parcelle_id: null })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                formData.type_client === "avec_terre"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold">Avec terre</div>
              <p className="text-sm text-muted-foreground mt-1">
                Offres TerraPalm / TerraPalm+ — Le client fournit sa propre terre
              </p>
            </button>
          </div>

          {/* Parcelle search for sans_terre */}
          {(formData.type_client === "sans_terre" || !formData.type_client) && (
            <div className="mt-4 space-y-3">
              <Label>Parcelle disponible (recherche multicritère)</Label>
              <Input
                placeholder="Rechercher par ID, nom, village..."
                value={parcelleSearch}
                onChange={(e) => setParcelleSearch(e.target.value)}
              />
              <Select
                value={formData.parcelle_id || ""}
                onValueChange={(v) => updateFormData({ parcelle_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingParcelles ? "Chargement..." : "Sélectionner une parcelle"} />
                </SelectTrigger>
                <SelectContent>
                  {parcelles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.id_unique} — {p.nom || p.village || "Sans nom"} ({p.surface_disponible_ha} ha dispo)
                    </SelectItem>
                  ))}
                  {parcelles.length === 0 && !loadingParcelles && (
                    <div className="p-2 text-sm text-muted-foreground text-center">Aucune parcelle disponible</div>
                  )}
                </SelectContent>
              </Select>*/}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identité du Client</CardTitle>
          <CardDescription>Informations personnelles obligatoires</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="civilite">Civilité *</Label>
              <Select
                value={formData.civilite}
                onValueChange={(value) => updateFormData({ civilite: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">M.</SelectItem>
                  <SelectItem value="Mme">Mme</SelectItem>
                  <SelectItem value="Mlle">Mlle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nom_famille">Nom de famille *</Label>
              <Input
                id="nom_famille"
                value={formData.nom_famille}
                onChange={(e) => updateFormData({ nom_famille: e.target.value })}
                placeholder="KOFFI"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prenoms">Prénoms *</Label>
              <Input
                id="prenoms"
                value={formData.prenoms}
                onChange={(e) => handleInputChange('prenoms', e.target.value)}
                placeholder="Inocent"
                required
              />
              {validationErrors.prenoms && <p className="text-sm text-destructive mt-1">{validationErrors.prenoms}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_naissance">Date de naissance *</Label>
              <Input
                id="date_naissance"
                type="date"
                value={formData.date_naissance}
                onChange={(e) => updateFormData({ date_naissance: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lieu_naissance">Lieu de naissance *</Label>
              <Input
                id="lieu_naissance"
                value={formData.lieu_naissance}
                onChange={(e) => updateFormData({ lieu_naissance: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statut_marital">Situation matrimoniale *</Label>
            <Select
              value={formData.statut_marital}
              onValueChange={(value) => updateFormData({ statut_marital: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="celibataire">Célibataire</SelectItem>
                <SelectItem value="marie">Marié(e)</SelectItem>
                <SelectItem value="divorce">Divorcé(e)</SelectItem>
                <SelectItem value="veuf">Veuf(ve)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pièce d'identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label htmlFor="type_piece">Type de pièce *</Label><PieceTypeSelect value={formData.type_piece} onChange={(value)=>updateFormData({type_piece:value})}/></div>
            <div className="space-y-2"><Label htmlFor="numero_piece">Numéro de pièce *</Label><Input id="numero_piece" value={formData.numero_piece} onChange={(e)=>updateFormData({numero_piece:e.target.value})} required/></div>
            <div className="space-y-2"><Label htmlFor="date_delivrance_piece">Date de délivrance *</Label><Input id="date_delivrance_piece" type="date" value={formData.date_delivrance_piece} onChange={(e)=>updateFormData({date_delivrance_piece:e.target.value})} required/></div>
          </div>
          <FileUploadVisual label="Photo de la pièce - Recto" field="photo_piece_recto" accept="image/*" required currentFile={formData.photo_piece_recto_file||null} currentPreview={formData.photo_piece_recto_preview||""} onFileChange={handleFileChange} onIdentityNumberDetected={n=>updateFormData({numero_piece:n})} identityDocumentType={formData.type_piece}/>
          <FileUploadVisual label="Photo de la pièce - Verso" field="photo_piece_verso" accept="image/*" required currentFile={formData.photo_piece_verso_file||null} currentPreview={formData.photo_piece_verso_preview||""} onFileChange={handleFileChange}/>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localisation et Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Structure administrative */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>District *</Label><SearchableSelect value={formData.district_id} onValueChange={(v)=>{updateFormData({district_id:v,region_id:null,departement_id:null,sous_prefecture_id:null,village_id:null});setRegions([]);setDepartements([]);setSousPrefectures([]);}} options={districts.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner le district" searchPlaceholder="Rechercher un district..." /></div>
            <div className="space-y-2"><Label>Région *</Label><SearchableSelect value={formData.region_id} onValueChange={(v)=>{updateFormData({region_id:v,departement_id:null,sous_prefecture_id:null,village_id:null});setDepartements([]);setSousPrefectures([]);}} disabled={!formData.district_id} options={regions.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner la région" searchPlaceholder="Rechercher une région..." /></div>
            <div className="space-y-2"><Label>Département *</Label><SearchableSelect value={formData.departement_id} onValueChange={(v)=>{updateFormData({departement_id:v,sous_prefecture_id:null,village_id:null});setSousPrefectures([]);}} disabled={!formData.region_id} options={departements.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner le département" searchPlaceholder="Rechercher un département..." /></div>
            <div className="space-y-2"><Label>Sous-préfecture *</Label><SearchableSelect value={formData.sous_prefecture_id} onValueChange={(v)=>updateFormData({sous_prefecture_id:v,village_id:null})} disabled={!formData.departement_id} options={sousPrefectures.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner la sous-préfecture" searchPlaceholder="Rechercher une sous-préfecture..." /></div>
            <div className="space-y-2"><Label>Village / localité *</Label><SearchableSelect value={formData.village_id} onValueChange={(v)=>updateFormData({village_id:v})} disabled={!formData.sous_prefecture_id} options={villages.map(x=>({value:x.id,label:x.nom}))} placeholder="Sélectionner le village / la localité" searchPlaceholder="Rechercher un village..." /></div>
          <div className="space-y-2">
              <Label htmlFor="region">Région *</Label>
              <Select
                value={formData.region_id}
                onValueChange={(value) => {
                  updateFormData({ region_id: value, departement_id: null, sous_prefecture_id: null, village_id: null });
                  setDepartements([]);
                  setSousPrefectures([]);
                }}
                disabled={!formData.district_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner la région" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departement">Département *</Label>
              <Select
                value={formData.departement_id}
                onValueChange={(value) => {
                  updateFormData({ departement_id: value, sous_prefecture_id: null, village_id: null });
                  setSousPrefectures([]);
                }}
                disabled={!formData.region_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le département" />
                </SelectTrigger>
                <SelectContent>
                  {departements.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sous_prefecture">Sous-préfecture *</Label>
              <Select
                value={formData.sous_prefecture_id}
                onValueChange={(value) => updateFormData({ sous_prefecture_id: value, village_id: null })}
                disabled={!formData.departement_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner la sous-préfecture" />
                </SelectTrigger>
                <SelectContent>
                  {sousPrefectures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domicile">Adresse complète du domicile *</Label>
            <Input
              id="domicile"
              value={formData.domicile}
              onChange={(e) => updateFormData({ domicile: e.target.value })}
              placeholder="Quartier, rue, indication précise..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["telephone","whatsapp"] as const).map((field) => {
              const isPhone = field === "telephone";
              const country = isPhone ? phoneCountry : whatsappCountry;
              const setCountry = isPhone ? setPhoneCountry : setWhatsappCountry;
              const local = formData[field + "_local"] || String(formData[field] || "").replace(/^\+\d{1,4}/, "");
              return (
                <div className="space-y-2" key={field}>
                  <Label htmlFor={field}>{isPhone ? "Téléphone *" : "WhatsApp *"}</Label>
                  <div className="flex gap-2">
                    <Select value={country} onValueChange={(v) => { setCountry(v); handlePhoneChange(field, local, v); }}>
                      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{COUNTRY_CODES.map(c => <SelectItem key={c.code} value={c.code}>{c.code} · {c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input id={field} type="tel" value={local} onChange={(e) => handlePhoneChange(field, e.target.value, country)} placeholder="Numéro local" required />
                  </div>
                  <p className="text-xs text-muted-foreground">Enregistré au format international : {country}{local || "…"}</p>
                  {validationErrors[field] && <p className="text-sm text-destructive mt-1">{validationErrors[field]}</p>}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optionnel)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="exemple@email.com"
            />
            {validationErrors.email && <p className="text-sm text-destructive mt-1">{validationErrors.email}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations Financières</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CountryPhoneInput label="Téléphone" required countryCode={formData.telephone_indicatif||"+225"} localValue={formData.telephone_local||""} onChange={v=>updateFormData({telephone_indicatif:v.callingCode,telephone_local:v.localValue,telephone:v.internationalValue})}/>
            <CountryPhoneInput label="WhatsApp" countryCode={formData.whatsapp_indicatif||"+225"} localValue={formData.whatsapp_local||""} onChange={v=>updateFormData({whatsapp_indicatif:v.callingCode,whatsapp_local:v.localValue,whatsapp:v.internationalValue})}/>
          </div>

          <div className="space-y-2">
              <Label htmlFor="type_compte">Type de compte *</Label>
              <Select
                value={formData.type_compte}
                onValueChange={(value) => updateFormData({ type_compte: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bancaire">Bancaire</SelectItem>
                  <SelectItem value="Microfinance">Microfinance</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banque_operateur">Banque/Opérateur *</Label>
              <Input
                id="banque_operateur"
                value={formData.banque_operateur}
                onChange={(e) => updateFormData({ banque_operateur: e.target.value })}
                placeholder="Ex: MTN, Orange, SGCI..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_compte">Numéro de compte *</Label>
              <Input
                id="numero_compte"
                value={formData.numero_compte}
                onChange={(e) => updateFormData({ numero_compte: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nom_beneficiaire">Nom du bénéficiaire *</Label>
              <Input
                id="nom_beneficiaire"
                value={formData.nom_beneficiaire}
                onChange={(e) => updateFormData({ nom_beneficiaire: e.target.value })}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};