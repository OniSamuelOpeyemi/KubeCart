#!/bin/bash
# setup-cluster.sh

set -euo pipefail

command -v kind >/dev/null 2>&1 || { echo "kind is required but not installed. Install from https://kind.sigs.k8s.io"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed. Install from https://kubernetes.io/docs/tasks/tools/"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker is required but not installed or running. Ensure Docker Desktop or Docker Engine is available."; exit 1; }

# Variables 
KIND_CLUSTER_NAME="kubecart"
KIND_CONTEXT="kind-${KIND_CLUSTER_NAME}"
KIND_CONFIG_FILE="${KIND_CONFIG_FILE:-kind-config.yaml}"
HOST_HTTP_PORT="${HOST_HTTP_PORT:-8080}"
# HOST_HTTPS_PORT="${HOST_HTTPS_PORT:-443}"
PORTS=("${HOST_HTTP_PORT}" )
INGRESS_MANIFEST_URL="https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/kind/deploy.yaml"
INGRESS_NAMESPACE="ingress-nginx"
WAIT_TIMEOUT="180s"

make_kind_config() {
  cat <<EOF > "${KIND_CONFIG_FILE}"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${KIND_CLUSTER_NAME}
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: ${HOST_HTTP_PORT}
    protocol: TCP

- role: worker
- role: worker
- role: worker
EOF
}

if [[ "${1:-}" == "--config-only" ]]; then
  make_kind_config
  echo "Generated kind config: ${KIND_CONFIG_FILE}"
  exit 0
fi

check_port() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -qE "[:.]${port}$"
    return $?
  elif command -v netstat >/dev/null 2>&1; then
    netstat -an | grep -E 'LISTEN|LISTENING' | grep -qE "[:.]${port}\b"
    return $?
  else
    echo "warning: cannot detect whether port ${port} is in use because neither ss nor netstat is available."
    return 0
  fi
}

for port in "${PORTS[@]}"; do
  if check_port "$port"; then
    continue
  fi
  echo "ERROR: host port ${port} is not available."
  echo "  This may mean another local process is listening on port ${port},"
  echo "  or that your operating system blocks binding to that port without elevated permissions."
  echo "  Suggested fixes:"
  echo "    1) stop the service using port ${port},"
  echo "    2) run the script with administrator/root privileges,"
  echo "    3) remove the host port mapping for ${port} from extraPortMappings, or"
  echo "    4) use a different free host port (for example HOST_HTTP_PORT=8080 or HOST_HTTPS_PORT=8443)."
  exit 1
done

# Generate kind cluster config and create cluster
make_kind_config
printf "Generated kind config: %s\n" "${KIND_CONFIG_FILE}"

kind create cluster --name "${KIND_CLUSTER_NAME}" --config "${KIND_CONFIG_FILE}"

echo "Switching kubectl context to ${KIND_CONTEXT}"
kubectl config use-context "${KIND_CONTEXT}"

echo "Using kubeconfig context: $(kubectl config current-context)"

# Install ingress-nginx
kubectl apply -f "${INGRESS_MANIFEST_URL}"

# Wait for ingress to be ready
kubectl wait --namespace "${INGRESS_NAMESPACE}" \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout="${WAIT_TIMEOUT}"

echo "✅ Cluster ready!"