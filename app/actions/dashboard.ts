"use server";

import { runGhlBatch } from "@/lib/cronGhl";
import { runLeadgenTick, runLeadgenUntilDone } from "@/lib/cronLeadgen";

export async function actionLeadgenNext() {
  const r = await runLeadgenTick();
  return JSON.stringify(r);
}

export async function actionLeadgenAll() {
  const r = await runLeadgenUntilDone();
  return JSON.stringify(r);
}

export async function actionGhlNow() {
  const r = await runGhlBatch();
  return JSON.stringify(r);
}
