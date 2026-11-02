/**
 * CAMADA DE DADOS — único ponto que fala com o banco.
 * Para trocar de banco (ex.: MySQL próprio), reimplemente estas funções
 * chamando a sua API, mantendo as mesmas assinaturas. Veja CREDENCIAIS.md.
 */
import { supabase } from "@/integrations/supabase/client";

const unwrap = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export type Product = {
  id: string; name: string; description: string | null; validity: string | null;
  price: number; stock: number; image_url: string | null; active: boolean;
};

export const api = {
  // Produtos
  listProducts: async () => unwrap(await supabase.from("products").select("*").order("created_at")) as Product[],
  saveProduct: async (p: Partial<Product>) => {
    const { id, ...rest } = p;
    if (id) return unwrap(await supabase.from("products").update(rest).eq("id", id));
    return unwrap(await supabase.from("products").insert(rest as never));
  },
  deleteProduct: async (id: string) => unwrap(await supabase.from("products").delete().eq("id", id)),

  // Configurações
  getSettings: async () => {
    const rows = unwrap(await supabase.from("settings").select("*")) as { key: string; value: string | null }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""])) as Record<string, string>;
  },
  saveSetting: async (key: string, value: string) =>
    unwrap(await supabase.from("settings").upsert({ key, value })),

  // Pedidos
  createOrder: async (items: { product_id: string; quantity: number }[], delivery_type: "entrega" | "retirada", address: Record<string, string> | null) =>
    unwrap(await supabase.rpc("create_order", { _items: items, _delivery_type: delivery_type, _address: address })) as string,
  myOrders: async () =>
    unwrap(await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false })),
  getOrder: async (id: string) =>
    unwrap(await supabase.from("orders").select("*, order_items(*)").eq("id", id).single()),
  updateOrderStatus: async (id: string, status: string) =>
    unwrap(await supabase.from("orders").update({ status }).eq("id", id)),

  // Perfil
  getProfile: async (id: string) => unwrap(await supabase.from("profiles").select("*").eq("id", id).maybeSingle()),
  saveProfile: async (id: string, p: { name?: string; phone?: string }) =>
    unwrap(await supabase.from("profiles").update(p).eq("id", id)),

  // Agenda
  listServices: async () => unwrap(await supabase.from("services").select("*, professional_services(professional_id)").order("name")),
  saveService: async (s: Record<string, unknown>) => {
    const { id, professional_services: _ps, ...rest } = s as { id?: string; professional_services?: unknown };
    if (id) return unwrap(await supabase.from("services").update(rest).eq("id", id));
    return unwrap(await supabase.from("services").insert(rest as never));
  },
  deleteService: async (id: string) => unwrap(await supabase.from("services").delete().eq("id", id)),
  listProfessionals: async () =>
    unwrap(await supabase.from("professionals").select("*, availability(*), professional_services(service_id)").order("name")),
  saveProfessional: async (p: Record<string, unknown>) => {
    const { id, ...rest } = p as { id?: string };
    if (id) return unwrap(await supabase.from("professionals").update(rest).eq("id", id));
    return unwrap(await supabase.from("professionals").insert(rest as never));
  },
  deleteProfessional: async (id: string) => unwrap(await supabase.from("professionals").delete().eq("id", id)),
  setProfessionalServices: async (professional_id: string, serviceIds: string[]) => {
    unwrap(await supabase.from("professional_services").delete().eq("professional_id", professional_id));
    if (serviceIds.length)
      unwrap(await supabase.from("professional_services").insert(serviceIds.map((service_id) => ({ professional_id, service_id }))));
  },
  setAvailability: async (professional_id: string, rows: { weekday: number; start_time: string; end_time: string }[]) => {
    unwrap(await supabase.from("availability").delete().eq("professional_id", professional_id));
    if (rows.length) unwrap(await supabase.from("availability").insert(rows.map((r) => ({ ...r, professional_id }))));
  },
  busySlots: async (day: string) =>
    unwrap(await supabase.rpc("busy_slots", { _day: day })) as { professional_id: string; starts_at: string; ends_at: string }[],
  book: async (service: string, professional: string, starts: string) =>
    unwrap(await supabase.rpc("book_appointment", { _service: service, _professional: professional, _starts: starts })) as string,
  myAppointments: async () =>
    unwrap(await supabase.from("appointments").select("*, services(name), professionals(name)").order("starts_at", { ascending: false })),
  allAppointments: async () =>
    unwrap(await supabase.from("appointments").select("*, services(name), professionals(name, whatsapp, email)").order("starts_at")),
  saveAppointment: async (a: Record<string, unknown>) => {
    const { id, services: _s, professionals: _p, ...rest } = a as { id?: string; services?: unknown; professionals?: unknown };
    if (id) return unwrap(await supabase.from("appointments").update(rest).eq("id", id));
    return unwrap(await supabase.from("appointments").insert(rest as never));
  },
  deleteAppointment: async (id: string) => unwrap(await supabase.from("appointments").delete().eq("id", id)),
};
