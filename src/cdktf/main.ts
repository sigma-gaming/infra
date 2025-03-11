import { App, Fn } from 'cdktf'
import { env } from './env'
import { K8sCredentials } from './shared/k8s'
import { CloudflareStack } from './stacks/cloudflare'
import { CloudflareTlsStack } from './stacks/cloudflare-tls'
import { CommonSecretsStack } from './stacks/common-secrets'
import { DigitalOceanStack } from './stacks/digital-ocean'
import { FluxStack } from './stacks/flux'
import { FluxWebhookStack } from './stacks/flux-webhook'
import { GcloudStack } from './stacks/gcloud'
import { GcloudSecretsStack } from './stacks/gcloud-secrets'

const app = new App()

const doStack = new DigitalOceanStack(app, 'digital-ocean', {
  clusterName: 'main',
  doToken: env.DO_TOKEN,
  doRegion: 'ams3',
  numControlPlane: 1,
  numServiceWorkers: 1,
  numApplicationWorkersProduction: 1,
  talosImageId: '179820935',
  doPlanControlPlane: 's-2vcpu-4gb',
  doPlanServiceWorker: 's-2vcpu-4gb',
  doPlanApplicationWorkerProduction: 's-4vcpu-8gb',
})

const { host, clientCertificate, clientKey, caCertificate } =
  doStack.kubeconfig.kubernetesClientConfiguration

const k8s: K8sCredentials = {
  host,
  clientCertificate: Fn.base64decode(clientCertificate),
  clientKey: Fn.base64decode(clientKey),
  caCertificate: Fn.base64decode(caCertificate),
  insecure: true,
}

new CommonSecretsStack(app, 'common-secrets', {
  k8s,
  infisicalSecretsNamespace: 'infisical-system-secrets',
  infisicalProductionServiceToken: env.INFISICAL_PRODUCTION_SERVICE_TOKEN,
  doToken: env.DO_TOKEN,
})

const applicationDomains = [
  'letsauth.app',
  'sigmacloud.app',
  'sigm.to',
  'sigma1.games',
]

const cloudflareStack = new CloudflareStack(app, 'cloudflare', {
  cloudflareAccountId: 'CF_ID_REMOVED',
  cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
  clusterDomain: 'sigma-k8s.app',
  clusterName: 'main',
  clusterTargetIp: doStack.clusterLb.ip,
  applicationDomains,
  domainZoneIds: {
    'sigma-k8s.app': 'CF_ID_REMOVED',
    'letsauth.app': 'CF_ID_REMOVED',
    'sigmacloud.app': 'CF_ID_REMOVED',
    'sigm.to': 'CF_ID_REMOVED',
    'sigma1.games': 'CF_ID_REMOVED',
  },
  applicationPlanMap: {},
  applicationSecurityLevelMap: {},
  applicationEnableEch: 'off',
  applicationTargetIps: doStack.applicationWorkerProductionDroplets.map(
    (droplet) => droplet.ipv4Address,
  ),
  infisicalEnvironment: 'prod',
  infisicalClientId: env.INFISICAL_CLIENT_ID,
  infisicalClientSecret: env.INFISICAL_CLIENT_SECRET,
  infisicalProjectId: '67b7b10c-0339-426d-b45d-e129d187785c',
})

const cloudflareTlsStack = new CloudflareTlsStack(app, 'cloudflare-tls', {
  k8s,
  cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
  applicationDomains,
  applicationOrganizationMap: {
    'letsauth.app': "Let's Auth",
    'sigma1.games': 'Sigma Games',
    'sigmacloud.app': 'Sigma Cloud',
    'sigm.to': 'Sigma Games',
  },
})

const registryRegion = 'europe-west4'

const gcloudStack = new GcloudStack(app, 'gcloud', {
  googleProject: env.GOOGLE_PROJECT,
  registryRegion,
  backupsBucketName: 'sigma-backups',
  backupsBucketRegion: 'eu',
  backupsAccountName: 'backups',
  cleanupAccountName: 'cleanup',
})

const gcloudSecretsStack = new GcloudSecretsStack(app, 'gcloud-secrets', {
  k8s,
  googleCredsNamespace: 'google-creds',
  registryCredsNamespace: 'registry-creds',
  backupsCredentialsSecretName: 'gcloud-backups-credentials',
  cleanupCredsSecretName: 'gcloud-cleanup-credentials',
  registryRegion,
  registryPullerEmail: gcloudStack.registryPuller.email,
  registryKey: Fn.base64decode(gcloudStack.registryKey.privateKey),
  backupKey: Fn.base64decode(gcloudStack.backupKey.privateKey),
  cleanupKey: Fn.base64decode(gcloudStack.cleanupKey.privateKey),
})

const fluxStack = new FluxStack(app, 'flux', {
  k8s,
  githubToken: env.GITHUB_TOKEN,
  githubOrganization: 'sigma-gaming',
  githubRepository: 'k8s',
  clusterName: 'main',
})

const fluxWebhookStack = new FluxWebhookStack(app, 'flux-webhook', {
  k8s,
  githubToken: env.GITHUB_TOKEN,
  githubOrganization: 'sigma-gaming',
  githubRepository: 'k8s',
  clusterDomain: 'sigma-k8s.app',
  clusterName: 'main',
})

cloudflareTlsStack.addDependency(cloudflareStack)
fluxStack.addDependency(doStack)
fluxStack.addDependency(cloudflareStack)
fluxStack.addDependency(gcloudStack)
fluxStack.addDependency(cloudflareTlsStack)
fluxStack.addDependency(gcloudSecretsStack)
fluxWebhookStack.addDependency(fluxStack)

app.synth()
