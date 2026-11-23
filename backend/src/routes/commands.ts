import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { parseCommand } from "../services/commandService";
import { buildQueue } from "../services/queueService";
import { interpret } from "../services/aiCommandService";
import { allTagNames } from "../services/libraryService";

export const commandsRouter = Router();

commandsRouter.use(requireAuth);

commandsRouter.post("/run", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const { input } = req.body as { input?: string };
  if (!input) {
    return res.status(400).json({ error: "input is required" });
  }

  try {
    const parsed = parseCommand(input);
    const queue = await buildQueue(userId, parsed);
    const uris = queue.map((item) => `spotify:track:${item.spotifyTrackId}`);
    res.json({
      command: parsed,
      queue,
      uris,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Command error", err);
    res.status(400).json({ error: (err as Error).message });
  }
});


// Free text requests ("something mellow in a minor key, 30 minutes"). Claude maps the request
// onto the user's own tags when ANTHROPIC_API_KEY is set; otherwise a rule based parser does.
commandsRouter.post("/ask", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const { input } = req.body as { input?: string };
  if (!input) {
    return res.status(400).json({ error: "input is required" });
  }

  try {
    const tags = await allTagNames(userId);
    const { command, interpreter, droppedTags } = await interpret(input, tags);
    const queue = await buildQueue(userId, command);
    res.json({
      command,
      interpreter,
      droppedTags,
      queue,
      uris: queue.map((item) => `spotify:track:${item.spotifyTrackId}`),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Ask error", err);
    res.status(400).json({ error: (err as Error).message });
  }
});
