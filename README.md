<div align="center">
  <img src="Dashboard.png" alt="Dashboard Preview" width="100%" />

  # ⚖️ Load Balancer Simulator

  <p>
    <strong>A modern full-stack dashboard to simulate, analyze, and compare load balancing strategies.</strong>
  </p>
  
  <p>
    <a href="http://loadbalancer-simulator-frontend-2026-ab.s3-website.ap-south-1.amazonaws.com/" target="_blank">
      <img src="https://img.shields.io/badge/🔴%20Live%20Demo-Click%20Here-success?style=for-the-badge" alt="Live Demo Available" />
    </a>
  </p>
</div>

---

## ✨ Features
- **Algorithm Implementations:** Visually simulate Round Robin, Least Connections, Random, and Weighted load balancing methods.
- **Dynamic Simulation Events:** Generates realistic loads (100-500 requests) to mimic authentic traffic behaviors.
- **Glassmorphism Design Theme:** Premium, high-quality neon dashboard with smooth transitions and CSS keyframe animations.
- **Real-time Analytics:** Uses Chart.js for real-time visualization of server loads, request distribution, and performance metrics.
- **Overload Visual Alerts:** Dynamic threshold detection alerts you when active servers exceed safe operational capacity.
- **Secure Authentication:** JWT-based user authentication and data persistence with MongoDB.

---

## 📸 Screenshots & Previews

### 1. Main Dashboard
![Dashboard Preview](Dashboard.png)

### 2. Live Simulation Metrics
![Simulation Running](SimulationRunning.png)
![Simulation Settings](SimulationPage.png)

### 3. Analytics & Comparisons
<p align="center">
  <img src="AnalyticsTab.png" width="48%" />
  <img src="ComparisionTab.png" width="48%" />
</p>

### 4. User Activity & Authentication
<p align="center">
  <img src="ActivityTab.png" width="48%" />
  <img src="LoginPage.png" width="48%" />
</p>

---

## 🛠️ Tech Stack
- **Frontend Core:** React.js, Vite, HTML5, CSS3 (Vanilla Glassmorphism UI)
- **Visualizations:** Chart.js
- **Backend Service:** Node.js, Express.js
- **Database & Storage:** MongoDB / Mongoose ODM

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v16.x or newer recommended)
- **MongoDB** (Local instance or Atlas URI)

### 2. Backend Setup
Navigate to the `backend` folder and start the API server:
```bash
cd backend
npm install
# Ensure you configure your variables (do not check .env into source control!)
node server.js
```
The API should run locally on `http://localhost:5000`.

### 3. Frontend Setup (React App)
Open a separate terminal window and initiate the React environment:
```bash
cd frontend-react
npm install
npm run dev
```
The React development server typically runs on `http://localhost:5173`.

### 4. Running a Live Simulation
1. Confirm the backend API (`port 5000`) and the UI (`port 5173`) are both running.
2. Launch the web UI in your browser.
3. Configure your server setup and algorithm.
4. Click **Run Simulation** and watch the animated server bars and dynamic node request allocations.

---

## 🔒 Security Best Practices
- The repository uses strict `.gitignore` rules to prevent pushing `loadbalancer-key.pem` and `.env` files to remote version control. Do not commit sensitive keys!

---

## 📜 Project Structure
```text
LOADBALANCER/
├── backend/
│   ├── controllers/    # Request dispatching & simulation logic
│   ├── models/         # Mongoose User and Request schemas
│   ├── routes/         # Express API endpoints
│   ├── middleware/     # JWT authentication verifiers
│   └── server.js       # Main API application 
├── frontend-react/
│   ├── src/            # React application components and views
│   ├── public/         # Static assets and template index
│   └── vite.config.js  # React development server options
├── .gitignore          # Repo-wide exclusion policies
└── README.md           # Documentation
```
