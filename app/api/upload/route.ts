// app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

// For demo, save to /public/uploads (must create this folder in your project root)
const UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
