#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="$ROOT_DIR/kubernetes/base"
CLUSTER_NAME="kubecart" 

# Images mapped to app directories
declare -A IMAGEMAP=(
  [oniesammy/kubecart-frontend:v1.0.0]="$ROOT_DIR/apps/frontend"
  [oniesammy/kubecart-api-gateway:v1.0.0]="$ROOT_DIR/apps/api-gateway"
  [oniesammy/kubecart-product-service:v1.0.2]="$ROOT_DIR/apps/product-service"
  [oniesammy/kubecart-order-service:v1.0.0]="$ROOT_DIR/apps/order-service"
  [oniesammy/kubecart-user-service:v1.0.0]="$ROOT_DIR/apps/user-service"
)

SKIP_BUILD=0
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
fi

echo "KubeCart kind deploy helper"
if [[ $SKIP_BUILD -eq 0 ]]; then
  for img in "${!IMAGEMAP[@]}"; do
    dir="${IMAGEMAP[$img]}"
    echo "Building $img from $dir"
    docker build -t "$img" "$dir"
    echo "Loading $img into kind cluster ($CLUSTER_NAME)"
    kind load docker-image "$img" --name "$CLUSTER_NAME"
  done
else
  echo "Skipping image build/load (user requested --skip-build)"
fi

echo "Applying Kubernetes manifests (kustomize: $K8S_DIR)"
kubectl apply -k "$K8S_DIR"

echo "Waiting for key pods to become ready (namespace: ecommerce)"
kubectl wait --for=condition=Ready pod -l app=api-gateway -n ecommerce --timeout=180s || true
kubectl wait --for=condition=Ready pod -l app=frontend -n ecommerce --timeout=180s || true

echo "Deployment finished."
cat <<EOF
Access options:
- Frontend NodePort: http://localhost:30080 (if using NodePort)
- Ingress host (if configured): http://ecommerce.local  (add /etc/hosts -> 127.0.0.1)
EOF
