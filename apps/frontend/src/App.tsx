import React, { useState, useEffect } from 'react';
import './App.css';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (productId: number, price: number) => {
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1,
          product_id: productId,
          quantity: 1,
          total_price: price
        })
      });
      
      if (!response.ok) throw new Error('Failed to create order');
      alert('Order created successfully!');
    } catch (err) {
      alert('Failed to create order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="App">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <div className="error">Error: {error}</div>
        <button onClick={fetchProducts}>Retry</button>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🛒 E-Commerce Platform</h1>
        <p>Kubernetes Microservices Demo</p>
      </header>
      
      <main className="product-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <div className="product-header">
              <h3>{product.name}</h3>
              <span className="category">{product.category}</span>
            </div>
            <p className="description">{product.description}</p>
            <div className="product-footer">
              <div className="price-stock">
                <span className="price">${product.price.toFixed(2)}</span>
                <span className="stock">Stock: {product.stock}</span>
              </div>
              <button 
                className="order-btn"
                onClick={() => createOrder(product.id, product.price)}
                disabled={product.stock === 0}
              >
                {product.stock > 0 ? 'Order Now' : 'Out of Stock'}
              </button>
            </div>
          </div>
        ))}
      </main>
      
      <footer className="App-footer">
        <p>Powered by Kubernetes • Docker • Microservices</p>
      </footer>
    </div>
  );
}

export default App;