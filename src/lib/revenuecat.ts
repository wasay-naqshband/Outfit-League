import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
export const TRYON_PACK_PRODUCT = "outfit_tryons_15";
export const TRYON_PACK_CREDITS = 15;
export const PRO_MONTHLY_PRODUCT = "outfit_pro_monthly";
export const PRO_YEARLY_PRODUCT = "outfit_pro_yearly";

export type PurchaseOptions = {
  pack: PurchasesPackage | null;
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
};

let configuredUser: string | null | undefined;

export function purchasesAvailable() {
  return Platform.OS === "ios" && !!apiKey;
}

export async function identifyPurchasesUser(userId: string | null) {
  if (!purchasesAvailable()) return;
  if (configuredUser === undefined) {
    if (!userId) return;
    Purchases.configure({ apiKey: apiKey!, appUserID: userId });
    configuredUser = userId;
    return;
  }
  if (configuredUser === userId) return;
  if (userId) await Purchases.logIn(userId);
  else await Purchases.logOut();
  configuredUser = userId;
}

export async function getPurchaseOptions(): Promise<PurchaseOptions> {
  if (!purchasesAvailable() || configuredUser == null)
    return { pack: null, monthly: null, yearly: null };
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const find = (identifier: string) =>
    packages.find((item) => item.product.identifier === identifier) ?? null;
  return {
    pack: find(TRYON_PACK_PRODUCT),
    monthly: find(PRO_MONTHLY_PRODUCT),
    yearly: find(PRO_YEARLY_PRODUCT),
  };
}

export const buyPackage = (pack: PurchasesPackage) =>
  Purchases.purchasePackage(pack);

export const restorePurchases = () => Purchases.restorePurchases();
