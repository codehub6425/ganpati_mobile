import "./form.css";

export const metadata = {
  title: "Repair Request | Ganpati Mobile Point",
  description:
    "Tell Ganpati Mobile Point your phone problem in 20 seconds. We will call you back.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(location.pathname.indexOf('/admin')===-1)return;var b=location.pathname.indexOf('/ganpati-mobile')===0?'/ganpati-mobile':'';window.__gmpPwa=window.__gmpPwa||{deferred:null};window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__gmpPwa.deferred=e;window.dispatchEvent(new Event('gmp-pwa-ready'));});window.addEventListener('appinstalled',function(){try{localStorage.setItem('gmp-admin-pwa-installed','1');localStorage.setItem('gmp-admin-pwa-dismissed','1')}catch(e){}});if('serviceWorker'in navigator){navigator.serviceWorker.register(b+'/admin/sw.js',{scope:b+'/admin/',updateViaCache:'none'}).catch(function(){})}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
