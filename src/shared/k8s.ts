import * as pulumi from '@pulumi/pulumi'

export type KubeconfigInputs = {
  host: pulumi.Input<string>
  clientCertificate: pulumi.Input<string>
  clientKey: pulumi.Input<string>
  caCertificate: pulumi.Input<string>
  insecure?: pulumi.Input<boolean>
}

export type KubeconfigOutput = pulumi.Output<{
  host: string
  clientCertificate: string
  clientKey: string
  caCertificate: string
  insecure?: boolean
}>
