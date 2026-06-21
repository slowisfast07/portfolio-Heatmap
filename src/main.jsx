import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import posthog from "posthog-js";
import App from "./App.jsx";
import "./index.css";

// Vercel Web Analytics — pageviews (custom events need Pro, so PostHog below handles events/funnels/retention).
inject();

// PostHog — free product analytics: custom events, funnels, retention cohorts, session replay.
// Setup: add VITE_POSTHOG_KEY (project API key, starts with phc_) in Vercel → Environment Variables → Redeploy.
// Optional: VITE_POSTHOG_HOST (default https://us.i.posthog.com; use https://eu.i.posthog.com if you chose EU).
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY;
if (PH_KEY) {
  posthog.init(PH_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "always", // anonymous visitors still get a profile → retention/cohorts work without login
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
  });
  if (typeof window !== "undefined") window.posthog = posthog; // so track() in App.jsx can forward events
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
