import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "vi", "ja"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const locale: Locale = "en";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
