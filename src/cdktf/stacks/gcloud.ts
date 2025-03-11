import { ArtifactRegistryRepository } from '@cdktf/provider-google/lib/artifact-registry-repository'
import { ArtifactRegistryRepositoryIamMember } from '@cdktf/provider-google/lib/artifact-registry-repository-iam-member'
import { ProjectIamCustomRole } from '@cdktf/provider-google/lib/project-iam-custom-role'
import { GoogleProvider } from '@cdktf/provider-google/lib/provider'
import { ServiceAccount } from '@cdktf/provider-google/lib/service-account'
import { ServiceAccountKey } from '@cdktf/provider-google/lib/service-account-key'
import { StorageBucket } from '@cdktf/provider-google/lib/storage-bucket'
import { StorageBucketIamMember } from '@cdktf/provider-google/lib/storage-bucket-iam-member'
import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { configureGcsBackend } from '../shared/backend'

export type GcloudStackConfig = {
  googleProject: string
  registryRegion: string
  backupsBucketName: string
  backupsBucketRegion: string
  backupsAccountName: string
  cleanupAccountName: string
}

export class GcloudStack extends TerraformStack {
  public readonly dockerRegistry: ArtifactRegistryRepository
  public readonly backupsBucket: StorageBucket
  public readonly registryPuller: ServiceAccount
  public readonly backupAccount: ServiceAccount
  public readonly cleanupAccount: ServiceAccount
  public readonly registryKey: ServiceAccountKey
  public readonly backupKey: ServiceAccountKey
  public readonly cleanupKey: ServiceAccountKey

  constructor(scope: Construct, id: string, config: GcloudStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new GoogleProvider(this, 'google', {
      project: config.googleProject,
    })

    this.dockerRegistry = new ArtifactRegistryRepository(
      this,
      'docker_registry',
      {
        location: config.registryRegion,
        repositoryId: 'docker',
        description: 'Docker container registry',
        format: 'DOCKER',
      },
    )

    this.backupsBucket = new StorageBucket(this, 'backups', {
      name: config.backupsBucketName,
      location: config.backupsBucketRegion,
      forceDestroy: false,
      storageClass: 'COLDLINE',
      uniformBucketLevelAccess: true,
      publicAccessPrevention: 'enforced',
    })

    this.registryPuller = new ServiceAccount(this, 'registry_puller', {
      accountId: 'registry-puller',
      displayName: 'Service Account for pulling from Artifact Registry',
    })

    new ArtifactRegistryRepositoryIamMember(this, 'registry_reader', {
      location: this.dockerRegistry.location,
      repository: this.dockerRegistry.name,
      role: 'roles/artifactregistry.reader',
      member: `serviceAccount:${this.registryPuller.email}`,
    })

    this.backupAccount = new ServiceAccount(this, 'backup_account', {
      accountId: config.backupsAccountName,
      displayName: 'Service Account for backup bucket access',
    })

    const backupAdminRole = new ProjectIamCustomRole(
      this,
      'backup_admin_role',
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
    )

    new StorageBucketIamMember(this, 'backup_admin_role_binding', {
      bucket: this.backupsBucket.name,
      role: backupAdminRole.id,
      member: `serviceAccount:${this.backupAccount.email}`,
    })

    this.cleanupAccount = new ServiceAccount(this, 'cleanup_account', {
      accountId: config.cleanupAccountName,
      displayName: 'Service Account for cleanup',
    })

    const cleanupAdminRole = new ProjectIamCustomRole(
      this,
      'cleanup_admin_role',
      {
        roleId: 'cleanupAdmin',
        title: 'Cleanup Admin',
        description: 'A custom role for cleanup',
        permissions: [
          'artifactregistry.repositories.get',
          'artifactregistry.repositories.list',
          'artifactregistry.dockerimages.list',
          'artifactregistry.packages.delete',
          'artifactregistry.packages.get',
          'artifactregistry.packages.list',
          'artifactregistry.tags.get',
          'artifactregistry.tags.list',
          'artifactregistry.tags.delete',
          'artifactregistry.versions.delete',
          'artifactregistry.versions.list',
          'artifactregistry.versions.get',
        ],
      },
    )

    new ArtifactRegistryRepositoryIamMember(
      this,
      'cleanup_admin_role_binding',
      {
        location: this.dockerRegistry.location,
        repository: this.dockerRegistry.name,
        role: cleanupAdminRole.id,
        member: `serviceAccount:${this.cleanupAccount.email}`,
      },
    )

    this.registryKey = new ServiceAccountKey(this, 'registry_key', {
      serviceAccountId: this.registryPuller.name,
    })

    this.backupKey = new ServiceAccountKey(this, 'backup_key', {
      serviceAccountId: this.backupAccount.name,
    })

    this.cleanupKey = new ServiceAccountKey(this, 'cleanup_key', {
      serviceAccountId: this.cleanupAccount.name,
    })
  }
}
