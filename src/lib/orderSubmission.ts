export type PaymentProof = { uri: string; name: string; type: string };
export type OrderInput = { recipient_name: string; contact_number: string; fulfillment_method: string; payment_method: string; delivery_address?: string; payment_proof?: PaymentProof };
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
type NativeProofFile = { bytes: () => Promise<Uint8Array> };

export function createOrderSubmission<T>(request: Request, platform: "web" | "native", readNativeProof?: (proof: PaymentProof) => NativeProofFile | Promise<NativeProofFile>) {
  async function appendProof(body: FormData, proof: PaymentProof): Promise<void> {
    if (platform === "web") {
      const image = await fetch(proof.uri);
      if (!image.ok) throw new Error("Cannot read payment proof. Choose the image again.");
      const blob = await image.blob();
      body.append("payment_proof", blob.type ? blob : new Blob([blob], { type: proof.type }), proof.name);
    } else {
      if (!readNativeProof) throw new Error("Payment proof cannot be read. Reload the app and select the image again.");
      const file = await readNativeProof(proof);
      // Expo fetch encodes bytes-capable files; preserve the image picker's metadata.
      body.append("payment_proof", { name: proof.name, type: proof.type, bytes: () => file.bytes() } as unknown as Blob);
    }
  }
  let pendingPlacement: Promise<T> | null = null;
  const pendingProofs = new Set<string>();
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
      if (pendingProofs.has(id)) throw new Error("Payment proof is still being uploaded. Wait for its result before trying again.");
      pendingProofs.add(id);
      try {
        const body = new FormData();
        await appendProof(body, proof);
        return (await request<{ data: T }>(`orders/${encodeURIComponent(id)}/payment-proof`, { method: "POST", body })).data;
      } finally { pendingProofs.delete(id); }
    },
  };
}
