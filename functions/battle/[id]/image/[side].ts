import { battleImage } from "../../../../src/lib/battle-preview.ts";

export function onRequest(context: {
  request: Request;
  params: { id: string; side: string };
}) {
  return battleImage(context.request, context.params.id, context.params.side);
}
