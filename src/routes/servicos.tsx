import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Olho da Bruxa" }, { name: "description", content: "Serviços no Olho da Bruxa." }, { property: "og:title", content: "Serviços — Olho da Bruxa" }, { property: "og:description", content: "Serviços no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Serviços" requireAuth={false}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
