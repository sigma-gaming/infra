import { GithubProvider } from '@cdktf/provider-github/lib/provider'
import { RepositoryWebhook } from '@cdktf/provider-github/lib/repository-webhook'
import { Manifest } from '@cdktf/provider-kubernetes/lib/manifest'
import { KubernetesProvider } from '@cdktf/provider-kubernetes/lib/provider'
import { Secret } from '@cdktf/provider-kubernetes/lib/secret'
import { Id } from '@cdktf/provider-random/lib/id'
import { RandomProvider } from '@cdktf/provider-random/lib/provider'
import { Fn, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { configureGcsBackend } from '../shared/backend'
import { K8sCredentials } from '../shared/k8s'

export type FluxWebhookStackConfig = {
  k8s: K8sCredentials
  githubToken: string
  githubOrganization: string
  githubRepository: string
  clusterDomain: string
  clusterName: string
}

export class FluxWebhookStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: FluxWebhookStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new GithubProvider(this, 'github', {
      owner: config.githubOrganization,
      token: config.githubToken,
    })

    new KubernetesProvider(this, 'kubernetes', config.k8s)

    new RandomProvider(this, 'random', {})

    // Generate random webhook token
    const webhookToken = new Id(this, 'flux_webhook_token', {
      byteLength: 20,
    })

    // Create Kubernetes secret for webhook token
    const webhookTokenSecret = new Secret(this, 'flux_webhook_token_secret', {
      metadata: {
        name: 'webhook-token',
        namespace: 'flux-system',
      },
      type: 'Opaque',
      data: {
        token: webhookToken.hex,
      },
    })

    // Create Flux webhook receiver
    const webhookReceiver = new Manifest(this, 'flux_webhook_receiver', {
      manifest: {
        apiVersion: 'notification.toolkit.fluxcd.io/v1',
        kind: 'Receiver',
        metadata: {
          name: 'flux-system',
          namespace: 'flux-system',
        },
        spec: {
          type: 'github',
          events: ['ping', 'push'],
          secretRef: {
            name: webhookTokenSecret.metadata.name,
          },
          resources: [
            {
              kind: 'GitRepository',
              name: 'flux-system',
            },
          ],
        },
      },
    })

    // Create GitHub repository webhook
    new RepositoryWebhook(this, 'flux_webhook', {
      dependsOn: [webhookReceiver],
      repository: config.githubRepository,
      events: ['push'],
      configuration: {
        url: `https://${config.clusterName}-webhooks.${config.clusterDomain}/flux/hook/${Fn.sha256(Fn.join('', [webhookToken.hex, 'flux-system', 'flux-system']))}`,
        contentType: 'form',
        secret: webhookToken.hex,
      },
    })
  }
}
