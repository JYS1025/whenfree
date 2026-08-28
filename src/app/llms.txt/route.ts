import { NextResponse } from "next/server";
import fs from "node:path";
import { promises as fsp } from "node:fs";

export async function GET() {
  const filePath = fs.join(process.cwd(), "public/llms.txt");
  const content = await fsp.readFile(filePath, "utf-8");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
