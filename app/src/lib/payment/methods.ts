import type { PaymentMethod } from "@/lib/payment/types";

export type PaymentMethodOption = {
  id: "visa" | "mastercard" | PaymentMethod;
  method: PaymentMethod;
  label: string;
  token: string;
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { id: "visa", method: "card", label: "Visa", token: "mock_visa_success" },
  { id: "mastercard", method: "card", label: "Mastercard", token: "mock_mastercard_success" },
  { id: "apple_pay", method: "apple_pay", label: "Apple Pay", token: "mock_apple_pay_success" },
  { id: "google_pay", method: "google_pay", label: "Google Pay", token: "mock_google_pay_success" },
  { id: "vietqr", method: "vietqr", label: "VietQR", token: "mock_vietqr_success" },
  { id: "momo", method: "momo", label: "MoMo", token: "mock_momo_success" }
];
