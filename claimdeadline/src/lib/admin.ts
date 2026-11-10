import { timingSafeEqual } from "crypto";

export function adminAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
