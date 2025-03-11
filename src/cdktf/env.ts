import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  DO_TOKEN: z.string(),
  CLOUDFLARE_API_TOKEN: z.string(),
  GITHUB_TOKEN: z.string(),
  INFISICAL_CLIENT_ID: z.string(),
  INFISICAL_CLIENT_SECRET: z.string(),
  INFISICAL_PRODUCTION_SERVICE_TOKEN: z.string(),
  GOOGLE_PROJECT: z.string(),
})

export const env = EnvSchema.parse(process.env)
