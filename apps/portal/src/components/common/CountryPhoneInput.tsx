import { useMemo } from "react";
import { Input } from "@/components/ui/input";

type Country = { code: string; name: string; callingCode: string; flag: string };

const COUNTRIES: Country[] = [
  { code: "CI", name: "Côte d’Ivoire", callingCode: "+225", flag: "🇨🇮" },
  { code: "FR", name: "France", callingCode: "+33", flag: "🇫🇷" },
  { code: "US", name: "États-Unis", callingCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", callingCode: "+1", flag: "🇨🇦" },
  { code: "BE", name: "Belgique", callingCode: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Suisse", callingCode: "+41", flag: "🇨🇭" },
  { code: "GB", name: "Royaume-Uni", callingCode: "+44", flag: "🇬🇧" },
  { code: "SN", name: "Sénégal", callingCode: "+221", flag: "🇸🇳" },
  { code: "GN", name: "Guinée", callingCode: "+224", flag: "🇬🇳" },
  { code: "BF", name: "Burkina Faso", callingCode: "+226", flag: "🇧🇫" },
  { code: "ML", name: "Mali", callingCode: "+223", flag: "🇲🇱" },
  { code: "CM", name: "Cameroun", callingCode: "+237", flag: "🇨🇲" },
  { code: "TG", name: "Togo", callingCode: "+228", flag: "🇹🇬" },
  { code: "BJ", name: "Bénin", callingCode: "+229", flag: "🇧🇯" },
];

export interface CountryPhoneInputProps {
  label?: string;
  countryCode?: string;
  localValue?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: {
    countryCode: string;
    callingCode: string;
    localValue: string;
    internationalValue: string;
  }) => void;
}

export default function CountryPhoneInput({
  label,
  countryCode = "CI",
  localValue = "",
  required,
  disabled,
  onChange,
}: CountryPhoneInputProps) {
  const selected = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode || c.callingCode === countryCode) || COUNTRIES[0],
    [countryCode],
  );
  const max = selected.callingCode === "+225" ? 10 : 15;
  const min = selected.callingCode === "+225" ? 10 : 7;

  const emit = (country: Country, local: string) => {
    const digits = local.replace(/\D/g, "").slice(0, country.callingCode === "+225" ? 10 : 15);
    onChange({
      countryCode: country.code,
      callingCode: country.callingCode,
      localValue: digits,
      internationalValue: country.callingCode + digits,
    });
  };

  return (
    <div className="space-y-1.5 min-w-0">
      {label && <label className="text-sm font-medium">{label}{required ? " *" : ""}</label>}
      <div className="flex w-full min-w-0 gap-2">
        <select
          aria-label="Indicatif pays"
          value={selected.code}
          disabled={disabled}
          onChange={(e) => emit(COUNTRIES.find((c) => c.code === e.target.value) || COUNTRIES[0], localValue)}
          className="h-10 w-[92px] min-[390px]:w-[108px] sm:w-[122px] shrink-0 rounded-md border bg-background px-2 text-sm"
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.callingCode}
            </option>
          ))}
        </select>
        <Input
          className="min-w-0 flex-1"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={localValue}
          disabled={disabled}
          required={required}
          minLength={min}
          maxLength={max}
          placeholder={selected.callingCode === "+225" ? "10 chiffres" : "Numéro local"}
          onChange={(e) => emit(selected, e.target.value)}
        />
      </div>
    </div>
  );
}
