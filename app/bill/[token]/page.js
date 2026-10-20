import CustomerBillView from "@/app/components/CustomerBillView";

export const metadata = {
  title: "Your bill | Ganpati Mobile Point",
  description: "Open and download your bill from Ganpati Mobile Point.",
};

export default async function CustomerBillPage({ params }) {
  const { token: rawToken } = await params;
  const token = String(rawToken || "");
  return <CustomerBillView token={token} />;
}
