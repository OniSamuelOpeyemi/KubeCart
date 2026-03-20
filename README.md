# Production-Grade Kubernetes Microservices Platform

A comprehensive e-commerce microservices platform to master Docker and Kubernetes.

**Includes:**
- 5 Microservices (Python, Go, Node.js, React)
- PostgreSQL StatefulSets with persistence
- Full observability stack (Prometheus, Grafana, Jaeger, Loki)
- NGINX Ingress with TLS
- GitOps with ArgoCD
- Complete CI/CD pipeline

## 🏗️ Architecture
```
         ┌─────────────────────────┐
         │   NGINX Ingress + TLS   │
         └───────────┬─────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼────┐    ┌────▼────┐    ┌────▼────┐
│Frontend │    │   API   │    │  Admin  │
│ (React) │    │ Gateway │    │Dashboard│
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐   ┌────▼────┐   ┌────▼────┐
│ Product │   │  Order  │   │  User   │
│ Service │   │ Service │   │ Service │
│(FastAPI)│   │  (Go)   │   │(NestJS) │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
┌────▼────┐   ┌───▼────┐   ┌───▼─────┐
│Postgres │   │Postgres│   │Postgres │
│StatefulS│   │StatefulS   │StatefulS│
└─────────┘   └────────┘   └─────────┘
```

## 🚀 Quick Start
```bash
# 1. Create cluster
chmod +x scripts/*.sh
./scripts/setup-cluster.sh

# 2. Deploy infrastructure
./scripts/deploy-infrastructure.sh

# 3. Deploy applications
./scripts/build-and-deploy.sh

# 4. Access services
kubectl port-forward -n ecommerce svc/frontend 8080:80
# Visit http://localhost:8080
```

## 📁 Project Structure
```
k8s-microservices-platform/
├── apps/                   # Application source code
├── k8s/                    # Kubernetes manifests
├── helm/                   # Helm charts
├── scripts/                # Automation scripts
├── docs/                   # Documentation
└── README.md
```

## Learning Objectives

- Multi-stage Docker builds
- Kubernetes Deployments & StatefulSets
- Services, Ingress, NetworkPolicies
- ConfigMaps, Secrets, PersistentVolumes
- Horizontal Pod Autoscaling
- RBAC and Security
- Prometheus monitoring
- GitOps with ArgoCD

## 📖 Full Documentation

See `/docs` for complete guides on architecture, deployment, and troubleshooting.

MIT License
