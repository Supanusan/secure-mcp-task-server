import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1),

  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().url(),
});

export const env = environmentSchema.parse(process.env);
