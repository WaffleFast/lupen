import { listen } from "@colyseus/tools";
import app from "./app.config.js";

await listen(app);
