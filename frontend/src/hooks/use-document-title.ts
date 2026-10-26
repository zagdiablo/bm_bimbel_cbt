import { useEffect } from 'react';
import { env } from '@/lib/env';

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} • ${env.appName}` : env.appName;
  }, [title]);
}
