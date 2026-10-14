import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { DeliveryAddress, DeliveryLocation } from "@/lib/deliveryAddress";

export function DeliveryAddressFields({
  value,
  locations,
  onChange,
  disabled = false,
}: {
  value: DeliveryAddress;
  locations: DeliveryLocation[];
  onChange: (next: DeliveryAddress) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [openPicker, setOpenPicker] = useState<"destination" | "barangay" | null>(null);
  const [search, setSearch] = useState("");
  const destination = locations.find((item) => item.destination === value.delivery_destination);
  const barangay = destination?.barangays.find((item) => item.code === value.delivery_barangay_code);
  const options = openPicker === "destination" ? locations.map((item) => ({ code: item.destination, name: item.province ? `${item.name}, ${item.province.name}` : item.name })) : destination?.barangays ?? [];
  const filteredOptions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return options.filter((option) => !normalized || option.name.toLowerCase().includes(normalized));
  }, [options, search]);

  function togglePicker(picker: "destination" | "barangay") {
    setSearch("");
    setOpenPicker((current) => current === picker ? null : picker);
  }

  return (
    <View className="mt-2">
      <Text className="text-foreground text-sm font-semibold">Delivery address</Text>
      <Text className="mt-1 text-muted-foreground text-[11px]">Choose a Negros destination. Some delivery charges need separate confirmation.</Text>
      <AddressPicker
        label="City / Municipality"
        value={destination ? (destination.province ? `${destination.name}, ${destination.province.name}` : destination.name) : ""}
        placeholder="Select a supported destination"
        isOpen={openPicker === "destination"}
        disabled={disabled}
        search={search}
        options={filteredOptions}
        placeholderTextColor={colors.muted}
        onToggle={() => togglePicker("destination")}
        onSearch={setSearch}
        onSelect={(selected) => {
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
