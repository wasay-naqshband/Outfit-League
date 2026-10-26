import { battlePreview } from "../../src/lib/battle-preview.ts";

export function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}) {
  return battlePreview(context.request, context.next);
}
