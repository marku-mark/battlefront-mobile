export type PaymentProof = { uri: string; name: string; type: string };
export type OrderInput = { recipient_name: string; contact_number: string; fulfillment_method: string; payment_method: string; delivery_address?: string; payment_proof?: PaymentProof };
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createOrderSubmission<T>(request: Request, platform: "web" | "native", readNativeProof?: (proof: PaymentProof) => Blob | Promise<Blob>) {
  async function appendProof(body: FormData, proof: PaymentProof): Promise<void> {
    if (platform === "web") {
      const image = await fetch(proof.uri);
      if (!image.ok) throw new Error("Cannot read payment proof. Choose the image again.");
      const blob = await image.blob();
      body.append("payment_proof", blob.type ? blob : new Blob([blob], { type: proof.type }), proof.name);
    } else {
      if (!readNativeProof) throw new Error("Payment proof cannot be read. Reload the app and select the image again.");
      body.append("payment_proof", await readNativeProof(proof), proof.name);
    }
  }
  let pendingPlacement: Promise<T> | null = null;
  async function submitOrder(input: OrderInput): Promise<T> {
    let body: string | FormData;
    if (!input.payment_proof) {
      body = JSON.stringify(input);
    } else {
      body = new FormData();
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined && key !== "payment_proof") body.append(key, String(value));
      }
      await appendProof(body, input.payment_proof);
    }
    return (await request<{ data: T }>("orders", { method: "POST", body })).data;
  }
  return {
    placeOrder(input: OrderInput): Promise<T> {
      if (pendingPlacement) return Promise.reject(new Error("An order is still being submitted. Wait for its result before trying again."));
      const placement = submitOrder(input).finally(() => { if (pendingPlacement === placement) pendingPlacement = null; });
      pendingPlacement = placement;
      return placement;
    },
    async resubmitPaymentProof(id: string, proof: PaymentProof): Promise<T> {
      const body = new FormData();
      await appendProof(body, proof);
      return (await request<{ data: T }>(`orders/${encodeURIComponent(id)}/payment-proof`, { method: "POST", body })).data;
    },
  };
}
