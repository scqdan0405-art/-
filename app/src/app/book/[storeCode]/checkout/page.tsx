import CheckoutClient from "./CheckoutClient";

export default function CheckoutPage({
  params,
  searchParams
}: {
  params: { storeCode: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <CheckoutClient storeCode={params.storeCode} initialParams={searchParams} />;
}
