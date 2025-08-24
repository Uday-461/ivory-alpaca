import {
  ZuploContext,
  ZuploRequest,
  ZuploResponse,
  Policy,
  PolicyContext,
} from "@zuplo/runtime";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Define the shape of the user data we'll attach to the request
interface AuthenticatedUserData {
  id: string;
  email: string;
  is_admin: boolean;
}

export class ApiKeyAuthPolicy implements Policy {
  async handle(
    request: ZuploRequest,
    context: ZuploContext,
    options: any,
    policyContext: PolicyContext
  ): Promise<ZuploRequest | ZuploResponse> {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized: Missing or invalid Authorization header", {
        status: 401,
      });
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer "
    // Use a simple hash for demonstration. In a real-world scenario, you'd
    // want to use a more secure, salted hash.
    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: keyData, error } = await supabase
      .from("api_keys")
      .select(
        `
        revoked,
        user:users ( id, email, is_admin )
      `
      )
      .eq("key_hash", apiKeyHash)
      .single();

    if (error || !keyData) {
      context.log.warn("Invalid API key presented.");
      return new Response("Unauthorized: Invalid API key", { status: 401 });
    }

    if (keyData.revoked) {
      return new Response("Unauthorized: API key has been revoked", {
        status: 401,
      });
    }

    // Attach user data to the request context for other handlers to use
    request.user = keyData.user as AuthenticatedUserData;
    context.log.info(`Authenticated user: ${request.user.email}`);

    return request;
  }
}
