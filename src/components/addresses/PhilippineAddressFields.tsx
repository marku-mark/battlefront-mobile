import {
  getAddressByBarangayCode,
  getAllBarangays,
  getAllMunicipalities,
  getAllRegions,
  getBarangaysByMunicipality,
  getMunicipalitiesByProvince,
  getProvincesByRegion,
} from "@aivangogh/ph-address";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { PhilippineAddressFields as PhilippineAddressValue } from "@/lib/philippineAddress";

type LocationOption = { code: string; name: string };
type PhilippineAddressPatch = Partial<PhilippineAddressValue>;

const DIRECT_LOCALITY_CODE = "__direct_region_locality__";
const regionLocalityCache = new Map<string, LocationOption[]>();

function getRegionLevelLocalities(regionCode: string): LocationOption[] {
  if (!regionCode) return [];
  const cachedLocalities = regionLocalityCache.get(regionCode);
  if (cachedLocalities) return cachedLocalities;

  const localities = getAllMunicipalities().flatMap((municipality) => {
    if (municipality.provinceCode === regionCode) {
      return [{ code: municipality.psgcCode, name: municipality.name }];
    }
    if (municipality.provinceCode !== municipality.psgcCode) return [];

    const firstBarangay = getBarangaysByMunicipality(municipality.psgcCode)[0];
    const address = firstBarangay ? getAddressByBarangayCode(firstBarangay.psgcCode) : undefined;
    return address?.region.psgcCode === regionCode && !address.province
      ? [{ code: municipality.psgcCode, name: municipality.name }]
      : [];
  });
  regionLocalityCache.set(regionCode, localities);
  return localities;
}

export function PhilippineAddressFields({
  value,
  onChange,
}: {
  value: PhilippineAddressValue;
  onChange: (patch: PhilippineAddressPatch) => void;
}) {
  const { colors } = useTheme();
  const regions = useMemo(() => getAllRegions().map((region) => ({
    code: region.psgcCode,
    name: `${region.designation} (${region.name})`,
  })), []);
  const provinces = useMemo(() => value.regionCode
    ? getProvincesByRegion(value.regionCode).map((province) => ({ code: province.psgcCode, name: province.name }))
    : [], [value.regionCode]);
  const regionLocalities = useMemo(() => getRegionLevelLocalities(value.regionCode), [value.regionCode]);
  const cities = useMemo(() => value.provinceCode
    ? getMunicipalitiesByProvince(value.provinceCode).map((municipality) => ({ code: municipality.psgcCode, name: municipality.name }))
    : regionLocalities, [regionLocalities, value.provinceCode]);
  const barangays = useMemo(() => value.cityCode
    ? getBarangaysByMunicipality(value.cityCode).map((barangay) => ({ code: barangay.psgcCode, name: barangay.name }))
    : [], [value.cityCode]);
  const provinceChoices = useMemo(() => [
    ...provinces,
    ...(regionLocalities.length > 0
      ? [{ code: DIRECT_LOCALITY_CODE, name: "Independent city / no province" }]
      : []),
  ], [provinces, regionLocalities]);
  const provinceLabel = value.province
    || (value.localityParentCode === value.regionCode && value.regionCode ? "Independent city / no province" : "");

  function selectRegion(option: LocationOption) {
    const hasProvinceLevel = getProvincesByRegion(option.code).length > 0;
    onChange({
      region: option.name,
      regionCode: option.code,
      province: "",
      provinceCode: "",
      localityParentCode: hasProvinceLevel ? "" : option.code,
      city: "",
      cityCode: "",
      barangay: "",
      barangayCode: "",
      zipCode: "",
    });
  }

  function selectProvince(option: LocationOption) {
    const isDirectLocality = option.code === DIRECT_LOCALITY_CODE;
    onChange({
      province: isDirectLocality ? "" : option.name,
      provinceCode: isDirectLocality ? "" : option.code,
      localityParentCode: isDirectLocality ? value.regionCode : option.code,
      city: "",
      cityCode: "",
      barangay: "",
      barangayCode: "",
      zipCode: "",
    });
  }

  function selectCity(option: LocationOption) {
    onChange({
      city: option.name,
      cityCode: option.code,
      barangay: "",
      barangayCode: "",
      zipCode: "",
    });
  }

  function selectBarangay(option: LocationOption) {
    onChange({ barangay: option.name, barangayCode: option.code });
  }

  return (
    <View className="mt-2">
      <Text className="text-foreground text-sm font-semibold">Philippine address</Text>
      <Text className="mt-1 text-muted-foreground text-[11px]">Choose each location from the PSGC list, then enter your street and 4-digit ZIP code.</Text>

      <LocationPicker
        label="Region"
        value={value.region}
        placeholder="Select region"
        options={regions}
        disabled={false}
        onSelect={selectRegion}
      />

      {provinces.length > 0 && (
        <LocationPicker
          label="Province (if applicable)"
          value={provinceLabel}
          placeholder="Select province or independent city"
          options={provinceChoices}
          disabled={!value.regionCode}
          onSelect={selectProvince}
        />
      )}
      {value.regionCode && provinces.length === 0 && (
        <Text className="mt-2 text-muted-foreground text-[11px]">This region has no province level; choose its city or municipality directly.</Text>
      )}

      <LocationPicker
        label="City / Municipality"
        value={value.city}
        placeholder={value.localityParentCode ? "Select city or municipality" : provinces.length > 0 ? "Select a province first" : "Select a region first"}
        options={cities}
        disabled={!value.localityParentCode || cities.length === 0}
        onSelect={selectCity}
      />
      <LocationPicker
        label="Barangay"
        value={value.barangay}
        placeholder={value.cityCode ? "Select barangay" : "Select a city or municipality first"}
        options={barangays}
        disabled={!value.cityCode || barangays.length === 0}
        onSelect={selectBarangay}
      />

      <Text className="mt-4 text-muted-foreground text-xs">Street / Landmark</Text>
      <TextInput
        accessibilityLabel="Street or landmark"
        value={value.street}
        onChangeText={(street) => onChange({ street })}
        placeholder="House / unit number, street, subdivision, or landmark"
        placeholderTextColor={colors.muted}
        multiline
        textAlignVertical="top"
        className="mt-2 min-h-20 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground text-sm"
      />
      <Text className="mt-4 text-muted-foreground text-xs">ZIP code</Text>
      <TextInput
        accessibilityLabel="Four-digit Philippine ZIP code"
        value={value.zipCode}
        onChangeText={(zipCode) => onChange({ zipCode: zipCode.replace(/\D/g, "").slice(0, 4) })}
        placeholder="4-digit ZIP code"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        maxLength={4}
        className="mt-2 h-11 rounded-xl border border-border bg-secondary px-3 text-foreground text-sm"
      />
    </View>
  );
}

function LocationPicker({
  label,
  value,
  placeholder,
  options,
  disabled,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: readonly LocationOption[];
  disabled: boolean;
  onSelect: (option: LocationOption) => void;
}) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const matchingOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return options
      .filter((option) => !normalizedSearch || option.name.toLowerCase().includes(normalizedSearch))
      .slice(0, 80);
  }, [options, search]);

  return (
    <View className="mt-3">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ disabled, expanded: isOpen }}
        disabled={disabled}
        onPress={() => {
          setSearch("");
          setIsOpen((current) => !current);
        }}
        className={`mt-2 h-11 flex-row items-center justify-between rounded-xl border border-border bg-secondary px-3 ${disabled ? "opacity-50" : ""}`}
      >
        <Text className={`flex-1 text-sm ${value ? "text-foreground" : "text-muted-foreground"}`} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.muted} />
      </Pressable>
      {isOpen && !disabled && (
        <View className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
          <TextInput
            accessibilityLabel={`Search ${label.toLowerCase()}`}
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${label.toLowerCase()}`}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            className="h-10 border-b border-border px-3 text-foreground text-sm"
          />
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled className="max-h-48">
            {matchingOptions.map((option) => (
              <Pressable
                key={option.code}
                accessibilityRole="button"
                onPress={() => {
                  onSelect(option);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="min-h-10 justify-center border-b border-border px-3 py-2"
              >
                <Text className="text-foreground text-xs">{option.name}</Text>
              </Pressable>
            ))}
            {matchingOptions.length === 0 && <Text className="px-3 py-4 text-muted-foreground text-xs">No matching locations.</Text>}
            {matchingOptions.length === 80 && options.length > 80 && <Text className="px-3 py-2 text-muted-foreground text-[10px]">Search to narrow the list.</Text>}
          </ScrollView>
        </View>
      )}
    </View>
  );
}