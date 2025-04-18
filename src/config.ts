import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  DIGITALOCEAN_TOKEN: z.string(),
  CLOUDFLARE_API_TOKEN: z.string(),
  GITHUB_OWNER: z.string(),
  GITHUB_TOKEN: z.string(),
  INFISICAL_CLIENT_ID: z.string(),
  INFISICAL_CLIENT_SECRET: z.string(),
  INFISICAL_PRODUCTION_SERVICE_TOKEN: z.string(),
  GOOGLE_PROJECT: z.string(),
})

export const env = EnvSchema.parse(process.env)

export const domainZoneIds: Record<string, string> = {
  'sigma-k8s.app': 'CF_ID_REMOVED',
  'letsauth.app': 'CF_ID_REMOVED',
  'sigmacloud.app': 'CF_ID_REMOVED',
  'sigm.to': 'CF_ID_REMOVED',
  'sigma1.games': 'CF_ID_REMOVED',
  'sigmapay.one': 'CF_ID_REMOVED',
}

export const applicationDomains = [
  'letsauth.app',
  'sigmacloud.app',
  'sigm.to',
  'sigma1.games',
  'sigmapay.one',
]

export const applicationOrganizationMap: Record<string, string> = {
  'letsauth.app': "Let's Auth",
  'sigma1.games': 'Sigma Games',
  'sigmacloud.app': 'Sigma Cloud',
  'sigm.to': 'Sigma Games',
  'sigmapay.one': 'Sigma Pay',
}
