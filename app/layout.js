import "./form.css";
import "sweetalert2/dist/sweetalert2.min.css";

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
            __html: `(function(){try{if(location.pathname.indexOf('/admin')===-1)return;var b=location.pathname.indexOf('/ganpati-mobile')===0?'/ganpati-mobile':'';if(!document.querySelector('link[rel="manifest"]')){var l=document.createElement('link');l.rel='manifest';l.href=b+'/admin/manifest';document.head.appendChild(l);}window.__gmpPwa=window.__gmpPwa||{deferred:null};window.addEventListener('beforeinstallprompt',function(e){window.__gmpPwa.deferred=e;window.dispatchEvent(new Event('gmp-pwa-ready'));});window.addEventListener('appinstalled',function(){try{localStorage.setItem('gmp-admin-pwa-installed','1');localStorage.setItem('gmp-admin-pwa-dismissed','1')}catch(err){}});if('serviceWorker'in navigator){navigator.serviceWorker.register(b+'/admin/sw.js',{scope:b+'/admin/',updateViaCache:'none'}).catch(function(){})}document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('body link[rel="manifest"]').forEach(function(el){document.head.appendChild(el);});});}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
