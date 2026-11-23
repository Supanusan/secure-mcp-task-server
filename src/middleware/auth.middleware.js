import { createAuth0Api, requiresAuth } from "@auth0/auth0-express-api";

import { env } from "../config/env.js";

// Configure Auth0 to validate access tokens.
export const auth0Api = createAuth0Api({
  domain: env.AUTH0_DOMAIN,
  audience: env.AUTH0_AUDIENCE,
});

// Require a valid access token.
export const authenticateMcp = requiresAuth();
