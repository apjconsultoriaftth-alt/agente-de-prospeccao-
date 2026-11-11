// Gera o GMAIL_REFRESH_TOKEN.
// Uso: GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-token.mjs
// No Google Cloud, o cliente OAuth deve ser do tipo "App para computador" (Desktop).
import http from "node:http";

const { GMAIL_CLIENT_ID: id, GMAIL_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) throw new Error("Defina GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET");

const redirect = "http://127.0.0.1:53682";
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.search = new URLSearchParams({
  client_id: id,
  redirect_uri: redirect,
  response_type: "code",
  access_type: "offline",
  prompt: "consent",
  scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
}).toString();

console.log("Abra no navegador e autorize com a conta que vai enviar os e-mails:\n\n" + url + "\n");

http
  .createServer(async (req, res) => {
    const code = new URL(req.url, redirect).searchParams.get("code");
    if (!code) return res.end("Sem código.");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
    }).then((x) => x.json());
    res.end("Pronto, pode fechar esta aba.");
    console.log(r.refresh_token ? `GMAIL_REFRESH_TOKEN=${r.refresh_token}` : r);
    process.exit(0);
  })
  .listen(53682);
