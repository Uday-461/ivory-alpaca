import {
  ZuploContext,
  ZuploRequest,
  ZuploResponse,
  Policy,
  PolicyContext,
} from "@zuplo/runtime";

export class IsAdminPolicy implements Policy {
  async handle(
    request: ZuploRequest,
    context: ZuploContext,
    options: any,
    policyContext: PolicyContext
  ): Promise<ZuploRequest | ZuploResponse> {
    // The user object is attached by the ApiKeyAuthPolicy
    if (!request.user || !request.user.is_admin) {
      return new Response("Forbidden: Administrator access required", {
        status: 403,
      });
    }
    // If the user is an admin, allow the request to proceed
    return request;
  }
}
