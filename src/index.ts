import {
  applicationDomains,
  applicationOrganizationMap,
  domainZoneIds,
  env,
} from './config'
import { FluxBootstrap } from './resources/flux-bootstrap'
import { fromBase64 } from './shared/base64'
import { CloudflareStack } from './stacks/cloudflare'
import { CloudflareTlsStack } from './stacks/cloudflare-tls'
import { CommonSecretsStack } from './stacks/common-secrets'
import { DoTalosClusterStack } from './stacks/do-talos-cluster-stack'
import { FluxWebhookStack } from './stacks/flux-webhook'
import { GcloudStack } from './stacks/gcloud'
import { GcloudCleanupStack } from './stacks/gcloud-cleanup'
import { GcloudSecretsStack } from './stacks/gcloud-secrets'

export = async () => {
  const mainCluster = new DoTalosClusterStack('main-cluster', {
    clusterName: 'main',
    doRegion: 'ams3',
    numControlPlane: 1,
    numServiceWorkers: 1,
    numApplicationWorkersProduction: 1,
    talosImageId: '179820935',
    doPlanControlPlane: 's-2vcpu-4gb',
    doPlanServiceWorker: 's-2vcpu-4gb',
    doPlanApplicationWorkerProduction: 's-4vcpu-8gb',
  })

  new CommonSecretsStack('main-common-secrets', {
    kubeconfig: mainCluster.kubeconfig,
    infisicalSecretsNamespace: 'infisical-system-secrets',
    infisicalProductionServiceToken: env.INFISICAL_PRODUCTION_SERVICE_TOKEN,
    doToken: env.DIGITALOCEAN_TOKEN,
  })

  const mainCloudflare = new CloudflareStack('main-cloudflare', {
    cloudflareAccountId: 'CF_ID_REMOVED',
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    clusterDomain: 'sigma-k8s.app',
    clusterName: 'main',
    clusterTargetIp: mainCluster.clusterLb.ip,
    applicationDomains,
    domainZoneIds,
    applicationPlanMap: {},
    applicationSecurityLevelMap: {},
    applicationEnableEch: 'off',
    applicationTargetIps: mainCluster.applicationWorkerProductionDroplets.map(
      (droplet) => droplet.ipv4Address,
    ),
    infisicalEnvironment: 'prod',
    infisicalClientId: env.INFISICAL_CLIENT_ID,
    infisicalClientSecret: env.INFISICAL_CLIENT_SECRET,
    infisicalProjectId: '67b7b10c-0339-426d-b45d-e129d187785c',
  })

  new CloudflareTlsStack(
    'main-cloudflare-tls',
    {
      applicationDomains,
      applicationOrganizationMap,
      kubeconfig: mainCluster.kubeconfig,
    },
    { dependsOn: mainCloudflare },
  )

  const registryRegion = 'europe-west4'

  const gcloudStack = new GcloudStack('main-gcloud', {
    googleProject: env.GOOGLE_PROJECT,
    registryRegion,
    backupsBucketName: 'sigma-backups',
    backupsBucketRegion: 'eu',
    backupsAccountName: 'backups',
  })

  new GcloudSecretsStack(
    'main-gcloud-secrets',
    {
      kubeconfig: mainCluster.kubeconfig,
      googleCredsNamespace: 'google-creds',
      registryCredsNamespace: 'registry-creds',
      backupsCredentialsSecretName: 'gcloud-backups-credentials',
      registryRegion,
      registryPullerEmail: gcloudStack.registryPuller.email,
      registryKey: gcloudStack.registryKey.privateKey.apply(fromBase64),
      backupKey: gcloudStack.backupKey.privateKey.apply(fromBase64),
    },
    {
      dependsOn: [gcloudStack, mainCluster],
    },
  )

  new GcloudCleanupStack(
    'main-gcloud-cleanup',
    {
      projectId: env.GOOGLE_PROJECT,
      registryRegion,
      registryRepository: gcloudStack.dockerRegistry.name,
      schedulerRegion: 'europe-west1',
      cleanupAccountName: 'cleanup',
    },
    { dependsOn: [gcloudStack] },
  )

  const fluxBootstrap = new FluxBootstrap(
    'main-flux-bootstrap',
    {
      githubOwner: env.GITHUB_OWNER,
      githubRepository: 'k8s',
      githubToken: env.GITHUB_TOKEN,
      clusterName: 'main',
      kubeconfig: mainCluster.kubeconfig,
      componentsExtras: [
        'image-reflector-controller',
        'image-automation-controller',
      ],
    },
    { dependsOn: mainCluster },
  )

  new FluxWebhookStack(
    'main-flux-webhook',
    {
      kubeconfig: mainCluster.kubeconfig,
      githubToken: env.GITHUB_TOKEN,
      githubOrganization: env.GITHUB_OWNER,
      githubRepository: 'k8s',
      clusterDomain: 'sigma-k8s.app',
      clusterName: 'main',
    },
    { dependsOn: [mainCluster, fluxBootstrap] },
  )

  return {
    kubeconfig: mainCluster.kubeconfig,
    talosConfig: mainCluster.talosConfig,
  }
}
