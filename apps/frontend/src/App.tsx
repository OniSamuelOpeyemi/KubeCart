import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

interface Order {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
}

interface UserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

const API_URL = process.env.REACT_APP_API_URL || '';

const parseApiError = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return response.statusText || 'Unknown API error';
  }

  try {
    const body = JSON.parse(text);

    const extractMessage = (value: unknown): string | null => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object' && value !== null) {
        if ('message' in value && typeof (value as any).message === 'string') {
          return (value as any).message;
        }
        if ('message' in value && Array.isArray((value as any).message)) {
          return (value as any).message.join(', ');
        }
        if ('error' in value) {
          return extractMessage((value as any).error);
        }
      }
      return null;
    };

    if (body?.detail) return String(body.detail);
    const bodyMessage = extractMessage(body) ?? extractMessage(body?.error) ?? extractMessage(body?.message);
    if (bodyMessage) return bodyMessage;
    return JSON.stringify(body);
  } catch {
    return text;
  }
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    if ('message' in err && typeof (err as any).message === 'string') {
      return (err as any).message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
};

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [checkoutQuantity, setCheckoutQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'browse' | 'checkout' | 'admin' | 'users'>('browse');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    stock: '',
    category: '',
  });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState<UserForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const fetchProducts = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/products`);
    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      throw new Error(errorMessage || 'Failed to fetch products');
    }
    setProducts(await response.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/users`);
    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      throw new Error(errorMessage || 'Failed to fetch users');
    }
    setUsers(await response.json());
  }, []);

  const fetchOrders = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/orders`);
    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      throw new Error(errorMessage || 'Failed to fetch orders');
    }
    setOrders(await response.json());
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProducts(), fetchUsers(), fetchOrders()]);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, fetchProducts, fetchUsers]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (users.length && selectedUserId === null) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const createOrder = async (product: Product, quantity: number) => {
    if (!selectedUserId) {
      alert('Please select a user before checking out.');
      setActiveTab('users');
      return;
    }

    try {
      const totalPrice = Number((product.price * quantity).toFixed(2));
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUserId,
          product_id: product.id,
          quantity,
          total_price: totalPrice,
        }),
      });

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage || 'Failed to create order');
      }

      alert('Order created successfully!');
      setCheckoutProduct(null);
      setCheckoutQuantity(1);
      await fetchOrders();
      setActiveTab('checkout');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during checkout.');
    }
  };

  const handleProductSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: productForm.name,
      description: productForm.description,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      category: productForm.category,
    };

    try {
      const method = editingProductId ? 'PUT' : 'POST';
      const url = editingProductId
        ? `${API_URL}/api/products/${editingProductId}`
        : `${API_URL}/api/products`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage || 'Failed to save product');
      }

      await fetchProducts();
      setProductForm({ name: '', description: '', price: '', stock: '', category: '' });
      setEditingProductId(null);
      alert(`Product ${editingProductId ? 'updated' : 'created'} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!window.confirm('Delete this product?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/products/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage || 'Failed to delete product');
      }
      await fetchProducts();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category,
    });
    setActiveTab('admin');
  };

  const handleUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: Record<string, unknown> = {
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      email: userForm.email,
    };

    if (editingUserId) {
      if (userForm.password) {
        payload.password = userForm.password;
      }
    } else {
      payload.password = userForm.password || 'KubeCart123!';
    }

    try {
      const method = editingUserId ? 'PUT' : 'POST';
      const url = editingUserId ? `${API_URL}/api/users/${editingUserId}` : `${API_URL}/api/users`;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage || 'Failed to save user');
      }

      await fetchUsers();
      setUserForm({ firstName: '', lastName: '', email: '', password: '' });
      setEditingUserId(null);
      alert(`User ${editingUserId ? 'updated' : 'created'} successfully.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({ firstName: user.firstName, lastName: user.lastName, email: user.email, password: '' });
    setActiveTab('users');
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage || 'Failed to delete user');
      }
      await fetchUsers();
      if (selectedUserId === userId) {
        setSelectedUserId(users.length > 1 ? users[0].id : null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

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

  const getProductImageUrl = (product: Product) =>
    `https://picsum.photos/seed/kubecart-${product.id}/480/320`;

  if (loading) {
    return (
      <div className="App loading-screen">
        <div className="loader" />
        <div className="loading-copy">Loading application data…</div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="topbar">
        <div className="brand">KubeCart</div>
        <div className="topbar-actions">
          <button className="button button-secondary" onClick={() => setActiveTab('browse')}>
            Browse
          </button>
          <button className="button button-secondary" onClick={() => setActiveTab('checkout')}>
            Checkout
          </button>
          <button className="button button-secondary" onClick={() => setActiveTab('admin')}>
            Catalog Admin
          </button>
          <button className="button button-secondary" onClick={() => setActiveTab('users')}>
            Users
          </button>
        </div>
      </div>

      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Kubernetes microservices storefront</span>
          <h1>One frontend for products, orders, and user management.</h1>
          <p>
            Browse catalog items, submit checkout orders, and administer products and users through the API Gateway.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={loadData}>
              Reload all data
            </button>
            <button className="button button-secondary" onClick={() => setActiveTab('checkout')}>
              View orders
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="summary-grid">
          <div className="summary-card">
            <p className="summary-label">Products</p>
            <strong>{filteredProducts.length}</strong>
          </div>
          <div className="summary-card">
            <p className="summary-label">In stock</p>
            <strong>{inStockCount}</strong>
          </div>
          <div className="summary-card">
            <p className="summary-label">Users</p>
            <strong>{users.length}</strong>
          </div>
          <div className="summary-card">
            <p className="summary-label">Orders</p>
            <strong>{orders.length}</strong>
          </div>
        </section>

        <section className="section-header">
          <div>
            <h2>{activeTab === 'browse' ? 'Catalog Browser' : activeTab === 'checkout' ? 'Checkout & Orders' : activeTab === 'admin' ? 'Product Admin' : 'User Management'}</h2>
            <p className="section-copy">
              {activeTab === 'browse'
                ? 'Search and filter the catalog. Select a product to start checkout.'
                : activeTab === 'checkout'
                ? 'Complete an order and review recent purchases.'
                : activeTab === 'admin'
                ? 'Create, edit, or delete catalog products directly.'
                : 'Create, edit, and remove users used for order checkout.'}
            </p>
          </div>
          <div className="quick-controls">
            <label>
              Select user
              <select
                value={selectedUserId ?? ''}
                onChange={(event) => setSelectedUserId(Number(event.target.value))}
              >
                <option value="">Choose a user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {`${user.firstName} ${user.lastName}`.trim() || user.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="alert-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {activeTab === 'browse' && (
          <section className="overview">
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
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                        onClick={() => {
                          setCheckoutProduct(product);
                          setCheckoutQuantity(1);
                          setActiveTab('checkout');
                        }}
                        disabled={product.stock === 0}
                      >
                        Checkout
                      </button>
                      <button className="button button-secondary" onClick={() => handleEditProduct(product)}>
                        Edit
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </section>
        )}

        {activeTab === 'checkout' && (
          <section className="grid-two">
            <div className="panel form-card">
              <h3>Checkout</h3>
              {checkoutProduct ? (
                <>
                  <div className="checkout-card">
                    <img src={getProductImageUrl(checkoutProduct)} alt={checkoutProduct.name} />
                    <div>
                      <h4>{checkoutProduct.name}</h4>
                      <p>{checkoutProduct.category}</p>
                      <p>{checkoutProduct.description}</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label>
                      Selected user
                      <select
                        value={selectedUserId ?? ''}
                        onChange={(event) => setSelectedUserId(Number(event.target.value))}
                      >
                        <option value="">Choose a user</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {`${user.firstName} ${user.lastName}`.trim() || user.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Quantity
                      <input
                        type="number"
                        min={1}
                        max={checkoutProduct.stock}
                        value={checkoutQuantity}
                        onChange={(event) => setCheckoutQuantity(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      Total Price
                      <div className="price-summary">${(checkoutProduct.price * checkoutQuantity).toFixed(2)}</div>
                    </label>
                  </div>

                  <button
                    className="button button-primary"
                    onClick={() => createOrder(checkoutProduct, checkoutQuantity)}
                    disabled={checkoutProduct.stock === 0 || !selectedUserId}
                  >
                    Place order
                  </button>
                </>
              ) : (
                <div className="empty-state">
                  <h2>No product selected</h2>
                  <p>Select a product from the Catalog Browser to begin checkout.</p>
                </div>
              )}
            </div>

            <div className="panel">
              <h3>Recent orders</h3>
              {orders.length === 0 ? (
                <p>No orders yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>User</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 8).map((order) => (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>{users.find((user) => user.id === order.user_id)
                            ? `${users.find((user) => user.id === order.user_id)?.firstName ?? ''} ${users.find((user) => user.id === order.user_id)?.lastName ?? ''}`.trim()
                            : order.user_id}
                          </td>
                          <td>{products.find((product) => product.id === order.product_id)?.name ?? order.product_id}</td>
                          <td>{order.quantity}</td>
                          <td>${order.total_price.toFixed(2)}</td>
                          <td>{order.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'admin' && (
          <section className="grid-two">
            <div className="panel form-card">
              <h3>{editingProductId ? 'Edit product' : 'Create new product'}</h3>
              <form onSubmit={handleProductSubmit} className="form-grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Category
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock}
                    onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                    required
                  />
                </label>
                <label className="full-width">
                  Description
                  <textarea
                    value={productForm.description}
                    onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                    rows={4}
                    required
                  />
                </label>
                <div className="form-actions full-width">
                  <button type="submit" className="button button-primary">
                    {editingProductId ? 'Update product' : 'Create product'}
                  </button>
                  {editingProductId && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setEditingProductId(null);
                        setProductForm({ name: '', description: '', price: '', stock: '', category: '' });
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="panel">
              <h3>Product catalog</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 10).map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.category}</td>
                        <td>${product.price.toFixed(2)}</td>
                        <td>{product.stock}</td>
                        <td>
                          <button className="button button-secondary small" onClick={() => handleEditProduct(product)}>
                            Edit
                          </button>
                          <button className="button button-secondary small" onClick={() => handleDeleteProduct(product.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="grid-two">
            <div className="panel form-card">
              <h3>{editingUserId ? 'Edit user' : 'Create user'}</h3>
              <form onSubmit={handleUserSubmit} className="form-grid">
                <label>
                  First name
                  <input
                    type="text"
                    value={userForm.firstName}
                    onChange={(event) => setUserForm({ ...userForm, firstName: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={userForm.lastName}
                    onChange={(event) => setUserForm({ ...userForm, lastName: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                    placeholder={editingUserId ? 'Leave blank to keep current password' : 'Set password'}
                    aria-label="User password"
                  />
                </label>
                <div className="form-actions full-width">
                  <button type="submit" className="button button-primary">
                    {editingUserId ? 'Update user' : 'Create user'}
                  </button>
                  {editingUserId && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setEditingUserId(null);
                        setUserForm({ firstName: '', lastName: '', email: '', password: '' });
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="panel">
              <h3>User list</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{`${user.firstName} ${user.lastName}`.trim() || user.email}</td>
                        <td>{user.email}</td>
                        <td>
                          <button className="button button-secondary small" onClick={() => handleEditUser(user)}>
                            Edit
                          </button>
                          <button className="button button-secondary small" onClick={() => handleDeleteUser(user.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
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
