const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const cors = require('cors');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, req.route?.path || req.path, res.statusCode).inc();
  });
  next();
});

// Service endpoints
const SERVICES = {
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:8000',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:8080',
  user: process.env.USER_SERVICE_URL || 'http://user-service:3000'
};

// Health checks
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

app.get('/ready', async (req, res) => {
  try {
    const checks = await Promise.all([
      axios.get(`${SERVICES.product}/health`),
      axios.get(`${SERVICES.order}/health`),
      axios.get(`${SERVICES.user}/health`)
    ]);
    res.json({ status: 'ready', services: 'all services available' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Product service routes
app.all('/api/products*', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SERVICES.product}${req.path}`,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Product service error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'Product service unavailable'
    });
  }
});

// Order service routes
app.all('/api/orders*', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SERVICES.order}${req.path}`,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Order service error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'Order service unavailable'
    });
  }
});

// User service routes
app.all('/api/users*', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SERVICES.user}${req.path}`,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('User service error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'User service unavailable'
    });
  }
});

// Catch-all route
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});