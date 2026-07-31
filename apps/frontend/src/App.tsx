import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

const API_URL = '';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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
      setError(err instanceof Error ? err.message : 'An error occurred while loading products.');
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
          total_price: price,
        }),
      });

      if (!response.ok) throw new Error('Unable to place order.');
      alert('Order created successfully!');
    } catch (err) {
      alert('Failed to create order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const getProductImageUrl = (product: Product) =>
    `https://picsum.photos/seed/kubecart-${product.id}/480/320`;

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((product) => product.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery =
        query.trim().length === 0 ||
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, selectedCategory]);

  const inStockCount = filteredProducts.filter((product) => product.stock > 0).length;

  if (loading) {
    return (
      <div className="App loading-screen">
        <div className="loader" />
        <div className="loading-copy">Loading product catalog…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App error-screen">
        <div className="panel error-panel">
          <h2>Unable to load products</h2>
          <p>{error}</p>
          <button className="button button-primary" onClick={fetchProducts}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="topbar">
        <div className="brand">KubeCart</div>
        <nav className="nav-links">
          <a href="#products">Products</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>

      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Modern microservices storefront</span>
          <h1>Industry-standard product browsing with a clean shopping experience.</h1>
          <p>
            Explore the catalog from your Kubernetes-powered backend. This frontend layout
            brings polished product cards, filtering, and responsive mobile-first design.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={fetchProducts}>
              Refresh catalog
            </button>
            <button className="button button-secondary" onClick={() => setQuery('')}>
              Clear filters
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="overview" id="features">
          <div className="overview-metrics">
            <div>
              <span>{filteredProducts.length}</span>
              <p>Visible products</p>
            </div>
            <div>
              <span>{inStockCount}</span>
              <p>In stock</p>
            </div>
            <div>
              <span>{categories.length - 1}</span>
              <p>Categories</p>
            </div>
          </div>

          <div className="filters">
            <label className="filter-group">
              <span>Search products</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or description"
              />
            </label>

            <label className="filter-group">
              <span>Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="product-grid" id="products">
          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <h2>No products found</h2>
              <p>Try changing your search query or selecting a different category.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <article key={product.id} className="product-card">
                <div className="product-image">
                  <img src={getProductImageUrl(product)} alt={product.name} />
                </div>
                <div className="card-badge-row">
                  <span className={`badge ${product.stock > 0 ? 'badge-success' : 'badge-muted'}`}>
                    {product.stock > 0 ? 'In stock' : 'Sold out'}
                  </span>
                  <span className="product-category">{product.category}</span>
                </div>

                <h2>{product.name}</h2>
                <p className="description">{product.description}</p>

                <div className="product-meta">
                  <div className="price">${product.price.toFixed(2)}</div>
                  <div className="stock">Stock: {product.stock}</div>
                </div>

                <div className="product-actions">
                  <button
                    className="button button-primary"
                    onClick={() => createOrder(product.id, product.price)}
                    disabled={product.stock === 0}
                  >
                    {product.stock > 0 ? 'Add to bag' : 'Unavailable'}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>

      <footer className="footer" id="contact">
        <div>
          <p>Powered by Kubernetes • Docker • Microservices</p>
          <p>Designed for a modern cloud-native storefront.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
