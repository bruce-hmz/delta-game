'use client';

import Script from 'next/script';

export default function CozeAnalytics() {
  return (
    <>
      <Script
        src="https://coze-analytics.coze.site/coze-analytics.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('[Analytics] SDK loaded');
        }}
      />
      <Script id="analytics-init" strategy="lazyOnload">
        {`
          window.addEventListener('load', function() {
            setTimeout(function() {
              if (window.CozeAnalytics) {
                window.CozeAnalytics.init({
                  appId: 'ca_d6k5wdpswb11zv1k',
                  secretKey: 'iaFChEIMQbiX7t4Wt7dD0U94iIApnPcY'
                });
              }
            }, 1);
          }, { once: true });
        `}
      </Script>
    </>
  );
}
