import { getConfig } from './config'
import { DigitalOceanStack } from './stacks/digital-ocean'

const config = getConfig()

export = async () => {
  new DigitalOceanStack('main-cluster', {
    clusterName: 'main-cluster',
    doToken: config.doToken,
    doRegion: 'ams3',
    numControlPlane: 1,
    numServiceWorkers: 1,
    numApplicationWorkersProduction: 1,
    talosImageId: '179820935',
    doPlanControlPlane: 's-2vcpu-4gb',
    doPlanServiceWorker: 's-2vcpu-4gb',
    doPlanApplicationWorkerProduction: 's-4vcpu-8gb',
  })
}
