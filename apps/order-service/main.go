package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	db *sql.DB
	
	requestCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "order_requests_total",
			Help: "Total number of requests",
		},
		[]string{"method", "endpoint"},
	)
	
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "order_request_duration_seconds",
			Help: "Request duration in seconds",
		},
		[]string{"method", "endpoint"},
	)
)

type Order struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	ProductID  int       `json:"product_id"`
	Quantity   int       `json:"quantity"`
	TotalPrice float64   `json:"total_price"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateOrderRequest struct {
	UserID     int     `json:"user_id" binding:"required"`
	ProductID  int     `json:"product_id" binding:"required"`
	Quantity   int     `json:"quantity" binding:"required,min=1"`
	TotalPrice float64 `json:"total_price" binding:"required,min=0"`
}

func init() {
	prometheus.MustRegister(requestCounter)
	prometheus.MustRegister(requestDuration)
}

func initDB() error {
	var err error
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getEnv("DB_HOST", "postgres-order"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", "postgres"),
		getEnv("DB_NAME", "orders"),
	)
	
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return err
	}
	
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	
	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := db.PingContext(ctx); err != nil {
		return err
	}
	
	// Create table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS orders (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			product_id INTEGER NOT NULL,
			quantity INTEGER NOT NULL,
			total_price DECIMAL(10, 2) NOT NULL,
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	
	return err
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func prometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		
		c.Next()
		
		duration := time.Since(start).Seconds()
		requestCounter.WithLabelValues(c.Request.Method, c.FullPath()).Inc()
		requestDuration.WithLabelValues(c.Request.Method, c.FullPath()).Observe(duration)
	}
}

func main() {
	// Initialize database
	if err := initDB(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	
	log.Println("Order Service started successfully")
	
	// Setup Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	
	r.Use(prometheusMiddleware())
	
	// Health checks
	r.GET("/health", healthCheck)
	r.GET("/ready", readinessCheck)
	
	// Metrics
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	
	// API routes
	api := r.Group("/api/orders")
	{
		api.GET("", getOrders)
		api.GET("/:id", getOrder)
		api.POST("", createOrder)
		api.PUT("/:id/status", updateOrderStatus)
		api.GET("/user/:user_id", getOrdersByUser)
	}
	
	// Start server
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "order-service",
	})
}

func readinessCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	
	if err := db.PingContext(ctx); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not ready",
			"error":  err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

func getOrders(c *gin.Context) {
	rows, err := db.Query(`
		SELECT id, user_id, product_id, quantity, total_price, status, created_at
		FROM orders
		ORDER BY created_at DESC
		LIMIT 100
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	
	var orders []Order
	for rows.Next() {
		var order Order
		if err := rows.Scan(&order.ID, &order.UserID, &order.ProductID, &order.Quantity,
			&order.TotalPrice, &order.Status, &order.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		orders = append(orders, order)
	}
	
	c.JSON(http.StatusOK, orders)
}

func getOrder(c *gin.Context) {
	id := c.Param("id")
	
	var order Order
	err := db.QueryRow(`
		SELECT id, user_id, product_id, quantity, total_price, status, created_at
		FROM orders WHERE id = $1
	`, id).Scan(&order.ID, &order.UserID, &order.ProductID, &order.Quantity,
		&order.TotalPrice, &order.Status, &order.CreatedAt)
	
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, order)
}

func createOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	var order Order
	err := db.QueryRow(`
		INSERT INTO orders (user_id, product_id, quantity, total_price, status)
		VALUES ($1, $2, $3, $4, 'pending')
		RETURNING id, user_id, product_id, quantity, total_price, status, created_at
	`, req.UserID, req.ProductID, req.Quantity, req.TotalPrice).Scan(
		&order.ID, &order.UserID, &order.ProductID, &order.Quantity,
		&order.TotalPrice, &order.Status, &order.CreatedAt,
	)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, order)
}

func updateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	result, err := db.Exec("UPDATE orders SET status = $1 WHERE id = $2", req.Status, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Order status updated"})
}

func getOrdersByUser(c *gin.Context) {
	userID := c.Param("user_id")
	
	rows, err := db.Query(`
		SELECT id, user_id, product_id, quantity, total_price, status, created_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	
	var orders []Order
	for rows.Next() {
		var order Order
		if err := rows.Scan(&order.ID, &order.UserID, &order.ProductID, &order.Quantity,
			&order.TotalPrice, &order.Status, &order.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		orders = append(orders, order)
	}
	
	c.JSON(http.StatusOK, orders)
}