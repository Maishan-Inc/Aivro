import { apiGet, apiPost, compactApiParams } from "@/services/api/request";
import type { CreditLog } from "@/services/api/billing";

export type TicketCharge = Omit<CreditLog, "userId" | "category">;
export type TicketStatus = "pending" | "replied" | "closed";
export type TicketCategory = "billing" | "generation" | "account" | "other";
export type SupportTicket = {
    id: string;
    userId: string;
    title: string;
    category: TicketCategory;
    content: string;
    status: TicketStatus;
    creditLogId: string;
    charge: TicketCharge | null;
    user?: { id: string; username: string; displayName: string; avatarUrl: string };
    createdAt: string;
    updatedAt: string;
};
export type TicketReply = { id: string; ticketId: string; authorId: string; isAdmin: boolean; content: string; createdAt: string };
export type TicketDetail = SupportTicket & { replies: TicketReply[] };
export type TicketList = { items: SupportTicket[]; total: number };
export type CreateTicketInput = { title: string; category: TicketCategory; content: string; creditLogId?: string };
export type TicketQuery = { keyword?: string; category?: string; type?: string; page?: number; pageSize?: number };

const ticketPath = (admin: boolean) => admin ? "/api/admin/support-tickets" : "/api/v1/support-tickets";

export function fetchTickets(token: string, query: TicketQuery, admin = false) {
    return apiGet<TicketList>(ticketPath(admin), compactApiParams(query), token);
}

export function fetchTicket(token: string, id: string, admin = false) {
    return apiGet<TicketDetail>(`${ticketPath(admin)}/${encodeURIComponent(id)}`, undefined, token);
}

export function createTicket(token: string, input: CreateTicketInput) {
    return apiPost<SupportTicket>(ticketPath(false), input, token);
}

export function replyTicket(token: string, id: string, content: string, admin = false) {
    return apiPost<boolean>(`${ticketPath(admin)}/${encodeURIComponent(id)}/replies`, { content }, token);
}

export function setTicketStatus(token: string, id: string, status: "closed" | "pending", admin = false) {
    return apiPost<boolean>(`${ticketPath(admin)}/${encodeURIComponent(id)}/status`, { status }, token);
}

export function fetchTicketCharge(token: string, id: string) {
    return apiGet<TicketCharge>(`/api/v1/credit-logs/${encodeURIComponent(id)}`, undefined, token);
}
