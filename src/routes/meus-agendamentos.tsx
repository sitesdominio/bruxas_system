import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/meus-agendamentos")({
  head: () => ({ meta: [{ title: "Meus agendamentos — Olho da Bruxa" }, { name: "description", content: "Meus agendamentos no Olho da Bruxa." }, { property: "og:title", content: "Meus agendamentos — Olho da Bruxa" }, { property: "og:description", content: "Meus agendamentos no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Meus agendamentos" requireAuth={true}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
