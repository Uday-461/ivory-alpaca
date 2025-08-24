import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  return new Response(JSON.stringify({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "MCP API Gateway is running"
  }), {
    headers: { "Content-Type": "application/json" },
  });
}
