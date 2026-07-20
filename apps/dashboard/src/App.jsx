import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import routesConfig from "./routes";

const router = createBrowserRouter(routesConfig);

export function App() {
  return <RouterProvider router={router} />;
}

export default App;
