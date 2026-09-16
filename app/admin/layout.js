import AdminBrowserHint from "../components/AdminBrowserHint";
import AdminPwaPrompt from "../components/AdminPwaPrompt";
import AdminServiceWorkerRegister from "../components/AdminServiceWorkerRegister";
import { getBasePath } from "@/lib/basePath";
import "sweetalert2/dist/sweetalert2.min.css";
import "../admin.css";

const BASE_PATH = getBasePath();

export const metadata = {
  title: "Admin | Ganpati Mobile Point",
  applicationName: "Ganpati Admin",
  manifest: `${BASE_PATH}/admin/manifest`,
  appleWebApp: {
    capable: true,
    title: "GMP Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: `${BASE_PATH}/admin/icons/apple-touch-icon.png`,
  },
};

export const viewport = {
  themeColor: "#0f1728",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminServiceWorkerRegister />
      <AdminBrowserHint />
      {children}
      <AdminPwaPrompt />
    </>
  );
}
