import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] 理论记忆后端已启动 → http://localhost:${PORT}`);
  console.log(`[server] AI 模型: ${process.env.AI_MODEL || "gpt-4o"}`);
});
