import * as pulumi from '@pulumi/pulumi'
import * as dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

// Define config schema
const EnvSchema = z.object({
  DO_TOKEN: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  INFISICAL_CLIENT_ID: z.string().optional(),
  INFISICAL_CLIENT_SECRET: z.string().optional(),
  INFISICAL_PRODUCTION_SERVICE_TOKEN: z.string().optional(),
  GOOGLE_PROJECT: z.string().optional(),
})

export function getConfig() {
  // Parse env variables first
  const env = EnvSchema.safeParse(process.env)
  const config = new pulumi.Config()

  return {
    doToken: env.data?.DO_TOKEN ?? config.requireSecret('digitalocean:token'),
    cloudflareApiToken:
      env.data?.CLOUDFLARE_API_TOKEN ??
      config.requireSecret('cloudflare:apiToken'),
    githubToken: env.data?.GITHUB_TOKEN ?? config.requireSecret('github:token'),
    infisicalClientId:
      env.data?.INFISICAL_CLIENT_ID ??
      config.requireSecret('infisical:clientId'),
    infisicalClientSecret:
      env.data?.INFISICAL_CLIENT_SECRET ??
      config.requireSecret('infisical:clientSecret'),
    infisicalProductionServiceToken:
      env.data?.INFISICAL_PRODUCTION_SERVICE_TOKEN ??
      config.requireSecret('infisical:productionServiceToken'),
    googleProject: env.data?.GOOGLE_PROJECT ?? config.require('google:project'),
  }
}

export const domainZoneIds: Record<string, string> = {
  'sigma-k8s.app': 'CF_ID_REMOVED',
  'letsauth.app': 'CF_ID_REMOVED',
  'sigmacloud.app': 'CF_ID_REMOVED',
  'sigm.to': 'CF_ID_REMOVED',
  'sigma1.games': 'CF_ID_REMOVED',
}

export const applicationDomains = [
  'letsauth.app',
  'sigmacloud.app',
  'sigm.to',
  'sigma1.games',
]

export const applicationOrganizationMap: Record<string, string> = {
  'letsauth.app': "Let's Auth",
  'sigma1.games': 'Sigma Games',
  'sigmacloud.app': 'Sigma Cloud',
  'sigm.to': 'Sigma Games',
}
