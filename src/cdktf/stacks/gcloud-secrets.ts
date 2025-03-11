import { Namespace } from '@cdktf/provider-kubernetes/lib/namespace'
import { KubernetesProvider } from '@cdktf/provider-kubernetes/lib/provider'
import { Secret } from '@cdktf/provider-kubernetes/lib/secret'
import { ServiceAccount } from '@cdktf/provider-kubernetes/lib/service-account'
import { Fn, TerraformLocal, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { configureGcsBackend } from '../shared/backend'
import { K8sCredentials } from '../shared/k8s'

export type GcloudSecretsStackConfig = {
  k8s: K8sCredentials
  googleCredsNamespace: string
  registryCredsNamespace: string
  backupsCredentialsSecretName: string
  cleanupCredsSecretName: string
  registryRegion: string
  registryPullerEmail: string
  registryKey: string
  backupKey: string
  cleanupKey: string
}

export class GcloudSecretsStack extends TerraformStack {
  public readonly googleCredsNamespace: Namespace
  public readonly registryCredsNamespace: Namespace
  public readonly registryCredentials: Secret
  public readonly registryPuller: ServiceAccount
  public readonly backupCredentials: Secret
  public readonly cleanupCredentials: Secret

  constructor(scope: Construct, id: string, config: GcloudSecretsStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new KubernetesProvider(this, 'kubernetes', config.k8s)

    this.googleCredsNamespace = new Namespace(this, 'google_creds', {
      metadata: {
        name: config.googleCredsNamespace,
      },
    })

    this.registryCredsNamespace = new Namespace(this, 'registry_creds', {
      metadata: {
        name: config.registryCredsNamespace,
      },
    })

    const dockerConfigJson = new TerraformLocal(
      this,
      'docker_config_json',
      Fn.jsonencode({
        auths: {
          [`${config.registryRegion}-docker.pkg.dev`]: {
            username: '_json_key',
            password: config.registryKey,
            email: config.registryPullerEmail,
            auth: Fn.base64encode(
              Fn.join(':', ['_json_key', config.registryKey]),
            ),
          },
        },
      }),
    )

    this.registryCredentials = new Secret(this, 'registry_credentials', {
      metadata: {
        name: 'google-registry-creds',
        namespace: this.registryCredsNamespace.metadata.name,
      },
      type: 'kubernetes.io/dockerconfigjson',
      data: { '.dockerconfigjson': dockerConfigJson.expression },
    })

    this.registryPuller = new ServiceAccount(this, 'registry_puller', {
      metadata: {
        name: 'google-registry-puller',
        namespace: this.registryCredsNamespace.metadata.name,
      },

      imagePullSecret: [
        {
          name: this.registryCredentials.metadata.name,
        },
      ],
    })

    this.backupCredentials = new Secret(this, 'backup_credentials', {
      metadata: {
        name: config.backupsCredentialsSecretName,
        namespace: this.googleCredsNamespace.metadata.name,
      },

      data: {
        key: config.backupKey,
      },
    })

    this.cleanupCredentials = new Secret(this, 'cleanup_credentials', {
      metadata: {
        name: config.cleanupCredsSecretName,
        namespace: this.googleCredsNamespace.metadata.name,
      },

      data: {
        key: config.cleanupKey,
      },
    })
  }
}
