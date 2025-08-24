import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { createClient } from '@supabase/supabase-js';

export default async function (request: ZuploRequest, context: ZuploContext) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      db: { schema: 'public' },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );

  // In a real implementation, you would get the owner_id from the authenticated user's context.
  // For now, we are passing it in the body as per the spec.
  const { name, description, url, tool_prices, owner_id } = await request.json();

  if (!url || !owner_id) {
    return new Response("Missing required fields: url, owner_id", { status: 400 });
  }

  const { data: server, error: serverError } = await supabase
    .from('mcp_servers')
    .insert({ name, description, url, owner_id })
    .select()
    .single();

  if (serverError) {
    context.log.error(serverError);
    return new Response("Error creating server", { status: 500 });
  }

  if (tool_prices && tool_prices.length > 0) {
    const pricesToInsert = tool_prices.map(p => ({
      server_id: server.id,
      tool_name: p.tool_name,
      price_in_credits: p.price_in_credits,
    }));

    const { error: pricingError } = await supabase
      .from('tool_pricing')
      .insert(pricesToInsert);

    if (pricingError) {
      context.log.error(pricingError);
      // In a production scenario, you might want to handle this more gracefully,
      // such as by rolling back the server insertion in a transaction.
      return new Response("Error setting tool prices", { status: 500 });
    }
  }

  return new Response(JSON.stringify(server), {
    headers: { "Content-Type": "application/json" },
  });
}
