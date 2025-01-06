# Sigma K8S

## Create registry credentials secret

```bash
kubectl create secret docker-registry google-registry-creds \
  --docker-server eu.gcr.io \
  --docker-username _json_key \
  --docker-email registry@sigma-k8s.app \
  --docker-password="$(cat ./key.json)" \
  --dry-run=client -o yaml
```

## Kubeseal

Get public key:

```bash
kubeseal --fetch-cert \
  --controller-name=sealed-secrets \
  --controller-namespace=sealed-secrets \
  > pub-sealed-secrets.pem
```

Seal a secret:

```bash
kubeseal --format=yaml --cert=clusters/<cluster>/pub-sealed-secrets.pem < basic-auth.yaml > basic-auth-sealed.yaml
```

## Setup Cilium for Talos

```bash
helm install cilium cilium/cilium --version 1.15.6 \
  --namespace kube-system \
  --set ipam.mode=kubernetes \
  --set kubeProxyReplacement=true \
  --set securityContext.capabilities.ciliumAgent="{CHOWN,KILL,NET_ADMIN,NET_RAW,IPC_LOCK,SYS_ADMIN,SYS_RESOURCE,DAC_OVERRIDE,FOWNER,SETGID,SETUID}" \
  --set securityContext.capabilities.cleanCiliumState="{NET_ADMIN,SYS_ADMIN,SYS_RESOURCE}" \
  --set cgroup.autoMount.enabled=false \
  --set cgroup.hostRoot=/sys/fs/cgroup \
  --set k8sServiceHost=localhost \
  --set k8sServicePort=7445 \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true
```

## Setup Flux

Bootstrap:

```bash
flux bootstrap github \
  --token-auth \
  --owner=sigma-gaming \
  --repository=k8s \
  --branch=main \
  --path=clusters/primary \
  --components-extra image-reflector-controller,image-automation-controller
```

### Webhook

1. Generate token:

    ```bash
    head -c 12 /dev/urandom | shasum | cut -d ' ' -f1
    ```

2. Insert generated token into `webhook-token` secret manifest (`components/flux-webhook/flux-webhook.yaml`)
3. Reconcile repository
4. Extract webhook url path from Receiver resource status
5. Setup webhook in repository (`https://sigma-k8s.app/webhooks/flux/hook/<hook-path>`)
