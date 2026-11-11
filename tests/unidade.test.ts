import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarTelefone, normalizarEmail } from "../src/lib/leads";
import { lerCsv } from "../src/lib/csv";
import { pediuParaSair } from "../src/lib/recebimento";
import { numeroDoJid, textoDaMensagem, variantesNumero } from "../src/lib/canais/evolution";
import { montarMime, textoDoEmail, type MsgGmail } from "../src/lib/canais/gmail";
import { dentroDoHorario } from "../src/lib/envio";

test("normaliza telefone brasileiro", () => {
  assert.equal(normalizarTelefone("(11) 99999-0000"), "5511999990000");
  assert.equal(normalizarTelefone("011 3333-4444"), "551133334444");
  assert.equal(normalizarTelefone("+55 21 98888-7777"), "5521988887777");
  assert.equal(normalizarTelefone("123"), null);
  assert.equal(normalizarEmail(" Ana@X.com "), "ana@x.com");
  assert.equal(normalizarEmail("invalido"), null);
});

test("lê CSV com ponto e vírgula e aspas", () => {
  assert.deepEqual(lerCsv('nome;telefone\n"Silva; Advogados";11 99999-0000\r\n'), [
    ["nome", "telefone"],
    ["Silva; Advogados", "11 99999-0000"],
  ]);
});

test("detecta pedido para sair só em mensagens curtas", () => {
  for (const t of ["SAIR", "sair.", " Parar ", "não quero receber", "descadastrar"]) assert.ok(pediuParaSair(t), t);
  for (const t of ["quero saber mais", "vou sair agora e te ligo depois", "ok"]) assert.ok(!pediuParaSair(t), t);
});

test("WhatsApp: jid, texto e variantes do 9º dígito", () => {
  assert.equal(numeroDoJid("5511999990000@s.whatsapp.net"), "5511999990000");
  assert.equal(numeroDoJid("12036304@g.us"), null);
  assert.equal(textoDaMensagem({ extendedTextMessage: { text: "oi" } }), "oi");
  assert.equal(textoDaMensagem({ audioMessage: {} }), "[áudio]");
  assert.deepEqual(variantesNumero("5511999990000").sort(), ["551199990000", "5511999990000"].sort());
  assert.deepEqual(variantesNumero("551199990000").sort(), ["551199990000", "5511999990000"].sort());
});

test("Gmail: MIME com descadastro e acentos no assunto", () => {
  const mime = montarMime(
    { para: "a@b.com", assunto: "Olá, Dra.", texto: "Corpo", linkDescadastro: "https://crm/x" },
    "Eu <eu@x.com>",
  );
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.match(mime, /List-Unsubscribe: <https:\/\/crm\/x>/);
  const corpo = Buffer.from(mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString();
  assert.match(corpo, /Não quer mais receber/);
});

test("Gmail: remove histórico citado da resposta", () => {
  const data = Buffer.from("Tenho interesse!\n\nEm seg., 10 de nov. de 2026, Eu escreveu:\n> texto antigo").toString("base64url");
  const m = { id: "1", threadId: "t", internalDate: "0", payload: { headers: [], mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data } }] } } as MsgGmail;
  assert.equal(textoDoEmail(m), "Tenho interesse!");
});

test("horário comercial em Brasília", () => {
  assert.ok(dentroDoHorario(new Date("2026-11-11T13:00:00Z"))); // qua 10h
  assert.ok(!dentroDoHorario(new Date("2026-11-11T22:00:00Z"))); // qua 19h
  assert.ok(!dentroDoHorario(new Date("2026-11-14T13:00:00Z"))); // sábado
});
