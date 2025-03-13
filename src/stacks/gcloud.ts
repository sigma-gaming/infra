import * as gcp from '@pulumi/gcp'
import * as pulumi from '@pulumi/pulumi'
import { ComponentOutputs } from '../shared/types'

export type GcloudStackConfig = {
  googleProject: string
  registryRegion: string
  backupsBucketName: string
  backupsBucketRegion: string
  backupsAccountName: string
}

export class GcloudStack extends pulumi.ComponentResource {
  public readonly dockerRegistry: gcp.artifactregistry.Repository
  public readonly backupsBucket: gcp.storage.Bucket
  public readonly registryPuller: gcp.serviceaccount.Account
  public readonly backupAccount: gcp.serviceaccount.Account
  public readonly registryKey: gcp.serviceaccount.Key
  public readonly backupKey: gcp.serviceaccount.Key

  constructor(
    name: string,
    config: GcloudStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:GcloudStack', name, {}, opts)

    this.dockerRegistry = new gcp.artifactregistry.Repository(
      'docker-registry',
      {
        location: config.registryRegion,
        repositoryId: 'docker',
        description: 'Docker container registry',
        format: 'DOCKER',
      },
      { parent: this },
    )

    this.backupsBucket = new gcp.storage.Bucket(
      'backups',
      {
        name: config.backupsBucketName,
        location: config.backupsBucketRegion,
        forceDestroy: false,
        storageClass: 'COLDLINE',
        uniformBucketLevelAccess: true,
        publicAccessPrevention: 'enforced',
      },
      { parent: this },
    )

    this.registryPuller = new gcp.serviceaccount.Account(
      'registry-puller',
      {
        accountId: 'registry-puller',
        displayName: 'Service Account for pulling from Artifact Registry',
      },
      { parent: this },
    )

    new gcp.artifactregistry.RepositoryIamMember(
      'registry-reader',
      {
        location: this.dockerRegistry.location,
        repository: this.dockerRegistry.name,
        role: 'roles/artifactregistry.reader',
        member: pulumi.interpolate`serviceAccount:${this.registryPuller.email}`,
      },
      { parent: this },
    )

    this.backupAccount = new gcp.serviceaccount.Account(
      'backup-account',
      {
        accountId: config.backupsAccountName,
        displayName: 'Service Account for backup bucket access',
      },
      { parent: this },
    )

    const backupAdminRole = new gcp.projects.IAMCustomRole(
      'backup-admin-role',
      {
        roleId: 'backupAdmin',
        title: 'Backup Admin',
        description: 'A custom role for backup bucket access',
        permissions: [
          'storage.buckets.get',
          'storage.buckets.list',
          'storage.folders.create',
          'storage.folders.delete',
          'storage.objects.list',
          'storage.objects.create',
          'storage.objects.get',
          'storage.objects.update',
          'storage.objects.delete',
          'storage.multipartUploads.abort',
          'storage.multipartUploads.create',
          'storage.multipartUploads.listParts',
        ],
      },
      { parent: this },
    )

    new gcp.storage.BucketIAMMember(
      'backup-admin-role-binding',
      {
        bucket: this.backupsBucket.name,
        role: backupAdminRole.id,
        member: pulumi.interpolate`serviceAccount:${this.backupAccount.email}`,
      },
      { parent: this },
    )

    this.registryKey = new gcp.serviceaccount.Key(
      'registry-key',
      { serviceAccountId: this.registryPuller.name },
      { parent: this },
    )

    this.backupKey = new gcp.serviceaccount.Key(
      'backup-key',
      { serviceAccountId: this.backupAccount.name },
      { parent: this },
    )

    this.registerOutputs({
      dockerRegistry: this.dockerRegistry,
      backupsBucket: this.backupsBucket,
      registryPuller: this.registryPuller,
      backupAccount: this.backupAccount,
      registryKey: this.registryKey,
      backupKey: this.backupKey,
    } satisfies ComponentOutputs<GcloudStack>)
  }
}
