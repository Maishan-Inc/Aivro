"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App } from "antd";

import { fetchAdminRequestLogs } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";
import { adminRealtimeQueryOptions } from "../admin-query-options";

const defaultPageSize = 10;

export function useAdminRequestLogs() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const clearSession = useUserStore((state) => state.clearSession);
    const [keyword, setKeyword] = useState("");
    const [category, setCategory] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const query = useQuery({
        queryKey: ["admin", "request-logs", token, keyword, category, startTime, endTime, page, pageSize],
        queryFn: () => fetchAdminRequestLogs(token, { keyword, category, startTime, endTime, page, pageSize }),
        enabled: Boolean(token),
        retry: false,
        ...adminRealtimeQueryOptions,
    });

    useEffect(() => {
        if (query.isError) {
            const errorMessage = query.error instanceof Error ? query.error.message : "读取请求日志失败";
            message.error(errorMessage);
            if (errorMessage.includes("未登录") || errorMessage.includes("权限不足") || errorMessage.includes("登录状态无效")) clearSession();
        }
    }, [clearSession, message, query.error, query.isError]);

    const updateFilters = (next: Partial<{ keyword: string; category: string; startTime: string; endTime: string; page: number; pageSize: number }>) => {
        const queryState = { keyword, category, startTime, endTime, page, pageSize, ...next };
        if (next.keyword !== undefined || next.category !== undefined || next.startTime !== undefined || next.endTime !== undefined || next.pageSize !== undefined) queryState.page = 1;
        setKeyword(queryState.keyword);
        setCategory(queryState.category);
        setStartTime(queryState.startTime);
        setEndTime(queryState.endTime);
        setPage(queryState.page);
        setPageSize(queryState.pageSize);
    };

    return {
        logs: query.data?.items || [],
        keyword,
        category,
        startTime,
        endTime,
        page,
        pageSize,
        total: query.data?.total || 0,
        isLoading: query.isFetching,
        searchLogs: (value = keyword, nextCategory = category, nextStartTime = startTime, nextEndTime = endTime) => updateFilters({ keyword: value, category: nextCategory, startTime: nextStartTime, endTime: nextEndTime }),
        changePage: (value: number) => updateFilters({ page: value }),
        changePageSize: (value: number) => updateFilters({ pageSize: value }),
        resetFilters: () => updateFilters({ keyword: "", category: "", startTime: "", endTime: "", page: 1, pageSize: defaultPageSize }),
        refreshLogs: () => query.refetch(),
        setKeyword,
        setCategory,
        setStartTime,
        setEndTime,
    };
}
