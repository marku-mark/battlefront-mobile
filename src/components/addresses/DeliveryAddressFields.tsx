import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { DeliveryAddress, DeliveryLocation } from "@/lib/deliveryAddress";
import { getDeliveryLocations, resolveDeliveryLocation, type DeliveryCity, type DeliveryProvince } from "@/lib/api";

export function DeliveryAddressFields({
  value,
  locations,
  onChange,
  onLocation,
  disabled = false,
}: {
  value: DeliveryAddress;
  locations: DeliveryLocation[];
  onChange: (next: DeliveryAddress) => void;
  onLocation: (location: DeliveryLocation) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [openPicker, setOpenPicker] = useState<"region" | "province" | "destination" | "barangay" | null>(null);
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<DeliveryProvince[]>([]);
  const [cities, setCities] = useState<DeliveryCity[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const destination = locations.find((item) => item.destination === value.delivery_destination);
  const barangay = destination?.barangays.find((item) => item.code === value.delivery_barangay_code);
  const selectedRegion = regionCode || destination?.region_code || "";
  const selectedProvince = provinceCode || destination?.province?.code || "";
  useEffect(() => {
    if (!destination) return;
    setRegionCode(destination.region_code ?? ""); setProvinceCode(destination.province?.code ?? "");
  }, [destination?.code]);
  const options = openPicker === "region" ? regions : openPicker === "province" ? [{ code: "", name: "No province / Independent city" }, ...provinces] : openPicker === "destination" ? cities.map((city) => ({ code: city.code, name: city.destination })) : destination?.barangays ?? [];
  useEffect(() => {
    let active = true;
    void getDeliveryLocations<{ code: string; name: string }>("regions").then((rows) => { if (active) setRegions(rows); }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    if (!selectedRegion) return;
    let active = true; setProvinces([]); setCities([]);
    void Promise.all([getDeliveryLocations<DeliveryProvince>("provinces", selectedRegion), getDeliveryLocations<DeliveryCity>("cities", selectedProvince || selectedRegion)]).then(([provinceRows, cityRows]) => { if (active) { setProvinces(provinceRows); setCities(cityRows); setError(""); } }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [selectedRegion, selectedProvince, retry]);
  useEffect(() => {
    const code = value.delivery_destination;
    if (!/^\d{10}$/.test(code) || destination?.barangays.length) return;
    let active = true;
    void resolveDeliveryLocation(code).then((location) => { if (active) onLocation(location); }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [value.delivery_destination, Boolean(destination?.barangays.length), retry]);
  const filteredOptions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return options.filter((option) => !normalized || option.name.toLowerCase().includes(normalized));
  }, [options, search]);

  function togglePicker(picker: "region" | "province" | "destination" | "barangay") {
    setSearch("");
    setOpenPicker((current) => current === picker ? null : picker);
  }

  return (
    <View className="mt-2">
      <Text className="text-foreground text-sm font-semibold">Delivery address</Text>
      <Text className="mt-1 text-muted-foreground text-[11px]">Choose a Philippine address. Availability and delivery charges are confirmed by the store.</Text>
      {error ? <Pressable onPress={() => { setError(""); setRetry((value) => value + 1); }} className="py-3"><Text accessibilityRole="alert" className="text-danger">{error} Tap to retry.</Text></Pressable> : null}
      <AddressPicker label="Region" value={regions.find((region) => region.code === selectedRegion)?.name ?? ""} placeholder="Select a region" isOpen={openPicker === "region"} disabled={disabled || regions.length === 0} search={search} options={filteredOptions} placeholderTextColor={colors.muted} onToggle={() => togglePicker("region")} onSearch={setSearch} onSelect={(option) => { setRegionCode(option.code); setProvinceCode(""); onChange({ ...value, delivery_destination: "", delivery_barangay_code: "" }); setOpenPicker(null); }} />
      <AddressPicker label="Province" value={provinces.find((province) => province.code === selectedProvince)?.name ?? (selectedRegion ? "No province / Independent city" : "")} placeholder="Select a region first" isOpen={openPicker === "province"} disabled={disabled || !selectedRegion} search={search} options={filteredOptions} placeholderTextColor={colors.muted} onToggle={() => togglePicker("province")} onSearch={setSearch} onSelect={(option) => { setRegionCode(selectedRegion); setProvinceCode(option.code); onChange({ ...value, delivery_destination: "", delivery_barangay_code: "" }); setOpenPicker(null); }} />
      <AddressPicker
        label="City / Municipality"
        value={destination ? (destination.province ? `${destination.name}, ${destination.province.name}` : destination.name) : ""}
        placeholder="Select a supported destination"
        isOpen={openPicker === "destination"}
        disabled={disabled || !selectedRegion}
        search={search}
        options={filteredOptions}
        placeholderTextColor={colors.muted}
        onToggle={() => togglePicker("destination")}
        onSearch={setSearch}
        onSelect={(selected) => {
          const city = cities.find((city) => city.code === selected.code);
          if (city) onLocation({ destination: city.code, code: city.code, name: city.destination, type: city.type, city_class: city.city_class, region_code: city.region_code, province: provinces.find((province) => province.code === city.province_code) ?? null, barangays: [] });
          onChange({ ...value, delivery_destination: selected.code, delivery_barangay_code: "" });
          setOpenPicker(null);
        }}
      />
      <AddressPicker
        label="Barangay"
        value={barangay?.name ?? ""}
        placeholder={destination ? (destination.barangays.length ? "Select a barangay" : "Loading barangays…") : "Select a destination first"}
        isOpen={openPicker === "barangay"}
        disabled={disabled || !destination || destination.barangays.length === 0}
        search={search}
        options={filteredOptions}
        placeholderTextColor={colors.muted}
        onToggle={() => togglePicker("barangay")}
        onSearch={setSearch}
        onSelect={(selected) => {
          onChange({ ...value, delivery_barangay_code: selected.code });
          setOpenPicker(null);
        }}
      />
      <Text className="mt-4 text-muted-foreground text-xs">House / Building / Street / Landmark</Text>
      <TextInput
        accessibilityLabel="House, building, street, or landmark details"
        value={value.delivery_address_details}
        onChangeText={(details) => onChange({ ...value, delivery_address_details: details })}
        editable={!disabled}
        maxLength={255}
        autoComplete="street-address"
        multiline
        textAlignVertical="top"
        placeholder="House number, building, street, or nearby landmark"
        placeholderTextColor={colors.muted}
        className="mt-2 min-h-20 rounded-xl border border-border bg-background px-3 py-3 text-foreground text-sm"
      />
    </View>
  );
}

function AddressPicker({
  label,
  value,
  placeholder,
  isOpen,
  disabled,
  search,
  options,
  placeholderTextColor,
  onToggle,
  onSearch,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  isOpen: boolean;
  disabled: boolean;
  search: string;
  options: { code: string; name: string }[];
  placeholderTextColor: string;
  onToggle: () => void;
  onSearch: (value: string) => void;
  onSelect: (option: { code: string; name: string }) => void;
}) {
  return (
    <View className="mt-3">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ disabled, expanded: isOpen }}
        disabled={disabled}
        onPress={onToggle}
        className={`mt-2 min-h-11 justify-center rounded-xl border border-border bg-background px-3 ${disabled ? "opacity-50" : ""}`}
      >
        <Text className={`text-sm ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || placeholder}</Text>
      </Pressable>
      {isOpen && !disabled && <View className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
        <TextInput
          accessibilityLabel={`Search ${label.toLowerCase()}`}
          value={search}
          onChangeText={onSearch}
          placeholder={`Search ${label.toLowerCase()}`}
          placeholderTextColor={placeholderTextColor}
          autoCorrect={false}
          className="h-10 border-b border-border px-3 text-foreground text-sm"
        />
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled className="max-h-48">
          {options.map((option) => <Pressable key={option.code} accessibilityRole="button" onPress={() => onSelect(option)} className="min-h-10 justify-center border-b border-border px-3 py-2"><Text className="text-foreground text-xs">{option.name}</Text></Pressable>)}
          {options.length === 0 && <Text className="px-3 py-4 text-muted-foreground text-xs">No matching locations.</Text>}
        </ScrollView>
      </View>}
    </View>
  );
}
