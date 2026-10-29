import type { NextApiRequest, NextApiResponse } from "next";
// Express must receive the original stream and full /api URL.
export const config = { api: { bodyParser: false, externalResolver: true }, maxDuration: 300 };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  const { default: app } = await import("../../server/app");
  app(req, res);
}
