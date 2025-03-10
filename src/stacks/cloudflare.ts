import { zoneSetting } from '@cdktf/provider-cloudflare'
import { DataCloudflareZone } from '@cdktf/provider-cloudflare/lib/data-cloudflare-zone'
import { DnsRecord } from '@cdktf/provider-cloudflare/lib/dns-record'
import { CloudflareProvider } from '@cdktf/provider-cloudflare/lib/provider'
import { Ruleset } from '@cdktf/provider-cloudflare/lib/ruleset'
import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as curl2 from '../../.gen/providers/curl2'
import * as infisical from '../../.gen/providers/infisical'
import { configureGcsBackend } from '../shared/backend'

export type CloudflareStackConfig = {
  cloudflareAccountId: string
  cloudflareApiToken: string
  clusterDomain: string
  clusterName: string
  clusterTargetIp: string
  applicationDomains: string[]
  domainZoneIds: Record<string, string>
  applicationPlanMap: Record<string, string>
  applicationSecurityLevelMap: Record<string, string>
  applicationEnableEch: string
  applicationTargetIps: string[]
  infisicalEnvironment: string
  infisicalClientId: string
  infisicalClientSecret: string
  infisicalProjectId: string
}

function domainKey(domain: string) {
  return domain.replace(/\./g, '_')
}

class TypedZoneSetting extends zoneSetting.ZoneSetting {
  constructor(
    scope: Construct,
    id: string,
    config: Omit<zoneSetting.ZoneSettingConfig, 'value'> & {
      value: object | string
    },
  ) {
    super(scope, id, { ...config, value: config.value as object })
  }
}

export class CloudflareStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: CloudflareStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new CloudflareProvider(this, 'cloudflare', {
      apiToken: config.cloudflareApiToken,
    })

    new curl2.provider.Curl2Provider(this, 'curl2')

    new infisical.provider.InfisicalProvider(this, 'infisical', {
      host: 'https://eu.infisical.com',
      auth: {
        universal: {
          clientId: config.infisicalClientId,
          clientSecret: config.infisicalClientSecret,
        },
      },
    })

    const clusterZone = new DataCloudflareZone(this, 'cluster_zone', {
      zoneId: config.domainZoneIds[config.clusterDomain],
    })

    new TypedZoneSetting(this, 'cluster_setting_always_use_https', {
      zoneId: clusterZone.zoneId,
      settingId: 'always_use_https',
      value: 'on',
    })

    new TypedZoneSetting(this, 'cluster_setting_automatic_https_rewrites', {
      zoneId: clusterZone.zoneId,
      settingId: 'automatic_https_rewrites',
      value: 'on',
    })

    new TypedZoneSetting(this, 'cluster_setting_ssl', {
      zoneId: clusterZone.zoneId,
      settingId: 'ssl',
      value: 'full',
    })

    new DnsRecord(this, 'cluster_dns_record', {
      zoneId: clusterZone.zoneId,
      name: `${config.clusterName}.${config.clusterDomain}`,
      type: 'A',
      content: config.clusterTargetIp,

      ttl: 1,
      proxied: false,
    })

    new DnsRecord(this, 'cluster_dns_record_webhooks', {
      zoneId: clusterZone.zoneId,
      name: `${config.clusterName}-webhooks.${config.clusterDomain}`,
      type: 'A',
      content: config.clusterTargetIp,
      ttl: 1,
      proxied: true,
    })

    const applicationZones: Record<string, DataCloudflareZone> = {}

    for (const domain of config.applicationDomains) {
      applicationZones[domain] = new DataCloudflareZone(
        this,
        `application_zone_${domainKey(domain)}`,
        { zoneId: config.domainZoneIds[domain] },
      )
    }

    for (const [domain, zone] of Object.entries(applicationZones)) {
      new TypedZoneSetting(
        this,
        `application_setting_always_use_https_${domainKey(domain)}`,
        {
          zoneId: zone.zoneId,
          settingId: 'always_use_https',
          value: 'on',
        },
      )

      new TypedZoneSetting(
        this,
        `application_setting_automatic_https_rewrites_${domainKey(domain)}`,
        {
          zoneId: zone.zoneId,
          settingId: 'automatic_https_rewrites',
          value: 'on',
        },
      )

      new TypedZoneSetting(
        this,
        `application_setting_ssl_${domainKey(domain)}`,
        {
          zoneId: zone.zoneId,
          settingId: 'ssl',
          value: 'full',
        },
      )

      new TypedZoneSetting(
        this,
        `application_setting_security_level_${domainKey(domain)}`,
        {
          zoneId: zone.zoneId,
          settingId: 'security_level',
          value: config.applicationSecurityLevelMap[domain] || 'medium',
        },
      )
    }

    for (const [domain, zone] of Object.entries(applicationZones)) {
      for (const [ipIndex, ip] of config.applicationTargetIps.entries()) {
        new DnsRecord(
          this,
          `application_dns_record_${domainKey(domain)}_${ipIndex}`,
          {
            zoneId: zone.zoneId,
            name: domain,
            type: 'A',
            content: ip,
            ttl: 1,
            proxied: true,
          },
        )

        new DnsRecord(
          this,
          `application_dns_record_wildcard_${domainKey(domain)}_${ipIndex}`,
          {
            zoneId: zone.zoneId,
            name: `*.${domain}`,
            type: 'A',
            content: ip,
            ttl: 1,
            proxied: true,
          },
        )
      }
    }

    const bypassTokens =
      new infisical.dataInfisicalSecrets.DataInfisicalSecrets(
        this,
        'bypass_tokens',
        {
          envSlug: config.infisicalEnvironment,
          workspaceId: config.infisicalProjectId,
          folderPath: '/bypass-tokens',
        },
      )

    for (const [domain, zone] of Object.entries(applicationZones)) {
      new Ruleset(this, `application_ruleset_${domainKey(domain)}`, {
        zoneId: zone.zoneId,
        name: 'bypass-waf',
        description: 'Bypass WAF',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        rules: [
          {
            enabled: true,
            description: 'Bypass WAF',
            action: 'skip',
            expression: `(any(http.request.headers["x-bypass-waf"][*] eq "\${${bypassTokens.fqn}.secrets.WAF.value}"))`,
            actionParameters: {
              phases: [
                'http_ratelimit',
                'http_request_firewall_managed',
                'http_request_sbfm',
              ],
              products: ['uaBlock', 'bic', 'securityLevel'],
            },
            logging: {
              enabled: true,
            },
          },
        ],
      })
    }

    for (const [domain, zone] of Object.entries(applicationZones)) {
      new curl2.dataCurl2.DataCurl2(
        this,
        `manage_application_ech_${domainKey(domain)}`,
        {
          httpMethod: 'PATCH',
          uri: `https://api.cloudflare.com/client/v4/zones/${zone.zoneId}/settings/ech`,
          json: JSON.stringify({
            value: config.applicationEnableEch,
          }),
          authType: 'Bearer',
          bearerToken: config.cloudflareApiToken,
          lifecycle: {
            postcondition: [
              {
                condition: '${self.response.status_code == 200}',
                errorMessage: 'Failed to update ECH settings',
              },
            ],
          },
        },
      )
    }
  }
}
