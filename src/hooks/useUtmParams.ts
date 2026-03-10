import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UtmData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export function useUtmParams(): UtmData | null {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const data: UtmData = {};
    let hasAny = false;

    for (const key of UTM_KEYS) {
      const val = searchParams.get(key);
      if (val) {
        data[key] = val;
        hasAny = true;
      }
    }

    return hasAny ? data : null;
  }, [searchParams]);
}
