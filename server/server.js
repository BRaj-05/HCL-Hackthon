
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "HCL Hackathon backend is running!",
  });
});

app.use('/api', require('./routes/recoverPlusRoutes'));
app.use((req, res, next) => next(new (require('./middleware/errors').ApiError)(404, 'NOT_FOUND', 'Route not found')));
app.use(require('./middleware/errors').errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
