import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho — Olho da Bruxa" }, { name: "description", content: "Carrinho no Olho da Bruxa." }, { property: "og:title", content: "Carrinho — Olho da Bruxa" }, { property: "og:description", content: "Carrinho no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Carrinho" requireAuth={true}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
