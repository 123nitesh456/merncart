import React, { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";

const API = "https://merncart-backend.onrender.com/api";
const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);

function StoreProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; }
    catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [cart, setCart] = useState([]);
  const [notice, setNotice] = useState("");

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  }

  async function loadCart() {
    if (!token) {
      setCart([]);
      return;
    }
    try {
      setCart(await request("/cart"));
    } catch (error) {
      console.error("Cart error:", error.message);
    }
  }

  useEffect(() => { loadCart(); }, [token]);

  async function login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    showNotice("Welcome back!");
  }

  async function register(name, email, password) {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    showNotice("Account created!");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setCart([]);
    showNotice("Logged out");
  }

  async function add(productId) {
    if (!token) {
      showNotice("Please login first");
      return;
    }
    try {
      setCart(await request("/cart", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 })
      }));
      showNotice("Added to cart!");
    } catch (error) {
      showNotice(error.message);
    }
  }

  async function updateQuantity(productId, quantity) {
    try {
      setCart(await request(`/cart/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity })
      }));
    } catch (error) {
      showNotice(error.message);
    }
  }

  async function remove(productId) {
    try {
      await request(`/cart/${productId}`, { method: "DELETE" });
      await loadCart();
      showNotice("Item removed");
    } catch (error) {
      showNotice(error.message);
    }
  }

  return (
    <StoreContext.Provider value={{
      user, token, cart, notice, request, login, register, logout,
      add, updateQuantity, remove, loadCart, showNotice
    }}>
      {children}
    </StoreContext.Provider>
  );
}

function Navbar() {
  const { user, cart, logout } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="nav">
      <Link to="/" className="brand">MERNCART<span>.</span></Link>
      <nav className={`navlinks ${menuOpen ? "show" : ""}`}>
        <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
        <Link to="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
        <Link to="/orders" onClick={() => setMenuOpen(false)}>My Orders</Link>
        {user
          ? <button onClick={logout}>Logout</button>
          : <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>}
      </nav>
      <div className="navright">
        <Link to="/cart" className="cartlink">Bag <span>({count})</span></Link>
        <button className="menubtn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>
    </header>
  );
}

function ProductCard({ product }) {
  const { add } = useStore();
  return (
    <article className="product">
      <Link to={`/product/${product._id}`}>
        <img
          src={product.image}
          alt={product.name}
          onError={(event) => {
            event.currentTarget.src = "https://placehold.co/500x500?text=Product";
          }}
        />
      </Link>
      <div className="productmeta">
        <div>
          <p className="eyebrow">{product.category}</p>
          <Link to={`/product/${product._id}`}><h3>{product.name}</h3></Link>
        </div>
        <strong>₹{product.price}</strong>
      </div>
      <button className="addbtn" onClick={() => add(product._id)}>
        Add to bag <span>＋</span>
      </button>
    </article>
  );
}

function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/products`)
      .then((response) => response.json())
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">THE EVERYDAY COLLECTION</p>
          <h1>Simple things.<br /><i>Better living.</i></h1>
          <p className="muted">Discover thoughtful essentials made for everyday life.</p>
          <Link to="/shop" className="shopbtn">Explore collection ↗</Link>
        </div>
        <div className="hero-art">
          <div className="hero-circle" />
          <img
            src="https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=900"
            alt="Collection"
          />
        </div>
      </section>

      <section className="section">
        <div className="sectionhead">
          <div>
            <p className="eyebrow">CURATED FOR YOU</p>
            <h2>Featured products</h2>
          </div>
          <Link to="/shop">View all ↗</Link>
        </div>
        {loading ? <p>Loading products...</p> : (
          <div className="products">
            {products.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Shop() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const categories = ["All", "Footwear", "Accessories", "Electronics", "Home"];

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    fetch(`${API}/products?${params.toString()}`)
      .then((response) => response.json())
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <section className="section">
      <p className="eyebrow">OUR COLLECTION</p>
      <h1 className="pagetitle">Shop everything.</h1>
      <div className="search">
        <input
          placeholder="Search products..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="filters">
        {categories.map((item) => (
          <button
            key={item}
            className={`filter ${category === item ? "active" : ""}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {loading ? <p>Loading...</p> : products.length ? (
        <div className="products">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : <p className="muted">No products found.</p>}
    </section>
  );
}

function ProductDetail() {
  const { id } = useParams();
  const { add } = useStore();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`${API}/products/${id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Product not found");
        return response.json();
      })
      .then(setProduct)
      .catch(console.error);
  }, [id]);

  if (!product) return <section className="section">Loading product...</section>;

  return (
    <section className="section detail">
      <img src={product.image} alt={product.name} />
      <div>
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
        <p className="detailprice">₹{product.price}</p>
        <p>{product.description}</p>
        <button className="addbtn" onClick={() => add(product._id)}>
          Add to bag ＋
        </button>
      </div>
    </section>
  );
}

function Auth() {
  const { login, register, user } = useStore();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section auth">
      <div className="authbox">
        <p className="eyebrow">{isRegister ? "JOIN MERNCART" : "WELCOME BACK"}</p>
        <h1>{isRegister ? "Create account." : "Login."}</h1>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
          {error && <p className="error">{error}</p>}
          <button className="shopbtn full" disabled={busy}>
            {busy ? "Please wait..." : isRegister ? "Create account" : "Login"}
          </button>
        </form>
        <p className="switch">
          {isRegister ? "Already have an account? " : "New here? "}
          <button onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}>
            {isRegister ? "Login" : "Create account"}
          </button>
        </p>
      </div>
    </section>
  );
}

function Cart() {
  const { cart, updateQuantity, remove } = useStore();
  const navigate = useNavigate();
  const items = cart.filter((item) => item.product);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity, 0
  );

  if (!items.length) {
    return (
      <section className="section empty">
        <h1>Your bag is empty.</h1>
        <p className="muted">Looks like you haven't added anything yet.</p>
        <Link to="/shop" className="shopbtn">Explore products</Link>
      </section>
    );
  }

  return (
    <section className="section">
      <p className="eyebrow">YOUR SELECTION</p>
      <h1 className="pagetitle">Shopping bag.</h1>
      <div className="cartlayout">
        <div className="cartitems">
          {items.map((item) => (
            <div className="cartitem" key={item.product._id}>
              <img src={item.product.image} alt={item.product.name} />
              <div className="cartinfo">
                <h3>{item.product.name}</h3>
                <span>₹{item.product.price}</span>
                <div className="qty">
                  <button onClick={() =>
                    updateQuantity(item.product._id, item.quantity - 1)
                  }>−</button>
                  <b>{item.quantity}</b>
                  <button onClick={() =>
                    updateQuantity(item.product._id, item.quantity + 1)
                  }>＋</button>
                </div>
              </div>
              <button className="remove" onClick={() => remove(item.product._id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <aside className="summary">
          <h3>Order summary</h3>
          <div><span>Subtotal</span><b>₹{total}</b></div>
          <div><span>Delivery</span><b>Free</b></div>
          <div className="total"><span>Total</span><strong>₹{total}</strong></div>
          <button className="shopbtn full" onClick={() => navigate("/checkout")}>
            Continue to checkout
          </button>
        </aside>
      </div>
    </section>
  );
}

function Checkout() {
  const { cart, request, loadCart, showNotice } = useStore();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = cart.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity, 0
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await request("/orders", {
        method: "POST",
        body: JSON.stringify({ address, phone })
      });
      await loadCart();
      showNotice("Order placed successfully!");
      navigate("/orders");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!cart.length) {
    return (
      <section className="section empty">
        <h1>Your bag is empty.</h1>
        <Link to="/shop" className="shopbtn">Shop now</Link>
      </section>
    );
  }

  return (
    <section className="section">
      <p className="eyebrow">ALMOST YOURS</p>
      <h1 className="pagetitle">Checkout.</h1>
      <div className="checkout">
        <form className="checkoutform" onSubmit={handleSubmit}>
          <label>
            Delivery address
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Enter your complete address"
              required
            />
          </label>
          <label>
            Phone number
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter phone number"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="shopbtn full" disabled={busy}>
            {busy ? "Placing order..." : "Place order"}
          </button>
        </form>
        <aside className="summary">
          <h3>Your order</h3>
          {cart.map((item) => (
            <div key={item.product?._id}>
              <span>{item.product?.name} × {item.quantity}</span>
              <b>₹{(item.product?.price || 0) * item.quantity}</b>
            </div>
          ))}
          <div className="total"><span>Total</span><strong>₹{total}</strong></div>
        </aside>
      </div>
    </section>
  );
}

function Orders() {
  const { request } = useStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/orders")
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section">
      <p className="eyebrow">YOUR PURCHASES</p>
      <h1 className="pagetitle">My orders.</h1>
      {loading && <p>Loading orders...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <p className="muted">You haven't placed any orders yet.</p>
      )}
      {orders.map((order) => (
        <article className="order" key={order._id}>
          <div>
            <b>Order #{order._id.slice(-7)}</b>
            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
          <p>Status: {order.status}</p>
          {order.items.map((item, index) => (
            <div key={index}>
              <span>{item.name} × {item.quantity}</span>
              <b>₹{item.price * item.quantity}</b>
            </div>
          ))}
          <p><strong>Total: ₹{order.total}</strong></p>
        </article>
      ))}
    </section>
  );
}

function NotFound() {
  return (
    <section className="section empty">
      <h1>Page not found.</h1>
      <Link to="/" className="shopbtn">Go home</Link>
    </section>
  );
}

function AppContent() {
  const { notice } = useStore();
  return (
    <>
      <Navbar />
      {notice && <div className="toast">{notice}</div>}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer>
        <div className="footerbrand">MERNCART.</div>
        <p>Thoughtful essentials for everyday living.</p>
        <small>© 2026 MERNCART. ALL RIGHTS RESERVED.</small>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
