import * as kubernetes from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export type CommonSecretsStackConfig = {
  kubeconfig: pulumi.Input<string>
  infisicalSecretsNamespace: string
  infisicalProductionServiceToken: string
  doToken: string
}

export class CommonSecretsStack extends pulumi.ComponentResource {
  constructor(
    name: string,
    config: CommonSecretsStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:CommonSecretsStack', name, {}, opts)

    const kubernetesProvider = new kubernetes.Provider(
      'kubernetes',
      { kubeconfig: config.kubeconfig },
      { parent: this },
    )

    const infisicalSecretsNamespace = new kubernetes.core.v1.Namespace(
      'infisical-secrets',
      {
        metadata: {
          name: config.infisicalSecretsNamespace,
        },
      },
      { provider: kubernetesProvider, parent: this, retainOnDelete: true },
    )

    new kubernetes.core.v1.Secret(
      'infisical-production-service-token',
      {
        metadata: {
          name: 'infisical-service-token-production',
          namespace: infisicalSecretsNamespace.metadata.name,
        },
        stringData: {
          infisicalToken: config.infisicalProductionServiceToken,
        },
      },
      { provider: kubernetesProvider, parent: this },
    )

    new kubernetes.core.v1.Secret(
      'digitalocean',
      {
        metadata: {
          name: 'digitalocean',
          namespace: 'kube-system',
        },
        stringData: {
          'access-token': config.doToken,
        },
      },
      { provider: kubernetesProvider, parent: this },
    )

    this.registerOutputs()
  }
}
