import * as infisical from '@ptfm/infisical'
import * as cloudflare from '@pulumi/cloudflare'
import * as pulumi from '@pulumi/pulumi'
import { CloudflareEchSetting } from '../resources/cloudflare-ech'

export type CloudflareStackConfig = {
  cloudflareAccountId: string
  cloudflareApiToken: string
  clusterDomain: string
  clusterName: string
  clusterTargetIp: pulumi.Output<string>
  applicationDomains: string[]
  domainZoneIds: Record<string, string>
  applicationPlanMap: Record<string, string>
  applicationSecurityLevelMap: Record<string, string>
  applicationEnableEch: 'on' | 'off'
  applicationTargetIps: pulumi.Output<string>[]
  infisicalEnvironment: string
  infisicalClientId: string
  infisicalClientSecret: string
  infisicalProjectId: string
}

function domainKey(domain: string): string {
  return domain.replace(/\./g, '_')
}

export class CloudflareStack extends pulumi.ComponentResource {
  constructor(
    name: string,
    config: CloudflareStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:CloudflareStack', name, {}, opts)

    const infisicalProvider = new infisical.Provider(
      'infisical',
      {
        host: 'https://eu.infisical.com',
        auth: {
          universal: {
            clientId: config.infisicalClientId,
            clientSecret: config.infisicalClientSecret,
          },
        },
      },
      { parent: this },
    )

    const clusterZone = cloudflare.getZoneOutput(
      { accountId: config.cloudflareAccountId, name: config.clusterDomain },
      { parent: this },
    )

    new cloudflare.ZoneSettingsOverride(
      'cluster_setting_always_use_https',
      {
        zoneId: clusterZone.zoneId,
        settings: {
          alwaysUseHttps: 'on',
          automaticHttpsRewrites: 'on',
          ssl: 'flexible',
        },
      },
      { parent: this },
    )

    new cloudflare.Record(
      'cluster_dns_record',
      {
        zoneId: clusterZone.zoneId,
        name: `${config.clusterName}.${config.clusterDomain}`,
        type: 'A',
        content: config.clusterTargetIp,
        ttl: 1,
        proxied: false,
      },
      { parent: this },
    )

    new cloudflare.Record(
      'cluster_dns_record_webhooks',
      {
        zoneId: clusterZone.zoneId,
        name: `${config.clusterName}-webhooks.${config.clusterDomain}`,
        type: 'A',
        content: config.clusterTargetIp,
        ttl: 1,
        proxied: true,
      },
      { parent: this },
    )

    const applicationZones: Record<
      string,
      pulumi.Output<cloudflare.GetZoneResult>
    > = {}

    for (const domain of config.applicationDomains) {
      applicationZones[domain] = cloudflare.getZoneOutput(
        { accountId: config.cloudflareAccountId, name: domain },
        { parent: this },
      )
    }

    for (const [domain, zone] of Object.entries(applicationZones)) {
      new cloudflare.ZoneSettingsOverride(
        `application_setting_always_use_https_${domainKey(domain)}`,
        {
          zoneId: zone.zoneId,
          settings: {
            alwaysUseHttps: 'on',
            automaticHttpsRewrites: 'on',
            ssl: 'full',
            securityLevel:
              config.applicationSecurityLevelMap[domain] || 'medium',
          },
        },
        { parent: this },
      )

      new CloudflareEchSetting(
        `application_ech_setting_${domainKey(domain)}`,
        {
          zoneId: zone.zoneId,
          apiToken: config.cloudflareApiToken,
          value: config.applicationEnableEch,
        },
        { parent: this },
      )
    }

    for (const [domain, zone] of Object.entries(applicationZones)) {
      for (let i = 0; i < config.applicationTargetIps.length; i++) {
        const ip = config.applicationTargetIps[i]

        new cloudflare.Record(
          `application_dns_record_${domainKey(domain)}_${i}`,
          {
            zoneId: zone.zoneId,
            name: domain,
            type: 'A',
            content: ip,
            ttl: 1,
            proxied: true,
          },
          { parent: this },
        )

        new cloudflare.Record(
          `application_dns_record_wildcard_${domainKey(domain)}_${i}`,
          {
            zoneId: zone.zoneId,
            name: `*.${domain}`,
            type: 'A',
            content: ip,
            ttl: 1,
            proxied: true,
          },
          { parent: this },
        )
      }
    }

    const bypassTokens = infisical.getSecretsOutput(
      {
        envSlug: config.infisicalEnvironment,
        workspaceId: config.infisicalProjectId,
        folderPath: '/bypass-tokens',
      },
      { parent: this, provider: infisicalProvider },
    )

    for (const [domain, zone] of Object.entries(applicationZones)) {
      new cloudflare.Ruleset(
        `application_ruleset_${domainKey(domain)}`,
        {
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
              expression: pulumi.interpolate`(any(http.request.headers["x-bypass-waf"][*] eq "${bypassTokens.secrets.WAF.value}"))`,
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
        },
        { parent: this },
      )
    }

    this.registerOutputs()
  }
}
