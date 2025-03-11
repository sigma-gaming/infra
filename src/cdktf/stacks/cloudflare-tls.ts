import { OriginCaCertificate } from '@cdktf/provider-cloudflare/lib/origin-ca-certificate'
import { CloudflareProvider } from '@cdktf/provider-cloudflare/lib/provider'
import { Namespace } from '@cdktf/provider-kubernetes/lib/namespace'
import { KubernetesProvider } from '@cdktf/provider-kubernetes/lib/provider'
import { Secret } from '@cdktf/provider-kubernetes/lib/secret'
import { CertRequest } from '@cdktf/provider-tls/lib/cert-request'
import { PrivateKey } from '@cdktf/provider-tls/lib/private-key'
import { TlsProvider } from '@cdktf/provider-tls/lib/provider'
import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { configureGcsBackend } from '../shared/backend'
import { K8sCredentials } from '../shared/k8s'

export type CloudflareTlsStackConfig = {
  cloudflareApiToken: string
  applicationDomains: string[]
  applicationOrganizationMap: Record<string, string>
  k8s: K8sCredentials
}

export class CloudflareTlsStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: CloudflareTlsStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new CloudflareProvider(this, 'cloudflare', {
      apiToken: config.cloudflareApiToken,
    })

    new TlsProvider(this, 'tls', {})
    new KubernetesProvider(this, 'kubernetes', config.k8s)

    const namespace = new Namespace(this, 'application_tls_namespace', {
      metadata: {
        name: 'cloudflare-tls',
      },
    })

    for (const domain of config.applicationDomains) {
      const domainKey = domain.replace(/\./g, '_')

      const tlsPrivateKeys = new PrivateKey(
        this,
        `application_tls_key_${domainKey}`,
        { algorithm: 'RSA' },
      )

      const tlsCertRequests = new CertRequest(
        this,
        `application_tls_request_${domainKey}`,
        {
          privateKeyPem: tlsPrivateKeys.privateKeyPem,
          subject: [
            {
              commonName: '',
              organization: config.applicationOrganizationMap[domain],
            },
          ],
        },
      )

      const originCaCertificates = new OriginCaCertificate(
        this,
        `application_cert_${domainKey}`,
        {
          csr: tlsCertRequests.certRequestPem,
          hostnames: [domain, `*.${domain}`],
          requestedValidity: 5475,
          requestType: 'origin-rsa',
        },
      )

      new Secret(this, `application_tls_secret_${domainKey}`, {
        metadata: {
          name: `${domain}-cloudflare-tls`,
          namespace: namespace.metadata.name,
        },
        type: 'kubernetes.io/tls',
        data: {
          'tls.crt': originCaCertificates.certificate,
          'tls.key': tlsPrivateKeys.privateKeyPem,
        },
      })
    }
  }
}
