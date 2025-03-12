import * as flux from '@ptfm/flux'
import * as pulumi from '@pulumi/pulumi'
import { K8sCredentialsOutput } from '../shared/k8s'

export type FluxStackConfig = {
  k8sCredentials: K8sCredentialsOutput
  githubToken: string
  githubOrganization: string
  githubRepository: string
  clusterName: string
}

export class FluxStack extends pulumi.ComponentResource {
  constructor(
    name: string,
    config: FluxStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:FluxStack', name, {}, opts)

    const fluxProvider = new flux.Provider(
      'flux',
      {
        kubernetes: config.k8sCredentials,
        git: {
          url: `https://github.com/${config.githubOrganization}/${config.githubRepository}`,
          http: {
            username: 'terraform',
            password: config.githubToken,
          },
        },
      },
      { parent: this },
    )

    new flux.BootstrapGit(
      'flux-bootstrap',
      {
        path: `clusters/${config.clusterName}`,
        componentsExtras: [
          'image-reflector-controller',
          'image-automation-controller',
        ],
      },
      { provider: fluxProvider, parent: this },
    )

    this.registerOutputs()
  }
}
