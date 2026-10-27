import { ApiError } from "./apiClient.ts";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  default_delivery_address: string | null;
  default_delivery_contact_number?: string | null;
  search_recommendations_enabled: boolean;
  product_view_recommendations_enabled: boolean;
  personalized_recommendations_enabled: boolean;
  appearance?: "light" | "dark";
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
  appearance?: "light" | "dark";
};
export type RegistrationInput = { name: string; email: string; password: string; password_confirmation: string };
export type AuthResult = { user: ApiUser; token: string; expires_at: string };
export type VerificationContext = { status: "verification_required"; verification_token: string; masked_email: string; verification_expires_at: string; expires_at: string | null; resend_available_at: string | null; attempts_remaining: number; delivery_status: "sent" | "failed" | "rate_limited"; retry_after: number };
export function isVerificationContext(value: unknown): value is VerificationContext {
  return typeof value === "object" && value !== null && "status" in value && value.status === "verification_required" && "verification_token" in value && typeof value.verification_token === "string";
}
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
type Envelope<T> = { data: T };

export function createAccountApi(request: Request) {
  return {
    async login(email: string, password: string) {
      try {
        return (await request<Envelope<AuthResult>>("auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password, device_name: "Battlefront Expo" }) })).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403 && isVerificationContext(error.data)) return error.data;
        throw error;
      }
    },
    async register(fields: RegistrationInput) {
      return (await request<Envelope<VerificationContext>>("auth/register", { method: "POST", body: JSON.stringify({ ...fields, name: fields.name.trim(), email: fields.email.trim(), device_name: "Battlefront Expo" }) })).data;
    },
    async verifyEmail(verification_token: string, code: string) {
      await request("auth/email/verify", { method: "POST", body: JSON.stringify({ verification_token, code }) });
    },
    async resendVerification(verification_token: string) {
      return (await request<Envelope<Omit<VerificationContext, "verification_token">>>("auth/email/resend", { method: "POST", body: JSON.stringify({ verification_token }) })).data;
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
