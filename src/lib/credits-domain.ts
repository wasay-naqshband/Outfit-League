export type CreditKind =
  "grant" | "reserve" | "consume" | "refund" | "purchase";
export function creditActivity(kind: CreditKind) {
  switch (kind) {
    case "grant":
      return {
        title: "Welcome credits",
        detail: "Three complimentary try-ons added.",
        badge: "+3",
      };
    case "reserve":
      return {
        title: "Try-on started",
        detail: "One available credit moved into reservation.",
        badge: "Reserved 1",
      };
    case "consume":
      return {
        title: "Try-on completed",
        detail:
          "The reserved credit was used. No additional credit was deducted.",
        badge: "Used 1",
      };
    case "refund":
      return {
        title: "Credit returned",
        detail:
          "The generation did not complete. Your reserved credit is available again.",
        badge: "+1",
      };
    case "purchase":
      return {
        title: "15 try-ons purchased",
        detail: "15 try-ons were added to your balance.",
        badge: "+15",
      };
  }
}
// A store adapter must return a server-verified wallet update, never grant credits locally.
export interface StorePurchaseAdapter {
  availability(): Promise<{ available: boolean; reason: string }>;
  purchase(
    productId: string,
  ): Promise<{ verified: true; available: number; reserved: number }>;
  restore(): Promise<{ verified: true; available: number; reserved: number }>;
}
export class UnavailableStoreAdapter implements StorePurchaseAdapter {
  async availability() {
    return {
      available: false,
      reason: "Credit purchases are not available yet.",
    };
  }
  async purchase(_productId: string): Promise<never> {
    throw new Error("PURCHASES_UNAVAILABLE");
  }
  async restore(): Promise<never> {
    throw new Error("PURCHASES_UNAVAILABLE");
  }
}
