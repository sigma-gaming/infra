import * as digitalocean from '@cdktf/provider-digitalocean'
import { Droplet } from '@cdktf/provider-digitalocean/lib/droplet'
import { Loadbalancer } from '@cdktf/provider-digitalocean/lib/loadbalancer'
import * as tls from '@cdktf/provider-tls'
import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as talos from '../../../.gen/providers/talos'
import { ClusterKubeconfig } from '../../../.gen/providers/talos/cluster-kubeconfig'
import { DataTalosClientConfiguration } from '../../../.gen/providers/talos/data-talos-client-configuration'
import { configureGcsBackend } from '../shared/backend'

export type DigitalOceanStackConfig = {
  clusterName: string
  doToken: string
  doRegion: string
  numControlPlane: number
  numServiceWorkers: number
  numApplicationWorkersProduction: number
  talosImageId: string
  doPlanControlPlane: string
  doPlanServiceWorker: string
  doPlanApplicationWorkerProduction: string
}

export class DigitalOceanStack extends TerraformStack {
  talosConfig: DataTalosClientConfiguration
  kubeconfig: ClusterKubeconfig
  clusterLb: Loadbalancer
  controlPlaneDroplets: Droplet[]
  applicationWorkerProductionDroplets: Droplet[]

  constructor(scope: Construct, id: string, config: DigitalOceanStackConfig) {
    super(scope, id)
    configureGcsBackend(this, id)

    new digitalocean.provider.DigitaloceanProvider(this, 'digitalocean', {
      token: config.doToken,
    })

    new tls.provider.TlsProvider(this, 'tls', {})

    new talos.provider.TalosProvider(this, 'talos', {})

    const fakeTlsKey = new tls.privateKey.PrivateKey(this, 'fake_tls_key', {
      algorithm: 'RSA',
      rsaBits: 4096,
    })

    const doSshKey = new digitalocean.sshKey.SshKey(this, 'fake_ssh_key', {
      name: `${config.clusterName}-fake-ssh-key`,
      publicKey: fakeTlsKey.publicKeyOpenssh,
    })

    const talosApplicationWorkersTag = new digitalocean.tag.Tag(
      this,
      'talos_application_workers_tag',
      {
        name: `${config.clusterName}-application-worker`,
      },
    )

    const talosProductionTag = new digitalocean.tag.Tag(
      this,
      'talos_production_tag',
      {
        name: `${config.clusterName}-production`,
      },
    )

    const talosServiceWorkersTag = new digitalocean.tag.Tag(
      this,
      'talos_service_workers_tag',
      {
        name: `${config.clusterName}-service-worker`,
      },
    )

    const talosControlPlane = []
    for (let i = 0; i < config.numControlPlane; i++) {
      talosControlPlane.push(
        new digitalocean.droplet.Droplet(this, `talos_control_plane_${i}`, {
          image: config.talosImageId,
          name: `${config.clusterName}-control-plane-${i}`,
          region: config.doRegion,
          size: config.doPlanControlPlane,
          sshKeys: [doSshKey.id],
        }),
      )
    }

    const talosApplicationWorkersProduction = []
    for (let i = 0; i < config.numApplicationWorkersProduction; i++) {
      talosApplicationWorkersProduction.push(
        new digitalocean.droplet.Droplet(
          this,
          `talos_application_worker_production_${i}`,
          {
            image: config.talosImageId,
            name: `${config.clusterName}-application-worker-${i}`,
            region: config.doRegion,
            size: config.doPlanApplicationWorkerProduction,
            sshKeys: [doSshKey.id],
            tags: [talosApplicationWorkersTag.id, talosProductionTag.id],
          },
        ),
      )
    }

    const talosServiceWorkers = []
    for (let i = 0; i < config.numServiceWorkers; i++) {
      talosServiceWorkers.push(
        new digitalocean.droplet.Droplet(this, `talos_service_worker_${i}`, {
          image: config.talosImageId,
          name: `${config.clusterName}-service-worker-${i}`,
          region: config.doRegion,
          size: config.doPlanServiceWorker,
          sshKeys: [doSshKey.id],
          tags: [talosServiceWorkersTag.id],
        }),
      )
    }

    const talosLb = new digitalocean.loadbalancer.Loadbalancer(
      this,
      'talos_lb',
      {
        name: `${config.clusterName}-k8s`,
        region: config.doRegion,
        dropletIds: talosControlPlane.map(
          (droplet) => droplet.id as unknown as number,
        ),
        forwardingRule: [
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
    )

    const machineSecrets = new talos.machineSecrets.MachineSecrets(
      this,
      'machine_secrets',
      {},
    )

    const talosClientConfig =
      new talos.dataTalosClientConfiguration.DataTalosClientConfiguration(
        this,
        'talosconfig',
        {
          clusterName: config.clusterName,
          clientConfiguration: {
            caCertificate: machineSecrets.clientConfiguration.caCertificate,
            clientCertificate:
              machineSecrets.clientConfiguration.clientCertificate,
            clientKey: machineSecrets.clientConfiguration.clientKey,
          },
          endpoints: talosControlPlane.map((droplet) => droplet.ipv4Address),
        },
      )

    const machineConfigCp =
      new talos.dataTalosMachineConfiguration.DataTalosMachineConfiguration(
        this,
        'machineconfig_cp',
        {
          clusterName: config.clusterName,
          clusterEndpoint: `https://${talosLb.ip}:6443`,
          machineType: 'controlplane',
          machineSecrets: machineSecrets.machineSecrets,
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
      )

    for (const [i, element] of talosControlPlane.entries()) {
      new talos.machineConfigurationApply.MachineConfigurationApply(
        this,
        `cp_config_apply_${i}`,
        {
          clientConfiguration: machineSecrets.clientConfiguration,
          machineConfigurationInput: machineConfigCp.machineConfiguration,
          nodeAttribute: element.ipv4Address,
        },
      )
    }

    const machineConfigWorker =
      new talos.dataTalosMachineConfiguration.DataTalosMachineConfiguration(
        this,
        'machineconfig_worker',
        {
          clusterName: config.clusterName,
          clusterEndpoint: `https://${talosLb.ip}:6443`,
          machineType: 'worker',
          machineSecrets: machineSecrets.machineSecrets,
        },
      )

    for (const [i, element] of talosApplicationWorkersProduction.entries()) {
      new talos.machineConfigurationApply.MachineConfigurationApply(
        this,
        `application_worker_production_config_apply_${i}`,
        {
          clientConfiguration: machineSecrets.clientConfiguration,
          machineConfigurationInput: machineConfigWorker.machineConfiguration,
          nodeAttribute: element.ipv4Address,
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
      )
    }

    for (const [i, talosServiceWorker] of talosServiceWorkers.entries()) {
      new talos.machineConfigurationApply.MachineConfigurationApply(
        this,
        `service_worker_config_apply_${i}`,
        {
          clientConfiguration: machineSecrets.clientConfiguration,
          machineConfigurationInput: machineConfigWorker.machineConfiguration,
          nodeAttribute: talosServiceWorker.ipv4Address,
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
      )
    }

    new talos.machineBootstrap.MachineBootstrap(this, 'bootstrap', {
      clientConfiguration: machineSecrets.clientConfiguration,
      nodeAttribute: talosControlPlane[0].ipv4Address,
    })

    const kubeconfigOutput = new talos.clusterKubeconfig.ClusterKubeconfig(
      this,
      'kubeconfig',
      {
        clientConfiguration: {
          caCertificate: machineSecrets.clientConfiguration.caCertificate,
          clientCertificate:
            machineSecrets.clientConfiguration.clientCertificate,
          clientKey: machineSecrets.clientConfiguration.clientKey,
        },
        nodeAttribute: talosControlPlane[0].ipv4Address,
      },
    )

    this.talosConfig = talosClientConfig
    this.kubeconfig = kubeconfigOutput
    this.clusterLb = talosLb
    this.controlPlaneDroplets = talosControlPlane
    this.applicationWorkerProductionDroplets = talosApplicationWorkersProduction
  }
}
