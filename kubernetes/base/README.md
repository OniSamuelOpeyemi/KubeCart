# KubeCart Kubernetes Manifests

This folder contains the base Kubernetes manifests for deploying KubeCart to a cluster (for example, `kind`).

Prerequisites
- `kubectl` configured to use your `kind` cluster
- (Optional) `ingress-nginx` installed in the cluster for Ingress support

Apply manifests

```bash
kubectl apply -k ./kubernetes/base
```

Accessing the app

- If using NodePort for `frontend`, access via `localhost:30080` on the kind host.
- If using Ingress and `kubectl` port-forwarding, add an /etc/hosts entry for `ecommerce.local` -> 127.0.0.1 and access `http://ecommerce.local`.

Notes
- Manifests are aligned with the `docker-compose.yml` service images and database names.
- For local testing with `kind` and locally built images, set `imagePullPolicy: Never` on deployments or load images into the kind cluster with `kind load docker-image`.
