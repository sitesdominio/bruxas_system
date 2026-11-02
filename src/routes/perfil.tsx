import { createFileRoute } from "@tanstack/react-router";
import { Page, Panel } from "@/components/Page";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Olho da Bruxa" }, { name: "description", content: "Meu Perfil no Olho da Bruxa." }, { property: "og:title", content: "Meu Perfil — Olho da Bruxa" }, { property: "og:description", content: "Meu Perfil no Olho da Bruxa." }] }),
  component: () => (
    <Page title="Meu Perfil" requireAuth={true}>
      <Panel>Em construção.</Panel>
    </Page>
  ),
});
