// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoGreen from "@/assets/logo-green.png";
import { User, Mail, Phone, Briefcase, MapPin, FileText, Camera, Upload } from "lucide-react";

const ROLES = [
  { value: "technico_commercial", label: "Technico-commercial" },
  { value: "chef_equipe", label: "Chef d'équipe" },
  { value: "responsable_zone", label: "Responsable de zone" },
  { value: "agent_terrain", label: "Agent terrain" },
  { value: "comptable", label: "Comptable" },
  { value: "support", label: "Support" }
];

const AccountRequest = () => {
  const [formData, setFormData] = useState({
    nom_complet: "",
    email: "",
    telephone: "",
    poste: "",
    region: "",
    departement: "",
    district: "",
    message: ""
  });
  
  const [regions, setRegions] = useState<any[]>([]);
  const [departements, setDepartements] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch regions on mount
  useEffect(() => {
    const fetchRegions = async () => {
      const { data } = await supabase.from('regions').select('*').order('nom');
      setRegions(data || []);
    };
    fetchRegions();
  }, []);

  // Fetch districts when region changes
  useEffect(() => {
    const fetchDistricts = async () => {
      if (formData.region) {
        const { data } = await supabase
          .from('districts')
          .select('*')
          .eq('region_id', formData.region)
          .order('nom');
        setDistricts(data || []);
        setFormData(prev => ({ ...prev, district: "", departement: "" }));
        setDepartements([]);
      } else {
        setDistricts([]);
      }
    };
    fetchDistricts();
  }, [formData.region]);

  // Fetch departements when district changes
  useEffect(() => {
    const fetchDepartements = async () => {
      if (formData.district) {
        const { data } = await supabase
          .from('departements')
          .select('*')
          .eq('district_id', formData.district)
          .order('nom');
        setDepartements(data || []);
        setFormData(prev => ({ ...prev, departement: "" }));
      } else {
        setDepartements([]);
      }
    };
    fetchDepartements();
  }, [formData.district]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!photoFile) {
      toast({
        variant: "destructive",
        title: "Photo requise",
        description: "Veuillez ajouter une photo de profil",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let photoUrl = null;
      let cvUrl = null;

      // Upload photo
      const photoPath = `account-requests/${Date.now()}-photo-${photoFile.name}`;
      const { error: photoError } = await supabase.storage
        .from('documents')
        .upload(photoPath, photoFile);

      if (photoError) throw photoError;

      const { data: photoData } = supabase.storage
        .from('documents')
        .getPublicUrl(photoPath);
      photoUrl = photoData.publicUrl;

      // Upload CV if provided
      if (cvFile) {
        const cvPath = `account-requests/${Date.now()}-cv-${cvFile.name}`;
        const { error: cvError } = await supabase.storage
          .from('documents')
          .upload(cvPath, cvFile);

        if (cvError) throw cvError;

        const { data: cvData } = supabase.storage
          .from('documents')
          .getPublicUrl(cvPath);
        cvUrl = cvData.publicUrl;
      }

      // Get region/department/district names for storage
      const regionName = regions.find(r => r.id === formData.region)?.nom || "";
      const deptName = departements.find(d => d.id === formData.departement)?.nom || "";
      const districtName = districts.find(d => d.id === formData.district)?.nom || "";

      // Create account request
      const { error } = await supabase
        .from('account_requests')
        .insert({
          nom_complet: formData.nom_complet,
          email: formData.email,
          telephone: formData.telephone,
          poste: formData.poste,
          region: regionName,
          departement: deptName,
          district: districtName,
          message: formData.message,
          photo_url: photoUrl,
          cv_url: cvUrl,
          status: 'en_attente'
        });

      if (error) throw error;

      // Try to send notification (non-blocking)
      try {
        await supabase.functions.invoke('send-account-request-notification', {
          body: { requestData: { ...formData, region: regionName, departement: deptName } }
        });
      } catch (notifError) {
        console.log('Notification error (non-blocking):', notifError);
      }

      toast({
        title: "Demande envoyée",
        description: "Votre demande sera examinée par l'administrateur.",
      });

      navigate('/login');
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la demande",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-primary-hover p-3 sm:p-4">
      <Card className="w-full max-w-[95%] sm:max-w-2xl shadow-strong my-4">
        <CardHeader className="text-center px-4 sm:px-6 pb-4">
          <div className="flex justify-center mb-2 sm:mb-4">
            <img src={logoGreen} alt="AgriCapital Logo" className="h-16 sm:h-24 w-auto" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Demande de Création de Compte</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Remplissez ce formulaire pour demander un accès à AgriCapital
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Photo de profil - En premier et obligatoire */}
            <div className="flex flex-col items-center space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photo de profil *
              </Label>
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-full border-4 border-primary"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted">
                    <User className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50" />
                  </div>
                )}
                <label htmlFor="photo" className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90">
                  <Camera className="h-4 w-4" />
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">Cliquez sur l'icône pour ajouter votre photo</p>
            </div>

            {/* Informations personnelles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nom_complet" className="text-sm flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Nom complet *
                </Label>
                <Input
                  id="nom_complet"
                  required
                  className="h-10"
                  value={formData.nom_complet}
                  onChange={(e) => setFormData({...formData, nom_complet: e.target.value})}
                  placeholder="Ex: KOUASSI Jean"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  className="h-10"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="votre@email.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telephone" className="text-sm flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> Téléphone *
                </Label>
                <Input
                  id="telephone"
                  type="tel"
                  required
                  className="h-10"
                  value={formData.telephone}
                  onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                  placeholder="07 XX XX XX XX"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="poste" className="text-sm flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" /> Poste souhaité *
                </Label>
                <Select
                  value={formData.poste}
                  onValueChange={(value) => setFormData({...formData, poste: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sélectionner un poste" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Localisation */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Localisation
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  value={formData.region}
                  onValueChange={(value) => setFormData({...formData, region: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Région" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={formData.departement}
                  onValueChange={(value) => setFormData({...formData, departement: value})}
                  disabled={!formData.region}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Département" />
                  </SelectTrigger>
                  <SelectContent>
                    {departements.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={formData.district}
                  onValueChange={(value) => setFormData({...formData, district: value})}
                  disabled={!formData.departement}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="District" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map(dist => (
                      <SelectItem key={dist.id} value={dist.id}>
                        {dist.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Message / Justification */}
            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-sm flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Message / Justification
              </Label>
              <Textarea
                id="message"
                rows={3}
                className="text-sm"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Expliquez pourquoi vous souhaitez rejoindre AgriCapital..."
              />
            </div>

            {/* CV Upload */}
            <div className="space-y-1.5">
              <Label htmlFor="cv" className="text-sm flex items-center gap-2">
                <Upload className="h-3.5 w-3.5" /> CV (optionnel)
              </Label>
              <Input
                id="cv"
                type="file"
                accept=".pdf,.doc,.docx"
                className="h-10 text-sm"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              />
              {cvFile && (
                <p className="text-xs text-muted-foreground">Fichier sélectionné: {cvFile.name}</p>
              )}
            </div>

            {/* Boutons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/login')}
                className="flex-1 h-10 sm:h-11"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-10 sm:h-11"
              >
                {isSubmitting ? "Envoi en cours..." : "Envoyer la demande"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountRequest;
