export type ApiUser = {
  id: number;
  name: string;
  email: string;
  default_delivery_address: string | null;
  default_delivery_contact_number?: string | null;
  search_recommendations_enabled: boolean;
  product_view_recommendations_enabled: boolean;
  personalized_recommendations_enabled: boolean;
};
export type ProfileInput = {
  name: string;
  email: string;
  default_delivery_address?: string | null;
  default_delivery_contact_number?: string | null;
  default_delivery_address_action?: "keep" | "save" | "clear";
  default_delivery_region_code?: string;
  default_delivery_province_code?: string | null;
  default_delivery_city_code?: string;
  default_delivery_barangay_code?: string;
  default_delivery_address_details?: string;
  search_recommendations_enabled?: boolean;
  product_view_recommendations_enabled?: boolean;
  personalized_recommendations_enabled?: boolean;
};
export type RegistrationInput = { name: string; email: string; password: string; password_confirmation: string };
export type AuthResult = { user: ApiUser; token: string; expires_at: string };
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
type Envelope<T> = { data: T };

export function createAccountApi(request: Request) {
  return {
    async login(email: string, password: string) {
      return (await request<Envelope<AuthResult>>("auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password, device_name: "Battlefront Expo" }) })).data;
    },
    async register(fields: RegistrationInput) {
      return (await request<Envelope<AuthResult>>("auth/register", { method: "POST", body: JSON.stringify({ ...fields, name: fields.name.trim(), email: fields.email.trim(), device_name: "Battlefront Expo" }) })).data;
    },
    async getProfile() { return (await request<Envelope<ApiUser>>("profile")).data; },
    async updateProfile(fields: ProfileInput) {
      return (await request<Envelope<ApiUser>>("profile", { method: "PATCH", body: JSON.stringify({ ...fields, name: fields.name.trim(), email: fields.email.trim() }) })).data;
    },
    async logout() { await request<void>("auth/logout", { method: "POST" }); },
    async changePassword(fields: { current_password: string; password: string; password_confirmation: string }) {
      await request<void>("profile/password", { method: "PUT", body: JSON.stringify(fields) });
    },
  };
}

export function createProfileActions(account: Pick<ReturnType<typeof createAccountApi>, "getProfile" | "updateProfile">, getUserId: () => number | string, commit: (user: ApiUser) => void) {
  async function run(load: () => Promise<ApiUser>, owner: number | string): Promise<ApiUser> {
    if (typeof owner !== "number" || getUserId() !== owner) throw new Error("Your account changed. Please reopen the account screen.");
    const user = await load();
    if (getUserId() !== owner || user.id !== owner) throw new Error("Your account changed. Please reopen the account screen.");
    commit(user);
    return user;
  }
  return {
    refreshProfile: () => run(() => account.getProfile(), getUserId()),
    saveProfile: (fields: ProfileInput, owner: number | string = getUserId()) => run(() => account.updateProfile(fields), owner),
  };
}
