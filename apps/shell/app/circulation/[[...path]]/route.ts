import { createZoneHandler } from "../../../lib-zone-proxy";

export const dynamic = "force-dynamic";
const handler = createZoneHandler("circulation");
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD };
