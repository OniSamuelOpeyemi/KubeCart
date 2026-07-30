from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import asyncpg
import os
import logging
from prometheus_client import Counter, Histogram, generate_latest
from fastapi.responses import Response
import time
import asyncio

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Product Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
REQUEST_COUNT = Counter('product_requests_total', 'Total requests')
REQUEST_LATENCY = Histogram('product_request_latency_seconds', 'Request latency')

# Database connection pool
db_pool = None

# Models
class Product(BaseModel):
    id: Optional[int] = None
    name: str
    description: str
    price: float
    stock: int
    category: str

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    stock: int
    category: str

# Database setup
async def get_db_pool():
    global db_pool
    if db_pool is None:
        # Parse DATABASE_URL if provided, otherwise use individual env vars
        db_url = os.getenv("DATABASE_URL")
        
        if db_url:
            db_pool = await asyncpg.create_pool(
                db_url,
                min_size=5,
                max_size=20,
                server_settings={'application_name': 'product-service'}
            )
        else:
            db_pool = await asyncpg.create_pool(
                host=os.getenv("DB_HOST", "product-db"),
                port=int(os.getenv("DB_PORT", "5432")),
                database=os.getenv("DB_NAME", "productdb"),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "password"),
                min_size=5,
                max_size=20
            )
    return db_pool

async def connect_with_retry(max_retries=10, retry_delay=2):
    """Connect to database with exponential backoff retry"""
    for attempt in range(max_retries):
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                await conn.fetchval('SELECT 1')
            logger.info(f"Database connection successful on attempt {attempt + 1}")
            return pool
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = retry_delay * (2 ** attempt)
                logger.warning(f"Database connection failed (attempt {attempt + 1}/{max_retries}): {str(e)}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Database connection failed after {max_retries} attempts")
                raise

@app.on_event("startup")
async def startup():
    logger.info("Starting Product Service...")
    try:
        pool = await connect_with_retry()
        
        # Create table if not exists
        async with pool.acquire() as conn:
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10, 2) NOT NULL,
                    stock INTEGER NOT NULL,
                    category VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Insert sample data
            count = await conn.fetchval('SELECT COUNT(*) FROM products')
            if count == 0:
                await conn.execute('''
                    INSERT INTO products (name, description, price, stock, category) VALUES
                    ('Laptop', 'High-performance laptop', 1299.99, 50, 'Electronics'),
                    ('Mouse', 'Wireless mouse', 29.99, 200, 'Electronics'),
                    ('Keyboard', 'Mechanical keyboard', 89.99, 150, 'Electronics'),
                    ('Monitor', '27-inch 4K monitor', 399.99, 75, 'Electronics'),
                    ('Headphones', 'Noise-cancelling headphones', 249.99, 100, 'Electronics')
                ''')
                logger.info("Sample products inserted")
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()

# Health checks
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "product-service"}

@app.get("/ready")
async def ready():
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.fetchval('SELECT 1')
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {str(e)}")

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")

# API Endpoints
@app.get("/api/products", response_model=List[Product])
async def get_products(category: Optional[str] = None):
    REQUEST_COUNT.inc()
    start_time = time.time()
    
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            if category:
                rows = await conn.fetch(
                    'SELECT id, name, description, price, stock, category FROM products WHERE category = $1',
                    category
                )
            else:
                rows = await conn.fetch(
                    'SELECT id, name, description, price, stock, category FROM products'
                )
            
            products = [dict(row) for row in rows]
            REQUEST_LATENCY.observe(time.time() - start_time)
            return products
    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/products/{product_id}", response_model=Product)
async def get_product(product_id: int):
    REQUEST_COUNT.inc()
    
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                'SELECT id, name, description, price, stock, category FROM products WHERE id = $1',
                product_id
            )
            
            if row is None:
                raise HTTPException(status_code=404, detail="Product not found")
            
            return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product {product_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/products", response_model=Product, status_code=201)
async def create_product(product: ProductCreate):
    REQUEST_COUNT.inc()
    
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow('''
                INSERT INTO products (name, description, price, stock, category)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, description, price, stock, category
            ''', product.name, product.description, product.price, product.stock, product.category)
            
            return dict(row)
    except Exception as e:
        logger.error(f"Error creating product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/products/{product_id}", response_model=Product)
async def update_product(product_id: int, product: ProductCreate):
    REQUEST_COUNT.inc()
    
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow('''
                UPDATE products
                SET name = $1, description = $2, price = $3, stock = $4, category = $5
                WHERE id = $6
                RETURNING id, name, description, price, stock, category
            ''', product.name, product.description, product.price, product.stock, product.category, product_id)
            
            if row is None:
                raise HTTPException(status_code=404, detail="Product not found")
            
            return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product {product_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int):
    REQUEST_COUNT.inc()
    
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            result = await conn.execute('DELETE FROM products WHERE id = $1', product_id)
            
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Product not found")
            
            return {"message": "Product deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product {product_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
