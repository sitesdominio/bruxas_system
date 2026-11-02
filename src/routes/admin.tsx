import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel ADM — Olho da Bruxa" }, { name: "description", content: "Painel ADM no Olho da Bruxa." }, { property: "og:title", content: "Painel ADM — Olho da Bruxa" }, { property: "og:description", content: "Painel ADM no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Painel ADM" requireAuth={true}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
