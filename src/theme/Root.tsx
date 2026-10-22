// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React, {useEffect} from 'react';

export default function Root({children}: {children: React.ReactNode}) {
  useEffect(() => {
    const element = document.documentElement;
    const saveTheme = () => {
      const theme = element.getAttribute('data-theme');
      if (theme !== 'light' && theme !== 'dark') return;
      const host = window.location.hostname;
      const domain = host === 'gostoa.dev' || host.endsWith('.gostoa.dev')
        ? '; Domain=.gostoa.dev' : '';
      try {
        document.cookie = `stoa-theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax; Secure${domain}`;
      } catch { /* Theme selection still works when cookies are unavailable. */ }
    };
    const observer = new MutationObserver(saveTheme);
    observer.observe(element, {attributes: true, attributeFilter: ['data-theme']});
    return () => observer.disconnect();
  }, []);
  return <>{children}</>;
}
