import "./loadEnv.js";
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server';

const app = new Hono();

// Helper to dynamically import endpoint modules in both built (.js) and source (.ts) environments.
async function importEndpoint(pathBase: string) {
  // Use file:// URLs so Node's dynamic import resolves correctly from this module
  try {
    return await import(new URL(pathBase + ".js", import.meta.url).href);
  } catch (e) {
    try {
      return await import(new URL(pathBase + ".ts", import.meta.url).href);
    } catch (e2) {
      console.error("Failed to import endpoint:", pathBase, e2);
      throw e2;
    }
  }
}

app.get('_api/rooms/list',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/rooms/list_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/ebooks/list',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/ebooks/list_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/auth/logout',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/logout_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/auth/session',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/session_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/courses/list',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/courses/list_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/user/profile',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/user/profile_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/user/profile',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/user/profile_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/courses/enroll',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/courses/enroll_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/instructors/list',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/instructors/list_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/auth/oauth_callback',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/oauth_callback_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/courses/enrollments',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/courses/enrollments_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/rooms/bookings/list',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/rooms/bookings/list_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/auth/oauth_authorize',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/oauth_authorize_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/rooms/bookings/cancel',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/rooms/bookings/cancel_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/rooms/bookings/create',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/rooms/bookings/create_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/auth/establish_session',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/establish_session_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/auth/login_with_password',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/login_with_password_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/auth/register_with_password',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/auth/register_with_password_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/registration/notify',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/registration/notify_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/admin/enrollments/list',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/admin/enrollments/list_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/admin/lessons/complete',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/admin/lessons/complete_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/admin/lessons/uncomplete',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/admin/lessons/uncomplete_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/sheets/export',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/sheets/export_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.post('_api/sheets/import',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/sheets/import_POST");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/sheets/script',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/sheets/script_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.get('_api/lessons/upcoming',async c => {
  try {
    const { handle } = await importEndpoint("./endpoints/lessons/upcoming_GET");
    let request = c.req.raw;
    const response = await handle(request);
    if (!(response instanceof Response) && response.constructor.name !== "Response") {
      return c.text("Invalid response format. handle should always return a Response object." + response.constructor.name, 500);
    }
    return response;
  } catch (e) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message,  500)
  }
})
app.use("/*", serveStatic({ root: "./static" }));
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", async (c, next) => {
  const p = c.req.path;
  if (p.startsWith("/_api")) {
    return next();
  }
  return serveStatic({ path: "./dist/index.html" })(c, next);
});
const port = Number(process.env.PORT || 3333);
serve({ fetch: app.fetch, port });
console.log(`Running at http://localhost:${port}`);
