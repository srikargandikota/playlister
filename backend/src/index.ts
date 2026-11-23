import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth";
import { tracksRouter } from "./routes/tracks";
import { commandsRouter } from "./routes/commands";
import { recommendationsRouter } from "./routes/recommendations";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/tracks", tracksRouter);
app.use("/commands", commandsRouter);
app.use("/recommendations", recommendationsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${PORT}`);
});

