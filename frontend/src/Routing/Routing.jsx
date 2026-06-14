import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Welcome from "../pages/Welcome";
import Index from "../components/Index";
import RepoAnalyzer from "../components/Github/RepoAnalyzer";
import Profile from "../pages/Profile";
import GraphView from "../pages/GraphView";
import VisualAnalysis from "../pages/VisualAnalysis";
import MetricsDashboard from "../pages/MetricsDashboard";
import DeveloperTools from "../pages/DeveloperTools";

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/" replace />;
  return children;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Welcome />,
    children: [
      { index: true, element: <Index /> },
      {
        path: "analyzer",
        element: (
          <ProtectedRoute>
            <RepoAnalyzer />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <GraphView /> },
          { path: "visual",  element: <VisualAnalysis /> },
          { path: "metrics", element: <MetricsDashboard /> },
          { path: "tools",   element: <DeveloperTools /> },
        ],
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default function NewRouter() {
  return <RouterProvider router={router} />;
}
