import { createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { IndexRoute } from "./routes/index";
import { ChatRoute } from "./routes/chat";
import { AtlassianCallbackRoute } from "./routes/atlassian-callback";

// Root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Index route (/)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRoute,
});

// Chat route (/chat/$conversationId)
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat/$conversationId",
  component: ChatRoute,
});

// Atlassian OAuth callback route
const atlassianCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/atlassian/callback",
  component: AtlassianCallbackRoute,
});

// Route tree
export const routeTree = rootRoute.addChildren([indexRoute, chatRoute, atlassianCallbackRoute]);
