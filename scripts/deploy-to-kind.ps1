Param(
  [switch]$SkipBuild
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Join-Path $ScriptDir ".."
$K8sDir = Join-Path $Root "kubernetes\base"

$images = @{
  'oniesammy/kubecart-frontend:v1.0.0' = Join-Path $Root 'apps\frontend'
  'oniesammy/kubecart-api-gateway:v1.0.0' = Join-Path $Root 'apps\api-gateway'
  'oniesammy/kubecart-product-service:v1.0.0' = Join-Path $Root 'apps\product-service'
  'oniesammy/kubecart-order-service:v1.0.0' = Join-Path $Root 'apps\order-service'
  'oniesammy/kubecart-user-service:v1.0.0' = Join-Path $Root 'apps\user-service'
}

Write-Host "KubeCart kind deploy helper"
if (-not $SkipBuild) {
  foreach ($img in $images.Keys) {
    $dir = $images[$img]
    Write-Host "Building $img from $dir"
    docker build -t $img $dir
    Write-Host "Loading $img into kind cluster"
    kind load docker-image $img
  }
} else {
  Write-Host "Skipping build/load (SkipBuild)"
}

Write-Host "Applying Kubernetes manifests (kustomize: $K8sDir)"
kubectl apply -k $K8sDir

Write-Host "Waiting for key pods to become ready (namespace: ecommerce)"
kubectl wait --for=condition=Ready pod -l app=api-gateway -n ecommerce --timeout=180s 2>$null
kubectl wait --for=condition=Ready pod -l app=frontend -n ecommerce --timeout=180s 2>$null

Write-Host "Deployment finished."
Write-Host "Access options:`n - Frontend NodePort: http://localhost:30080 (if using NodePort)`n - Ingress host: http://ecommerce.local (add hosts entry -> 127.0.0.1)"
