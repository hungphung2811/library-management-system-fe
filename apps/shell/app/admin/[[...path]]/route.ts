import { createZoneHandler } from "../../../lib-zone-proxy";

export const dynamic = "force-dynamic";
const handler = createZoneHandler("admin");
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD };
