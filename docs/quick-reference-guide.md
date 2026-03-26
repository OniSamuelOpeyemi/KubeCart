# Kubernetes Microservices Platform - Quick Reference Guide

##  One-Command Deployment

```bash
# Complete setup from scratch
git clone <https://github.com/OniSamuelOpeyemi/KubeCart.git>
cd KubeCart
./scripts/setup-cluster.sh && \
./scripts/deploy-infrastructure.sh && \
./scripts/build-and-deploy.sh
```

##  Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://kubecart.local | - |
| API Gateway | http://kubecart.local/api | - |
| Grafana | http://localhost:30080 | admin/admin |
| Prometheus | http://localhost:30090 | - |
| Jaeger | http://localhost:30686 | - |
| ArgoCD | https://localhost:30443 | admin/[get-secret] |

## 🔧 Essential Commands

### Cluster Management
```bash
# Create cluster
kind create cluster --config kind-config.yaml

# Delete cluster
kind delete cluster --name kubecart-platform

# Get cluster info
kubectl cluster-info
kubectl get nodes
```

### Pod Operations
```bash
# Get all pods
kubectl get pods -n kubecart

# Watch pods
kubectl get pods -n kubecart -w

# Describe pod
kubectl describe pod <pod-name> -n kubecart

# Get logs
kubectl logs <pod-name> -n kubecart
kubectl logs <pod-name> -n kubecart --previous  # Previous container
kubectl logs <pod-name> -n kubecart -f  # Follow

# Execute command in pod
kubectl exec -it <pod-name> -n kubecart -- /bin/sh
kubectl exec <pod-name> -n kubecart -- env

# Port forward
kubectl port-forward <pod-name> -n kubecart 8080:8000
```

### Deployment Operations
```bash
# Get deployments
kubectl get deployments -n kubecart

# Scale deployment
kubectl scale deployment <name> --replicas=5 -n kubecart

# Rollout status
kubectl rollout status deployment/<name> -n kubecart

# Rollout history
kubectl rollout history deployment/<name> -n kubecart

# Rollback
kubectl rollout undo deployment/<name> -n kubecart

# Restart deployment
kubectl rollout restart deployment/<name> -n kubecart
```

### Service and Networking
```bash
# Get services
kubectl get svc -n kubecart

# Get endpoints
kubectl get endpoints -n kubecart

# Get ingress
kubectl get ingress -n kubecart

# Test DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup <service-name>.kubecart
```

### Resource Monitoring
```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n kubecart

# Describe node
kubectl describe node <node-name>
```

### Debugging
```bash
# Events
kubectl get events -n kubecart --sort-by='.lastTimestamp'

# All resources
kubectl get all -n kubecart

# Resource YAML
kubectl get deployment <name> -n kubecart -o yaml

# Debug pod
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- bash
```

##  Common Issues and Fixes

### ImagePullBackOff
```bash
# Check image name
kubectl describe pod <pod> -n kubecart | grep Image

# For kind, load image
kind load docker-image <image>:tag --name kubecart-platform

# Check pull secrets
kubectl get secrets -n kubecart
```

### CrashLoopBackOff
```bash
# Check logs
kubectl logs <pod> -n kubecart --previous

# Check resources
kubectl describe pod <pod> -n kubecart | grep -A 5 "Limits"

# Check environment variables
kubectl exec <pod> -n kubecart -- env
```

### Pending Pods
```bash
# Check events
kubectl describe pod <pod> -n kubecart

# Check PVC
kubectl get pvc -n kubecart

# Check node resources
kubectl describe nodes | grep -A 5 "Allocated resources"
```

### Service Not Accessible
```bash
# Check service
kubectl get svc <service> -n kubecart

# Check endpoints
kubectl get endpoints <service> -n kubecart

# Test from inside cluster
kubectl run test --rm -it --image=busybox -- wget -O- http://<service>.<namespace>:port/
```

## 📊 Prometheus Queries (PromQL)
```promql
# Request rate
rate(product_requests_total[5m])

# Average latency
rate(product_request_latency_seconds_sum[5m]) / rate(product_request_latency_seconds_count[5m])

# Error rate
rate(product_requests_total{status=~"5.."}[5m]) / rate(product_requests_total[5m])

# CPU usage
rate(container_cpu_usage_seconds_total{namespace="kubecart"}[5m])

# Memory usage
container_memory_working_set_bytes{namespace="kubecart"}
```

## 🔍 Loki Queries (LogQL)
```logql
# All logs from namespace
{namespace="kubecart"}

# Logs from specific app
{namespace="kubecart", app="product-service"}

# Error logs
{namespace="kubecart"} |= "error"

# HTTP POST requests
{namespace="kubecart", app="order-service"} |= "POST"

# Specific time range with JSON parsing
{namespace="kubecart"} | json | level="error"
```

## ⚡ Performance Tips

### Optimize Resource Requests
```yaml
resources:
  requests:
    memory: "256Mi"  # Start conservative
    cpu: "250m"
  limits:
    memory: "512Mi"  # 2x requests
    cpu: "500m"
```

### Enable HPA
```yaml
minReplicas: 3
maxReplicas: 10
targetCPUUtilizationPercentage: 70
```

### Use Caching
- Redis for session data
- HTTP caching headers
- Database query result caching

## 🔐 Security Checklist

- [ ] Non-root containers
- [ ] Read-only root filesystem where possible
- [ ] Resource limits set
- [ ] NetworkPolicies enabled
- [ ] RBAC configured
- [ ] Secrets not in Git
- [ ] TLS for ingress
- [ ] Pod Security Standards

## 📈 Scaling Strategies

### Horizontal Scaling
```bash
# Manual
kubectl scale deployment <name> --replicas=10 -n kubecart

# Auto (HPA)
kubectl autoscale deployment <name> --cpu-percent=70 --min=3 --max=10 -n kubecart
```

### Vertical Scaling
```bash
# Increase resources in deployment YAML
kubectl edit deployment <name> -n kubecart
```

## 🎯 Health Check Patterns

### Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## 🔄 Deployment Strategies

### Rolling Update (Default)
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

### Blue-Green
```bash
# Deploy new version with different label
kubectl apply -f deployment-green.yaml

# Switch service selector
kubectl patch service <name> -p '{"spec":{"selector":{"version":"green"}}}'
```

### Canary
```bash
# Deploy canary with 10% traffic
kubectl apply -f deployment-canary.yaml
kubectl scale deployment <name>-canary --replicas=1 -n kubecart
kubectl scale deployment <name> --replicas=9 -n kubecart
```

## 💾 Backup and Restore

### Backup Database
```bash
kubectl exec -n kubecart postgres-product-0 -- \
  pg_dump -U postgres products > backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
kubectl exec -i -n kubecart postgres-product-0 -- \
  psql -U postgres products < backup-20240101.sql
```

##  Emergency Procedures

### Complete Service Down
```bash
1. Check ingress: kubectl get pods -n ingress-nginx
2. Check services: kubectl get pods -n kubecart
3. Check events: kubectl get events -n kubecart --sort-by='.lastTimestamp' | tail -20
4. Rollback: kubectl rollout undo deployment/<name> -n kubecart
```

### Database Connection Lost
```bash
1. Check DB pod: kubectl get pods -n kubecart -l app=postgres-product
2. Restart if needed: kubectl delete pod postgres-product-0 -n kubecart
3. Test connection: kubectl exec -it postgres-product-0 -n kubecart -- psql -U postgres
```

### High CPU/Memory
```bash
1. Identify: kubectl top pods -n kubecart --sort-by=cpu
2. Scale: kubectl scale deployment/<name> --replicas=10 -n kubecart
3. Or increase limits: kubectl edit deployment/<name> -n kubecart
```

---
