"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App } from "antd";

import { fetchAdminAuditLogs } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";
import { adminRealtimeQueryOptions } from "../admin-query-options";

const defaultPageSize = 10;

export function useAdminAuditLogs() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const clearSession = useUserStore((state) => state.clearSession);
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const query = useQuery({
        queryKey: ["admin", "audit-logs", token, keyword, page, pageSize],
        queryFn: () => fetchAdminAuditLogs(token, { keyword, page, pageSize }),
        enabled: Boolean(token),
        retry: false,
        ...adminRealtimeQueryOptions,
    });

    useEffect(() => {
        if (query.isError) {
            const errorMessage = query.error instanceof Error ? query.error.message : "读取审计日志失败";
            message.error(errorMessage);
            if (errorMessage.includes("未登录") || errorMessage.includes("权限不足") || errorMessage.includes("登录状态无效")) clearSession();
        }
    }, [clearSession, message, query.error, query.isError]);

    const updateFilters = (next: Partial<{ keyword: string; page: number; pageSize: number }>) => {
        const queryState = { keyword, page, pageSize, ...next };
        if (next.keyword !== undefined || next.pageSize !== undefined) queryState.page = 1;
        setKeyword(queryState.keyword);
        setPage(queryState.page);
        setPageSize(queryState.pageSize);
    };

    return {
        logs: query.data?.items || [],
        keyword,
        page,
        pageSize,
        total: query.data?.total || 0,
        isLoading: query.isFetching,
        searchLogs: (value = keyword) => updateFilters({ keyword: value }),
        changePage: (value: number) => updateFilters({ page: value }),
        changePageSize: (value: number) => updateFilters({ pageSize: value }),
        resetFilters: () => updateFilters({ keyword: "", page: 1, pageSize: defaultPageSize }),
        refreshLogs: () => query.refetch(),
    };
}
