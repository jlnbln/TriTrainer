import { getRequestConfig } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

const VALID_LOCALES = ['en', 'de'] as const;
type Locale = (typeof VALID_LOCALES)[number];

export default getRequestConfig(async () => {
  let locale: Locale = 'en';

  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', session.user.id)
        .single();
      const lang = profile?.language;
      if (lang && (VALID_LOCALES as readonly string[]).includes(lang)) {
        locale = lang as Locale;
      }
    }
  } catch {
    // fall back to 'en'
  }

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
