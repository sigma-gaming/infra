import { GcsBackend, TerraformStack } from 'cdktf'

export function configureGcsBackend(stack: TerraformStack, stackName: string) {
  new GcsBackend(stack, {
    bucket: 'sigma-terraform-state-production',
    prefix: `prod/${stackName}`,
    credentials: '../../../backend/state-gcs-key.json',
  })
}
