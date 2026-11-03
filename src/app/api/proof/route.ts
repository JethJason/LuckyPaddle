import { NextRequest, NextResponse } from "next/server";
import { MAX_PROOF_BYTES, PROOF_BUCKET } from "@/lib/config";
import { databaseConfigured, getBooking, setProofPath } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  if (!databaseConfigured())
    return NextResponse.json({ error: "Database is not configured yet." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const holdId = form?.get("holdId");
  const file = form?.get("file");

  if (typeof holdId !== "string" || !holdId || !file || typeof file === "string")
    return NextResponse.json({ error: "Choose a receipt photo to upload." }, { status: 400 });
  if (!ALLOWED.has(file.type))
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
  if (file.size > MAX_PROOF_BYTES)
    return NextResponse.json({ error: "The receipt image must be 4 MB or smaller." }, { status: 400 });

  try {
    const hold = await getBooking(holdId);
    if (!hold || hold.status !== "held")
      return NextResponse.json(
        { error: "Your 10-minute hold has expired. Pick the slot again." },
        { status: 410 },
      );

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${holdId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });

    if (error) {
      const hint = /bucket/i.test(error.message)
        ? " Run supabase/schema.sql to create the payment-proofs bucket."
        : "";
      return NextResponse.json({ error: `Could not upload the receipt.${hint}` }, { status: 500 });
    }

    const updated = await setProofPath(holdId, path);
    if (!updated) {
      await supabase.storage.from(PROOF_BUCKET).remove([path]);
      return NextResponse.json(
        { error: "Your 10-minute hold has expired. Pick the slot again." },
        { status: 410 },
      );
    }

    return NextResponse.json({ ok: true, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload the receipt." },
      { status: 500 },
    );
  }
}
