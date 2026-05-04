#!/bin/bash
# deploy-infrastructure.sh

# Create namespaces
kubectl create namespace ecommerce
kubectl create namespace monitoring
kubectl create namespace logging

# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install Prometheus + Grafana (using helm)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

# Install Loki
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  --namespace logging \
  --set grafana.enabled=false

# Deploy RabbitMQ
kubectl apply -f k8s/infrastructure/messaging/rabbitmq.yaml

# Deploy Redis
kubectl apply -f k8s/infrastructure/storage/redis.yaml

echo "✅ Infrastructure deployed!"