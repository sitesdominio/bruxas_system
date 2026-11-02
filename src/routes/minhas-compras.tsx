import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/minhas-compras")({
  head: () => ({ meta: [{ title: "Minhas compras — Olho da Bruxa" }, { name: "description", content: "Minhas compras no Olho da Bruxa." }, { property: "og:title", content: "Minhas compras — Olho da Bruxa" }, { property: "og:description", content: "Minhas compras no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Minhas compras" requireAuth={true}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
