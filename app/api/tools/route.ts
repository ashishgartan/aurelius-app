import { buildToolCatalog } from "@/lib/tools/catalog"

export async function GET() {
  return Response.json({ tools: buildToolCatalog() })
}
