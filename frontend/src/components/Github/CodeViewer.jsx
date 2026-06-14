import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const FancyCodeViewer = ({ fileData }) => {
  console.log(fileData);
  const [copied, setCopied] = useState(false);
  if (!fileData || !fileData.success) {
    return <div>No code to display.</div>;
  }
  const handleCopy = () => {
    // Copies the raw string to the user's clipboard
    navigator.clipboard.writeText(fileData.content);
    setCopied(true);

    // Reset the button text after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };
  // Extract the file extension to tell the highlighter what language to use
  const getLanguage = (path) => {
    if (path.endsWith(".jsx") || path.endsWith(".js")) return "jsx";
    if (path.endsWith(".css")) return "css";
    if (path.endsWith(".html")) return "html";
    return "javascript"; // default fallback
  };

  return (
    <div
      style={{
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #333",
      }}
    >
      <div
        style={{
          backgroundColor: "#2d2d2d",
          padding: "10px",
          color: "#fff",
          borderBottom: "1px solid #111",
        }}
      >
        📄 {fileData.path}
      </div>

      <SyntaxHighlighter
        language={getLanguage(fileData.path)}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: "20px" }} // removes weird default margins
        showLineNumbers={true}
      >
        {fileData.content}
      </SyntaxHighlighter>
    </div>
  );
};

export default FancyCodeViewer;
