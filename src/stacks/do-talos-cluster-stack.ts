import * as digitalocean from '@pulumi/digitalocean'
import * as pulumi from '@pulumi/pulumi'
import * as tls from '@pulumi/tls'
import * as talos from '@pulumiverse/talos'
import { fromBase64 } from '../shared/base64'
import { K8sCredentialsOutput } from '../shared/k8s'
import { ComponentOutputs } from '../shared/types'

export type DoTalosClusterStackConfig = {
  clusterName: string
  doRegion: string
  numControlPlane: number
  numServiceWorkers: number
  numApplicationWorkersProduction: number
  talosImageId: string
  doPlanControlPlane: string
  doPlanServiceWorker: string
  doPlanApplicationWorkerProduction: string
}

export class DoTalosClusterStack extends pulumi.ComponentResource {
  public readonly k8sCredentials: K8sCredentialsOutput
  public readonly kubeconfig: pulumi.Output<string>
  public readonly talosConfig: pulumi.Output<string>
  public readonly clusterLb: digitalocean.LoadBalancer
  public readonly controlPlaneDroplets: digitalocean.Droplet[]
  public readonly applicationWorkerProductionDroplets: digitalocean.Droplet[]

  constructor(
    name: string,
    config: DoTalosClusterStackConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('sigma:infrastructure:DoTalosClusterStack', name, {}, opts)

    const fakeTlsKey = new tls.PrivateKey(
      'fake-tls-key',
      { algorithm: 'RSA', rsaBits: 4096 },
      { parent: this },
    )

    const doSshKey = new digitalocean.SshKey(
      'fake-ssh-key',
      {
        name: `${config.clusterName}-fake-ssh-key`,
        publicKey: fakeTlsKey.publicKeyOpenssh,
      },
      { parent: this },
    )

    const talosApplicationWorkersTag = new digitalocean.Tag(
      'talos-application-workers-tag',
      { name: `${config.clusterName}-application-worker` },
      { parent: this },
    )

    const talosProductionTag = new digitalocean.Tag(
      'talos-production-tag',
      { name: `${config.clusterName}-production` },
      { parent: this },
    )

    const talosServiceWorkersTag = new digitalocean.Tag(
      'talos-service-workers-tag',
      { name: `${config.clusterName}-service-worker` },
      { parent: this },
    )

    const controlPlaneDroplets: digitalocean.Droplet[] = []

    for (let i = 0; i < config.numControlPlane; i++) {
      controlPlaneDroplets.push(
        new digitalocean.Droplet(
          `talos-control-plane-${i}`,
          {
            image: config.talosImageId,
            name: `${config.clusterName}-control-plane-${i}`,
            region: config.doRegion,
            size: config.doPlanControlPlane,
            sshKeys: [doSshKey.id],
          },
          { parent: this },
        ),
      )
    }

    const applicationWorkerProductionDroplets: digitalocean.Droplet[] = []

    for (let i = 0; i < config.numApplicationWorkersProduction; i++) {
      applicationWorkerProductionDroplets.push(
        new digitalocean.Droplet(
          `talos-application-worker-production-${i}`,
          {
            image: config.talosImageId,
            name: `${config.clusterName}-application-worker-${i}`,
            region: config.doRegion,
            size: config.doPlanApplicationWorkerProduction,
            sshKeys: [doSshKey.id],
            tags: [talosApplicationWorkersTag.name, talosProductionTag.name],
          },
          { parent: this },
        ),
      )
    }

    const talosServiceWorkers = []

    for (let i = 0; i < config.numServiceWorkers; i++) {
      talosServiceWorkers.push(
        new digitalocean.Droplet(
          `talos-service-worker-${i}`,
          {
            image: config.talosImageId,
            name: `${config.clusterName}-service-worker-${i}`,
            region: config.doRegion,
            size: config.doPlanServiceWorker,
            sshKeys: [doSshKey.id],
            tags: [talosServiceWorkersTag.name],
          },
          { parent: this },
        ),
      )
    }

    const clusterLb = new digitalocean.LoadBalancer(
      'talos-lb',
      {
        name: `${config.clusterName}-k8s`,
        region: config.doRegion,
        dropletIds: pulumi
          .all(controlPlaneDroplets.map((droplet) => droplet.id))
          .apply((ids) => ids.map((id) => Number(id))),
        forwardingRules: [
          {
            entryPort: 6443,
            entryProtocol: 'tcp',
            targetPort: 6443,
            targetProtocol: 'tcp',
          },
          {
            entryPort: 80,
            entryProtocol: 'http',
            targetPort: 80,
            targetProtocol: 'http',
          },
          {
            entryPort: 443,
            entryProtocol: 'https',
            targetPort: 443,
            targetProtocol: 'https',
            tlsPassthrough: true,
          },
        ],
        healthcheck: {
          port: 50000,
          protocol: 'tcp',
        },
      },
      { parent: this },
    )

    const secrets = new talos.machine.Secrets('secrets', {}, { parent: this })

    const clientConfiguration = talos.client.getConfigurationOutput(
      {
        clientConfiguration: secrets.clientConfiguration,
        clusterName: config.clusterName,
      },
      { parent: this },
    )

    const clusterEndpoint = pulumi.interpolate`https://${clusterLb.ip}:6443`

    const cpConfiguration = talos.machine.getConfigurationOutput(
      {
        clusterName: config.clusterName,
        machineType: 'controlplane',
        clusterEndpoint,
        machineSecrets: secrets.machineSecrets,
      },
      { parent: this },
    )

    const workerConfiguration = talos.machine.getConfigurationOutput(
      {
        clusterName: config.clusterName,
        machineType: 'worker',
        clusterEndpoint,
        machineSecrets: secrets.machineSecrets,
      },
      { parent: this },
    )

    const applyList: talos.machine.ConfigurationApply[] = []

    for (const [i, node] of controlPlaneDroplets.entries()) {
      const apply = new talos.machine.ConfigurationApply(
        `control-plane-configuration-apply-${i}`,
        {
          clientConfiguration: secrets.clientConfiguration,
          machineConfigurationInput: cpConfiguration.machineConfiguration,
          node: node.ipv4Address,
          configPatches: [
            JSON.stringify({
              machine: {
                kubelet: {
                  extraArgs: {
                    'rotate-server-certificates': 'true',
                  },
                },
              },
              cluster: {
                extraManifests: [
                  'https://raw.githubusercontent.com/alex1989hu/kubelet-serving-cert-approver/main/deploy/standalone-install.yaml',
                ],
                network: {
                  cni: {
                    name: 'flannel',
                    flannel: {
                      extraArgs: ['--iface=eth1'],
                    },
                  },
                },
                controllerManager: {
                  extraArgs: {
                    'bind-address': '0.0.0.0',
                  },
                },
                scheduler: {
                  extraArgs: {
                    'bind-address': '0.0.0.0',
                  },
                },
              },
            }),
          ],
        },
        { parent: this },
      )

      applyList.push(apply)
    }

    for (const [i, node] of applicationWorkerProductionDroplets.entries()) {
      const apply = new talos.machine.ConfigurationApply(
        `application-worker-production-configuration-apply-${i}`,
        {
          clientConfiguration: secrets.clientConfiguration,
          machineConfigurationInput: workerConfiguration.machineConfiguration,
          node: node.ipv4Address,
          configPatches: [
            JSON.stringify({
              machine: {
                kubelet: {
                  extraArgs: {
                    'rotate-server-certificates': 'true',
                  },
                },
                nodeLabels: {
                  role: 'application',
                  environment: 'production',
                },
              },
            }),
          ],
        },
        { parent: this },
      )

      applyList.push(apply)
    }

    for (const [i, node] of talosServiceWorkers.entries()) {
      const apply = new talos.machine.ConfigurationApply(
        `service-worker-configuration-apply-${i}`,
        {
          clientConfiguration: secrets.clientConfiguration,
          machineConfigurationInput: workerConfiguration.machineConfiguration,
          node: node.ipv4Address,
          configPatches: [
            JSON.stringify({
              machine: {
                kubelet: {
                  extraArgs: {
                    'rotate-server-certificates': 'true',
                  },
                },
                nodeLabels: {
                  role: 'service',
                },
              },
            }),
          ],
        },
        { parent: this },
      )

      applyList.push(apply)
    }

    const bootstrap = new talos.machine.Bootstrap(
      'bootstrap',
      {
        node: controlPlaneDroplets[0].ipv4Address,
        clientConfiguration: secrets.clientConfiguration,
      },
      {
        parent: this,
        dependsOn: applyList,
      },
    )

    const kubeconfig = new talos.cluster.Kubeconfig(
      'kubeconfig',
      {
        clientConfiguration: secrets.clientConfiguration,
        node: controlPlaneDroplets[0].ipv4Address,
      },
      { parent: this, dependsOn: [bootstrap] },
    )

    this.k8sCredentials = pulumi
      .all([
        kubeconfig.kubernetesClientConfiguration.host,
        kubeconfig.kubernetesClientConfiguration.clientCertificate,
        kubeconfig.kubernetesClientConfiguration.clientKey,
        kubeconfig.kubernetesClientConfiguration.caCertificate,
      ])
      .apply(([host, clientCertificate, clientKey, caCertificate]) => ({
        host,
        clientCertificate: fromBase64(clientCertificate),
        clientKey: fromBase64(clientKey),
        clusterCaCertificate: fromBase64(caCertificate),
      }))

    this.kubeconfig = kubeconfig.kubeconfigRaw
    this.talosConfig = clientConfiguration.talosConfig
    this.clusterLb = clusterLb
    this.controlPlaneDroplets = controlPlaneDroplets
    this.applicationWorkerProductionDroplets =
      applicationWorkerProductionDroplets

    this.registerOutputs({
      talosConfig: this.talosConfig,
      kubeconfig: kubeconfig.kubeconfigRaw,
      k8sCredentials: this.k8sCredentials,
      clusterLb: this.clusterLb,
      controlPlaneDroplets: this.controlPlaneDroplets,
      applicationWorkerProductionDroplets:
        this.applicationWorkerProductionDroplets,
    } satisfies ComponentOutputs<DoTalosClusterStack>)
  }
}
