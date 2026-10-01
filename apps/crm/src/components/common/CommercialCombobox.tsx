import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { COMMERCIAL_ASSIGNABLE_ROLES, normalizeRole, roleLabel } from "@/lib/roles";

interface CommercialComboboxProps {
  value?: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Champ « Affecter à un commercial » : recherche instantanée + liste déroulante.
 * N'affiche que les utilisateurs actifs dont le rôle autorise réellement l'affectation.
 */
const CommercialCombobox = ({
  value,
  onChange,
  placeholder = "Rechercher ou sélectionner un commercial...",
  disabled,
}: CommercialComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ id: string; nom: string; roles: string[] }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: userRoles }] = await Promise.all([
        (supabase as any).from("profils_annuaire").select("id, user_id, nom_complet, email, actif").eq("actif", true).order("nom_complet"),
        (supabase as any).from("user_roles").select("user_id, role"),
      ]);

      const rolesByUser = new Map<string, string[]>();
      (userRoles || []).forEach((r: any) => {
        const code = normalizeRole(r.role);
        rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) || []), code]);
      });

      const list = (profiles || [])
        .map((p: any) => {
          const uid = p.user_id || p.id;
          return { id: uid, nom: p.nom_complet || p.email || "Sans nom", roles: rolesByUser.get(uid) || [] };
        })
        .filter((p: any) => p.roles.some((r: string) => COMMERCIAL_ASSIGNABLE_ROLES.includes(r)));

      setOptions(list);
    })();
  }, []);

  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("flex items-center gap-2 truncate", !selected && "text-muted-foreground")}>
            <Search className="h-4 w-4 shrink-0" />
            {selected ? selected.nom : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Saisir un nom (ex: Koffi...)" />
          <CommandList>
            <CommandEmpty>Aucun commercial correspondant.</CommandEmpty>
            <CommandGroup>
              {selected && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Retirer l'affectation
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.nom} ${o.roles.join(" ")}`}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.nom}</span>
                  {o.roles[0] && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {roleLabel(o.roles[0])}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CommercialCombobox;
