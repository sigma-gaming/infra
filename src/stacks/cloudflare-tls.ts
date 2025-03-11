import * as cloudflare from '@pulumi/cloudflare'
import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as tls from '@pulumi/tls'

export type CloudflareTlsStackConfig = {
  applicationDomains: string[]
  applicationOrganizationMap: Record<string, string>
  kubeconfig: pulumi.Input<string>
}

export class CloudflareTlsStack extends pulumi.ComponentResource {
  constructor(
    name: string,
    config: CloudflareTlsStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:CloudflareTlsStack', name, {}, opts)

    const k8sProvider = new k8s.Provider(
      'kubernetes',
      { kubeconfig: config.kubeconfig },
      { parent: this },
    )

    const namespace = new k8s.core.v1.Namespace(
      'application_tls_namespace',
      {
        metadata: {
          name: 'cloudflare-tls',
        },
      },
      { provider: k8sProvider, parent: this },
    )

    for (const domain of config.applicationDomains) {
      const domainKey = domain.replace(/\./g, '_')

      const tlsPrivateKey = new tls.PrivateKey(
        `application_tls_key_${domainKey}`,
        {
          algorithm: 'RSA',
          rsaBits: 2048,
        },
        { parent: this },
      )

      const tlsCertRequest = new tls.CertRequest(
        `application_tls_request_${domainKey}`,
        {
          privateKeyPem: tlsPrivateKey.privateKeyPem,
          subject: {
            commonName: '',
            organization: config.applicationOrganizationMap[domain],
          },
        },
        { parent: this },
      )

      const originCaCertificate = new cloudflare.OriginCaCertificate(
        `application_cert_${domainKey}`,
        {
          csr: tlsCertRequest.certRequestPem,
          hostnames: [domain, `*.${domain}`],
          requestedValidity: 5475, /// 15 years in days
          requestType: 'origin-rsa',
        },
        { parent: this },
      )

      new k8s.core.v1.Secret(
        `application_tls_secret_${domainKey}`,
        {
          metadata: {
            name: `${domain}-cloudflare-tls`,
            namespace: namespace.metadata.name,
          },
          type: 'kubernetes.io/tls',
          stringData: {
            'tls.crt': originCaCertificate.certificate,
            'tls.key': tlsPrivateKey.privateKeyPem,
          },
        },
        { provider: k8sProvider, parent: this, dependsOn: [namespace] },
      )
    }

    this.registerOutputs()
  }
}
