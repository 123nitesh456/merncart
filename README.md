# MERNCART — Full-stack MERN E-commerce

## Requirements
- Node.js 18+
- MongoDB local instance or MongoDB Atlas URI

## Setup
1. Open this folder in VS Code.
2. In terminal run:
   ```bash
   npm install
   npm run install-all
   ```
3. Copy `server/.env.example` to `server/.env` and set `MONGO_URI` and `JWT_SECRET`.
4. Start MongoDB, then run:
   ```bash
   npm run dev
   ```
5. Frontend: http://localhost:5173 | API: http://localhost:5000

## Demo data
On first server start, sample products are inserted automatically when the products collection is empty.

## Features
- Product listing, search and category filtering
- Product detail page
- Registration/login with bcrypt password hashing and JWT
- Protected cart and order APIs
- Persistent cart stored in MongoDB
- Checkout with delivery details
- Order history
- Responsive React UI

## Environment variables
Only variable names are documented here. Never commit `.env`.
