# Verified Cloudflare Workers Production Code Examples

### 1. Durable Objects WebSocket Hibernation
```typescript
import { DurableObject } from "cloudflare:workers";

interface Env {
  WEBSOCKET_HIBERNATION_SERVER: DurableObjectNamespace<WebSocketHibernationServer>;
}

export class WebSocketHibernationServer extends DurableObject {
  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept WebSocket using Hibernation API
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const clientsCount = this.ctx.getWebSockets().length;
    ws.send(`[Durable Object] message: ${message}, connections: ${clientsCount}`);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    ws.close(code, "Durable Object is closing WebSocket");
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    ws.close(1011, "WebSocket error");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.WEBSOCKET_HIBERNATION_SERVER.idFromName("chat-room");
    return env.WEBSOCKET_HIBERNATION_SERVER.get(id).fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

**Configuration (`wrangler.jsonc`):**
```jsonc
{
  "name": "websocket-hibernation-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true, "head_sampling_rate": 1 },
  "durable_objects": {
    "bindings": [
      {
        "name": "WEBSOCKET_HIBERNATION_SERVER",
        "class_name": "WebSocketHibernationServer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["WebSocketHibernationServer"]
    }
  ]
}
```

---

### 2. Durable Objects Alarm API
```typescript
import { DurableObject } from "cloudflare:workers";

interface Env {
  ALARM_EXAMPLE: DurableObjectNamespace<AlarmExample>;
}

const SECONDS = 1000;

export class AlarmExample extends DurableObject {
  async fetch(request: Request) {
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm == null) {
      await this.ctx.storage.setAlarm(Date.now() + 10 * SECONDS);
    }
    return Response.json({ status: "Alarm scheduled", nextAlarm: currentAlarm });
  }

  async alarm(alarmInfo?: { retryCount: number }) {
    if (alarmInfo && alarmInfo.retryCount > 0) {
      console.warn(`Alarm retry attempt #${alarmInfo.retryCount}`);
    }

    // Do scheduled work here...
    console.log("Alarm executed successfully at:", new Date().toISOString());

    // Schedule next run
    await this.ctx.storage.setAlarm(Date.now() + 60 * SECONDS);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.ALARM_EXAMPLE.idFromName("scheduled-worker");
    return env.ALARM_EXAMPLE.get(id).fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

---

### 3. KV Session Authentication with Hono
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";

interface Env {
  AUTH_TOKENS: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());

app.get("/api/me", async (c) => {
  try {
    const token = c.req.header("Authorization")?.slice(7) ||
      c.req.header("Cookie")?.match(/auth_token=([^;]+)/)?.[1];

    if (!token) {
      return c.json({ authenticated: false, message: "No token provided" }, 401);
    }

    const userData = await c.env.AUTH_TOKENS.get(token);
    if (!userData) {
      return c.json({ authenticated: false, message: "Invalid or expired session" }, 403);
    }

    return c.json({ authenticated: true, user: JSON.parse(userData) });
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
```

---

### 4. Cloudflare Queues (Producer & Consumer)
```typescript
interface Env {
  REQUEST_QUEUE: Queue<RequestLog>;
  UPSTREAM_API_URL: string;
  UPSTREAM_API_KEY: string;
}

interface RequestLog {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const info: RequestLog = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers),
    };

    await env.REQUEST_QUEUE.send(info);
    return Response.json({ message: "Request queued", requestId: crypto.randomUUID() });
  },

  async queue(batch: MessageBatch<RequestLog>, env: Env): Promise<void> {
    const requests = batch.messages.map((msg) => msg.body);

    const response = await fetch(env.UPSTREAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.UPSTREAM_API_KEY}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        batchSize: requests.length,
        requests,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upstream API failed: ${response.status}`);
    }
  },
} satisfies ExportedHandler<Env, RequestLog>;
```

---

### 5. Hyperdrive: PostgreSQL Database Connection
```typescript
import postgres from "postgres";

export interface Env {
  HYPERDRIVE: Hyperdrive;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Connect through Hyperdrive's global connection pool
    const sql = postgres(env.HYPERDRIVE.connectionString);

    try {
      const results = await sql`SELECT NOW() as current_time, * FROM users LIMIT 10`;
      return Response.json(results);
    } catch (e) {
      console.error("Query failed:", e);
      return Response.json({ error: e instanceof Error ? e.message : e }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
```

---

### 6. Cloudflare Workflows: Durable Execution
```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

type Env = {
  MY_WORKFLOW: Workflow;
};

type OrderParams = {
  orderId: string;
  email: string;
};

export class OrderWorkflow extends WorkflowEntrypoint<Env, OrderParams> {
  async run(event: WorkflowEvent<OrderParams>, step: WorkflowStep) {
    // Step 1: Validate & charge
    const payment = await step.do("charge-payment", async () => {
      return { status: "paid", chargeId: "ch_" + crypto.randomUUID() };
    });

    // Step 2: Sleep durable step
    await step.sleep("wait-for-inventory-dispatch", "30 seconds");

    // Step 3: Fulfillment with exponential retries
    await step.do(
      "dispatch-package",
      {
        retries: { limit: 5, delay: "5 seconds", backoff: "exponential" },
        timeout: "10 minutes",
      },
      async () => {
        console.log(`Dispatched package for order: ${event.payload.orderId}`);
      }
    );
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const data: OrderParams = await req.json();
    const instance = await env.MY_WORKFLOW.create({
      id: crypto.randomUUID(),
      params: data,
    });
    return Response.json({ id: instance.id, status: await instance.status() });
  },
} satisfies ExportedHandler<Env>;
```

---

### 7. Workers Analytics Engine
```typescript
interface Env {
  USER_EVENTS: AnalyticsEngineDataset;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "anonymous";

    // Non-blocking write: do NOT await
    env.USER_EVENTS.writeDataPoint({
      blobs: [url.pathname, req.method],
      doubles: [1, Date.now()],
      indexes: [userId],
    });

    return Response.json({ status: "recorded" });
  },
} satisfies ExportedHandler<Env>;
```

---

### 8. Browser Rendering (Puppeteer on Workers)
```typescript
import puppeteer from "@cloudflare/puppeteer";

interface Env {
  MYBROWSER: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) {
      return Response.json({ error: "Missing ?url= parameter" }, { status: 400 });
    }

    const browser = await puppeteer.launch(env.MYBROWSER);
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2" });
      const pageTitle = await page.title();
      return Response.json({ url, title: pageTitle });
    } finally {
      await browser.close();
    }
  },
} satisfies ExportedHandler<Env>;
```

---

### 9. Cloudflare Agents SDK (State, SQL, Scheduling, React)
```typescript
import { Agent, AgentNamespace, routeAgentRequest } from "agents";
import { OpenAI } from "openai";

interface Env {
  AIAgent: AgentNamespace<ChatAgent>;
  OPENAI_API_KEY: string;
}

interface ChatState {
  interactions: number;
  lastTopic: string;
}

export class ChatAgent extends Agent<Env, ChatState> {
  initialState: ChatState = { interactions: 0, lastTopic: "general" };

  async onRequest(request: Request): Promise<Response> {
    const ai = new OpenAI({ apiKey: this.env.OPENAI_API_KEY });
    const prompt = await request.text();

    const response = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = response.choices[0].message.content || "";

    // Embedded SQLite persistence
    this.sql`INSERT INTO history (timestamp, prompt, reply) VALUES (${Date.now()}, ${prompt}, ${reply})`;

    // Synchronize state across all connected clients
    this.setState({
      interactions: this.state.interactions + 1,
      lastTopic: prompt.slice(0, 30),
    });

    return new Response(reply);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) || Response.json({ msg: "No agent" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

---

### 10. Workers AI Structured Outputs (JSON Schema)
```typescript
import { OpenAI } from "openai";

interface Env {
  OPENAI_API_KEY: string;
}

const BookingSchema = {
  type: "object",
  properties: {
    roomType: { type: "string" },
    checkInDate: { type: "string" },
    guests: { type: "number" },
  },
  required: ["roomType", "checkInDate", "guests"],
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const content = await request.text();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: "Extract booking details as structured JSON." },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "booking_event",
          schema: BookingSchema,
          strict: true,
        },
      },
    });

    return Response.json({ data: JSON.parse(completion.choices[0].message.content || "{}") });
  },
} satisfies ExportedHandler<Env>;
```
