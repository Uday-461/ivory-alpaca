import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  // The user object is attached by the ApiKeyAuthPolicy.
  // This handler is for testing that the policy works correctly.
  const user = request.user;

  if (user) {
    return new Response(`Authenticated as: ${user.email}`);
  }

  // This part should not be reached if the policy is working
  return new Response("Authentication failed", { status: 500 });
}
