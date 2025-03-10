export type K8sCredentials = {
  host: string
  clientCertificate: string
  clientKey: string
  caCertificate: string
  insecure?: boolean
}
