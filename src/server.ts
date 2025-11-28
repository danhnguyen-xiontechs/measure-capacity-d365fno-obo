import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import path from "path";
import accountRoutes from "./routes/accountRoutes";
import d365Routes from "./routes/d365Routes";
import authRoutes from "./routes/authRoutes";
import loadTestRoutes from "./routes/loadTestRoutes";
import { swaggerSpec } from "./swagger";

dotenv.config();
const cors = require("cors");
const app = express();
app.use(cors()); // allow all origins
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/d365", d365Routes);
app.use("/api/loadtest", loadTestRoutes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Login page: http://localhost:${port}/`);
    console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});
