import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { createClient } from "@supabase/supabase-js";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const serverId = request.params.serverId;

  const { data: server, error } = await supabase
    .from("mcp_servers")
    .select("url")
    .eq("id", serverId)
    .single();

  if (error) {
    return new Response("Server not found", { status: 404 });
  }

  // Simulate the MCP 'initialize' handshake to validate the server
  let compliance_status = 'FAILED';
  let validation_message = 'Handshake failed or server unreachable.';

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "initialize" })
    });

    if (response.ok) {
      const body = await response.json();
      // A simple check for a valid initialize response
      if (body.name && body.version) {
        compliance_status = 'PASSED';
        validation_message = `Handshake successful. Server Name: ${body.name}`;
      } else {
        validation_message = "Server responded but response was not a valid MCP initialize response.";
      }
    } else {
      validation_message = `Server responded with status: ${response.status}`;
    }

  } catch (e) {
    context.log.error(e);
    validation_message = "Could not reach server URL.";
  }

  const { error: updateError } = await supabase
    .from("mcp_servers")
    .update({ compliance_status })
    .eq("id", serverId);

  if (updateError) {
    return new Response("Failed to update server compliance status", { status: 500 });
  }

  return new Response(JSON.stringify({
    server_id: serverId,
    new_status: compliance_status,
    message: validation_message
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
