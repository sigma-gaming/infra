import * as kubernetes from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import { ComponentOutputs } from '../shared/types'

export type GcloudSecretsStackConfig = {
  kubeconfig: pulumi.Input<string>
  googleCredsNamespace: string
  registryCredsNamespace: string
  backupsCredentialsSecretName: string
  cleanupCredsSecretName: string
  registryRegion: string
  registryPullerEmail: pulumi.Input<string>
  registryKey: pulumi.Input<string>
  backupKey: pulumi.Input<string>
  cleanupKey: pulumi.Input<string>
}

export class GcloudSecretsStack extends pulumi.ComponentResource {
  public readonly googleCredsNamespace: kubernetes.core.v1.Namespace
  public readonly registryCredsNamespace: kubernetes.core.v1.Namespace
  public readonly registryCredentials: kubernetes.core.v1.Secret
  public readonly registryPuller: kubernetes.core.v1.ServiceAccount
  public readonly backupCredentials: kubernetes.core.v1.Secret
  public readonly cleanupCredentials: kubernetes.core.v1.Secret

  constructor(
    name: string,
    config: GcloudSecretsStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:GcloudSecretsStack', name, {}, opts)

    const k8sProvider = new kubernetes.Provider(
      'kubernetes',
      {
        kubeconfig: config.kubeconfig,
      },
      { parent: this },
    )

    this.googleCredsNamespace = new kubernetes.core.v1.Namespace(
      'google-creds',
      {
        metadata: {
          name: config.googleCredsNamespace,
        },
      },
      { provider: k8sProvider, parent: this },
    )

    this.registryCredsNamespace = new kubernetes.core.v1.Namespace(
      'registry-creds',
      {
        metadata: {
          name: config.registryCredsNamespace,
        },
      },
      { provider: k8sProvider, parent: this },
    )

    const dockerConfigJson = pulumi
      .all([
        config.registryKey,
        config.registryPullerEmail,
        config.registryRegion,
      ])
      .apply(([key, email, region]) => {
        const authStr = `_json_key:${key}`
        const auth = Buffer.from(authStr).toString('base64')

        return JSON.stringify({
          auths: {
            [`${region}-docker.pkg.dev`]: {
              username: '_json_key',
              password: key,
              email,
              auth,
            },
          },
        })
      })

    this.registryCredentials = new kubernetes.core.v1.Secret(
      'registry-credentials',
      {
        metadata: {
          name: 'google-registry-creds',
          namespace: this.registryCredsNamespace.metadata.name,
        },
        type: 'kubernetes.io/dockerconfigjson',
        stringData: {
          '.dockerconfigjson': dockerConfigJson,
        },
      },
      { provider: k8sProvider, parent: this },
    )

    this.registryPuller = new kubernetes.core.v1.ServiceAccount(
      'registry-puller',
      {
        metadata: {
          name: 'google-registry-puller',
          namespace: this.registryCredsNamespace.metadata.name,
        },
        imagePullSecrets: [
          {
            name: this.registryCredentials.metadata.name,
          },
        ],
      },
      { provider: k8sProvider, parent: this },
    )

    this.backupCredentials = new kubernetes.core.v1.Secret(
      'backup-credentials',
      {
        metadata: {
          name: config.backupsCredentialsSecretName,
          namespace: this.googleCredsNamespace.metadata.name,
        },
        stringData: {
          key: config.backupKey,
        },
      },
      { provider: k8sProvider, parent: this },
    )

    this.cleanupCredentials = new kubernetes.core.v1.Secret(
      'cleanup-credentials',
      {
        metadata: {
          name: config.cleanupCredsSecretName,
          namespace: this.googleCredsNamespace.metadata.name,
        },
        stringData: {
          key: config.cleanupKey,
        },
      },
      { provider: k8sProvider, parent: this },
    )

    this.registerOutputs({
      googleCredsNamespace: this.googleCredsNamespace,
      registryCredsNamespace: this.registryCredsNamespace,
      registryCredentials: this.registryCredentials,
      registryPuller: this.registryPuller,
      backupCredentials: this.backupCredentials,
      cleanupCredentials: this.cleanupCredentials,
    } satisfies ComponentOutputs<GcloudSecretsStack>)
  }
}
