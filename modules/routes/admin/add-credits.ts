import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { createClient } from "@supabase/supabase-js";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { userId, amount } = await request.json();

  if (!userId || !amount || amount <= 0) {
    return new Response("Missing or invalid 'userId' or 'amount'", { status: 400 });
  }

  // This RPC function must be created in your Supabase project.
  // It should safely increment the user's wallet balance.
  const { error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount
  });

  if (error) {
    context.log.error("RPC Error adding credits:", error);
    return new Response("Failed to add credits", { status: 500 });
  }

  return new Response(JSON.stringify({
    message: `Successfully added ${amount} credits to user ${userId}.`
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
