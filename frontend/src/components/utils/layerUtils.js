export function getLayer(id) {
  if (!id) return "other";
  if (id.startsWith("backend/")) return "backend";
  if (id.includes("/controllers/")) return "controllers";
  if (id.includes("/middleware/")) return "middleware";
  if (id.includes("/models/")) return "models";
  if (id.includes("/routes/")) return "routes";
  if (id.includes("/services/")) return "services";
  if (id.includes("/utils/") || id.includes("/lib/")) return "utils";
  if (id.includes("/hooks/")) return "hooks";
  if (id.includes("/components/ui/")) return "ui";
  if (id.includes("/components/")) return "components";
  if (id.includes("/app/") || id.includes("/pages/")) return "pages";
  if (id.includes("/src/")) return "src";
  return "other";
}

export function nodeRadius(node, inDegree) {
  const deg = inDegree[node.id] || 0;
  return Math.min(4 + deg * 2.5, 18);
}
