import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

const productSchema = new mongoose.Schema({
  name: { type: String, required: true }, description: String,
  price: { type: Number, required: true }, category: String,
  image: String, stock: { type: Number, default: 20 }
}, { timestamps: true });
const userSchema = new mongoose.Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, cart: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, quantity: Number }]
}, { timestamps: true });
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, name: String, image: String, price: Number, quantity: Number }],
  total: Number, address: String, phone: String, status: { type: String, default: "Placed" }
}, { timestamps: true });
const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

const auth = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Please log in" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ message: "User not found" });
    next();
  } catch { res.status(401).json({ message: "Invalid or expired token" }); }
};

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/products", async (req, res) => {
  const filter = {};
  if (req.query.category && req.query.category !== "All") filter.category = req.query.category;
  if (req.query.search) filter.name = { $regex: req.query.search, $options: "i" };
  res.json(await Product.find(filter).sort({ createdAt: -1 }));
});
app.get("/api/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: "Enter name, valid email and password (6+ characters)" });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 12) });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ message: "Registration failed" }); }
});
app.post("/api/auth/login", async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || "").toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) return res.status(401).json({ message: "Incorrect email or password" });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
});
app.get("/api/cart", auth, async (req, res) => {
  await req.user.populate("cart.product");
  res.json(req.user.cart.filter(x => x.product));
});
app.post("/api/cart", auth, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ message: "Invalid product" });
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });
  const item = req.user.cart.find(x => x.product.toString() === productId);
  if (item) item.quantity = Math.min(99, item.quantity + Number(quantity));
  else req.user.cart.push({ product: productId, quantity: Math.max(1, Number(quantity)) });
  await req.user.save(); await req.user.populate("cart.product");
  res.json(req.user.cart);
});
app.patch("/api/cart/:productId", auth, async (req, res) => {
  const item = req.user.cart.find(x => x.product.toString() === req.params.productId);
  if (!item) return res.status(404).json({ message: "Cart item not found" });
  const qty = Number(req.body.quantity);
  if (qty <= 0) req.user.cart = req.user.cart.filter(x => x.product.toString() !== req.params.productId);
  else item.quantity = Math.min(99, qty);
  await req.user.save(); await req.user.populate("cart.product"); res.json(req.user.cart);
});
app.delete("/api/cart/:productId", auth, async (req, res) => {
  req.user.cart = req.user.cart.filter(x => x.product.toString() !== req.params.productId);
  await req.user.save(); res.json({ message: "Removed" });
});
app.post("/api/orders", auth, async (req, res) => {
  const { address, phone } = req.body;
  if (!address || !phone) return res.status(400).json({ message: "Delivery address and phone are required" });
  await req.user.populate("cart.product");
  const items = req.user.cart.filter(x => x.product).map(x => ({
    product: x.product._id, name: x.product.name, image: x.product.image,
    price: x.product.price, quantity: x.quantity
  }));
  if (!items.length) return res.status(400).json({ message: "Your cart is empty" });
  const total = items.reduce((sum, x) => sum + x.price * x.quantity, 0);
  const order = await Order.create({ user: req.user._id, items, total, address, phone });
  req.user.cart = []; await req.user.save();
  res.status(201).json(order);
});
app.get("/api/orders", auth, async (req, res) => res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 })));

const sampleProducts = [
  ["Minimal Sneakers","Comfortable everyday sneakers with a clean silhouette.",2499,"Footwear","https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"],
  ["Classic Watch","A timeless watch for work and weekends.",3299,"Accessories","https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"],
  ["Urban Backpack","Roomy everyday backpack with laptop storage.",1899,"Accessories","https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800"],
  ["Wireless Headphones","Immersive sound and all-day comfort.",2799,"Electronics","https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"],
  ["Sunglasses","Lightweight frames for everyday use.",999,"Accessories","https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800"],
  ["Smart Speaker","Compact speaker with rich room-filling sound.",2199,"Electronics","https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800"],
  ["Running Shoes","Lightweight shoes built for daily movement.",2999,"Footwear","https://images.unsplash.com/photo- Nike".replace("photo- Nike","photo-1542291026-7eec264c27ff")+"?w=800"],
  ["Desk Lamp","Minimal lamp for a focused workspace.",1499,"Home","https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800"]
];
async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  if (await Product.countDocuments() === 0) await Product.insertMany(sampleProducts.map(([name,description,price,category,image]) => ({name,description,price,category,image})));
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API running on ${port}`));
}
start().catch(err => { console.error(err); process.exit(1); });
