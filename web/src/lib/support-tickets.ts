import type { TicketCategory, TicketStatus } from "@/services/api/support-tickets";

export const ticketCategoryLabels: Record<TicketCategory, string> = { billing: "扣费问题", generation: "生成问题", account: "账号问题", other: "其他问题" };
export const ticketStatusLabels: Record<TicketStatus, string> = { pending: "等待客服回复", replied: "客服已回复", closed: "工单已关闭" };
export const ticketStatusColors: Record<TicketStatus, string> = { pending: "processing", replied: "success", closed: "default" };
export const creditLogTypeLabels: Record<string, string> = { ai_consume: "使用扣费", ai_refund: "失败返还", admin_adjust: "后台调整", free_image_reward: "作品奖励" };
