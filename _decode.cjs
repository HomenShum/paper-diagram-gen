const fs = require("fs");
const path = require("path");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "_files.json"), "utf8"));
for (const [file, b64] of Object.entries(data)) {
  const content = Buffer.from(b64, "base64").toString("utf8");
  const dir = path.dirname(path.join(__dirname, file));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(__dirname, file), content);
  console.log("Wrote " + file + " (" + content.length + " chars)");
}