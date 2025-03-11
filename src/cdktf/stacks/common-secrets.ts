import { Namespace } from '@cdktf/provider-kubernetes/lib/namespace'
import { KubernetesProvider } from '@cdktf/provider-kubernetes/lib/provider'
import { Secret } from '@cdktf/provider-kubernetes/lib/secret'
import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { configureGcsBackend } from '../shared/backend'
import { K8sCredentials } from '../shared/k8s'

export type CommonSecretsStackConfig = {
  k8s: K8sCredentials
  infisicalSecretsNamespace: string
  infisicalProductionServiceToken: string
  doToken: string
}

export class CommonSecretsStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: CommonSecretsStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new KubernetesProvider(this, 'kubernetes', config.k8s)

    const infisicalSecretsNamespace = new Namespace(this, 'infisical_secrets', {
      metadata: {
        name: config.infisicalSecretsNamespace,
      },
    })

    new Secret(this, 'infisical_production_service_token', {
      metadata: {
        name: 'infisical-service-token-production',
        namespace: infisicalSecretsNamespace.metadata.name,
      },

      data: {
        infisicalToken: config.infisicalProductionServiceToken,
      },
    })

    new Secret(this, 'digitalocean', {
      metadata: {
        name: 'digitalocean',
        namespace: 'kube-system',
      },

      data: {
        'access-token': config.doToken,
      },
    })
  }
}
