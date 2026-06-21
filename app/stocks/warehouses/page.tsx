import { redirect } from "next/navigation";

export default function WarehousesRedirectPage() {
  redirect("/products/stocks/warehouses");
}
