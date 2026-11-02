import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade e termos — Olho da Bruxa" }, { name: "description", content: "Privacidade e termos no Olho da Bruxa." }, { property: "og:title", content: "Privacidade e termos — Olho da Bruxa" }, { property: "og:description", content: "Privacidade e termos no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Privacidade e termos" requireAuth={false}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
