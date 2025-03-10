import { DataGithubRepository } from '@cdktf/provider-github/lib/data-github-repository'
import { GithubProvider } from '@cdktf/provider-github/lib/provider'
import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { BootstrapGit } from '../../.gen/providers/flux/bootstrap-git'
import { FluxProvider } from '../../.gen/providers/flux/provider'
import { configureGcsBackend } from '../shared/backend'
import { K8sCredentials } from '../shared/k8s'

export type FluxStackConfig = {
  k8s: K8sCredentials
  githubToken: string
  githubOrganization: string
  githubRepository: string
  clusterName: string
}

export class FluxStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: FluxStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    // Configure GitHub provider
    new GithubProvider(this, 'github', {
      token: config.githubToken,
    })

    // Configure Flux provider with Kubernetes credentials
    new FluxProvider(this, 'flux', {
      kubernetes: {
        host: config.k8s.host,
        clientCertificate: config.k8s.clientCertificate,
        clientKey: config.k8s.clientKey,
        clusterCaCertificate: config.k8s.caCertificate,
      },
      git: {
        url: `https://github.com/${config.githubOrganization}/${config.githubRepository}`,
        http: {
          username: 'terraform',
          password: config.githubToken,
        },
      },
    })

    // Get GitHub repository
    const repository = new DataGithubRepository(this, 'flux_repository', {
      name: `${config.githubOrganization}/${config.githubRepository}`,
    })

    // Bootstrap Flux
    new BootstrapGit(this, 'flux_bootstrap', {
      dependsOn: [repository],
      path: `clusters/${config.clusterName}`,
      componentsExtra: [
        'image-reflector-controller',
        'image-automation-controller',
      ],
      deleteGitManifests: false,
    })
  }
}
