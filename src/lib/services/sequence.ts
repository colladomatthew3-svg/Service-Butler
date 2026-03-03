import { getSupabaseServerClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/workflows/client";
import type { SequenceType } from "@/types/domain";

export async function enrollLeadInSequence(accountId: string, leadId: string, sequenceType: SequenceType) {
  const supabase = await getSupabaseServerClient();
  const { data: sequence, error: sequenceError } = await supabase
    .from("sequences")
    .select("id")
    .eq("account_id", accountId)
    .eq("type", sequenceType)
    .eq("status", "ACTIVE")
    .single();

  if (sequenceError || !sequence) throw new Error(`Sequence not found: ${sequenceType}`);

  const { data: enrollment, error } = await supabase
    .from("sequence_enrollments")
    .upsert(
      {
        account_id: accountId,
        lead_id: leadId,
        sequence_id: sequence.id,
        status: "ACTIVE",
        next_run_at: new Date().toISOString()
      },
      { onConflict: "sequence_id,lead_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await inngest.send({
    name: "sequence/enrolled",
    data: { accountId, leadId, enrollmentId: enrollment.id, sequenceType }
  });

  return enrollment.id as string;
}
