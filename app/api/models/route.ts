import { buildModelCatalog } from "@/lib/modelCatalog"

export async function GET() {
  return Response.json({ models: buildModelCatalog() })
}
