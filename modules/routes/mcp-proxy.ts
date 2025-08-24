import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { createClient } from "@supabase/supabase-js";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const user = request.user; // Attached by our auth policy
  const serverId = request.params.serverId;

  // --- 1. Fetch Server and User Wallet Info ---
  const { data: server, error: serverError } = await supabase
    .from("mcp_servers")
    .select(`*, tool_pricing(tool_name, price_in_credits)`)
    .eq("id", serverId)
    .single();

  const { data: wallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (serverError || walletError) {
    context.log.error({ serverError, walletError });
    return new Response("Server not found or user wallet missing", { status: 404 });
  }

  // --- 2. Pre-call Validation ---
  if (server.compliance_status !== 'PASSED') {
    return new Response(`Server is not available (Status: ${server.compliance_status})`, { status: 403 });
  }
  // You might add a separate 'suspended' flag as well
  // if (server.suspended) { ... }


  // --- 3. Determine Cost ---
  const requestBody = await request.json();
  const mcpMethod = requestBody.method;
  let cost = server.base_request_price || 1; // Default cost

  if (mcpMethod === 'tools/call' && requestBody.tool_name) {
    const pricing = server.tool_pricing.find(p => p.tool_name === requestBody.tool_name);
    if (pricing) {
      cost = pricing.price_in_credits;
    }
  }

  if (wallet.balance < cost) {
    return new Response(`Insufficient credits. Balance: ${wallet.balance}, Cost: ${cost}`, { status: 402 });
  }

  // --- 4. Proxy the Request ---
  const upstreamResponse = await fetch(server.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const gatewayRequestId = context.invocation.id;

  // --- 5. Post-call Metering and Logging ---
  if (upstreamResponse.ok) {
    // You must create this PostgreSQL function in Supabase
    const { error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost
    });

    if (deductError) {
      // Critical error: Failed to bill. This should trigger an alert.
      context.log.error("CRITICAL: Failed to deduct credits for user " + user.id, deductError);
      // Decide how to handle this. You might let the response pass but flag for reconciliation.
    }
  }

  // Log the usage regardless of success or billing outcome
  await supabase.from("usage_logs").insert({
    user_id: user.id,
    server_id: serverId,
    api_key_id: request.apiKeyId, // Note: you'll need to attach this in the auth policy
    cost_in_credits: cost,
    is_success: upstreamResponse.ok,
    gateway_request_id: gatewayRequestId,
    upstream_response_status: upstreamResponse.status,
  });

  // --- 6. Return Response ---
  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers
  });
  response.headers.set("X-Gateway-Request-ID", gatewayRequestId);
  return response;
}
