import { notFound } from "next/navigation";

// URL lạ dưới /circulation: dùng not-found của đoạn này (hiện trong khung).
export default function CirculationCatchAll() {
  notFound();
}
