const https = require("https");

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload, "utf8"),
        ...headers,
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });

    req.on("timeout", () => req.destroy(new Error("Groq impact request timed out after 60s")));
    req.on("error", (err) => {
      console.error("[groq-impact] request error:", err.message);
      reject(err);
    });

    req.write(payload, "utf8");
    req.end();
  });
}

async function groqImpactAnalyze(systemPrompt, userMessage) {
  const apiKey = process.env.GROQ_API_KEY_4;
  console.log("[groq-impact] API key present:", !!apiKey);
  if (!apiKey) throw new Error("GROQ_API_KEY_4 is not set in environment");

  console.log("[groq-impact] sending request...");

  const { status, body } = await httpsPost(
    "api.groq.com",
    "/openai/v1/chat/completions",
    { Authorization: `Bearer ${apiKey}` },
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }
  );

  console.log("[groq-impact] response status:", status);
  console.log("[groq-impact] body (first 300 chars):", body.slice(0, 300));

  if (status < 200 || status >= 300) {
    throw new Error(`Groq API error ${status}: ${body}`);
  }

  const data = JSON.parse(body);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response");
  return text;
}

module.exports = { groqImpactAnalyze };
