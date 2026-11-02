// Dados públicos da loja (não colocar segredos aqui).
export const STORE = {
  name: "Olho da Bruxa",
  whatsapp: "5551982536937",
  instagram: "https://instagram.com/",
  timezone: "America/Sao_Paulo",
};

export const waLink = (text = "Olá! Vim pelo site Olho da Bruxa.", phone = STORE.whatsapp) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export const brl = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ORDER_STATUS: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  preparando: "Em preparação",
  enviado: "Enviado",
  pronto_retirada: "Pronto para retirada",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
