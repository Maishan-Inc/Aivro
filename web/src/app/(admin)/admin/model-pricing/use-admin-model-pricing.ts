"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "antd";

import { fetchAdminSettings, saveAdminSettings, type AdminModelCost, type AdminSettings } from "@/services/api/admin";
import { syncModelCostsWithPublicModels } from "@/lib/model-pricing";
import { useUserStore } from "@/stores/use-user-store";

// 模型定价页的数据读写。计费数据仍保存在 public.modelChannel.modelCosts，
// 这里只负责把它和渠道模型、前台开放模型对齐后交给页面编辑。
export function useAdminModelPricing() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [rows, setRows] = useState<AdminModelCost[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const settingsRef = useRef<AdminSettings | null>(null);

    const applySettings = useCallback((data: AdminSettings) => {
        settingsRef.current = data;
        setSettings(data);
        setRows(syncModelCostsWithPublicModels(data.public.modelChannel.modelCosts || [], data.public.modelChannel.availableModels || [], data.private.channels || []));
    }, []);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            applySettings(await fetchAdminSettings(token));
            setDirty(false);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型定价失败");
        } finally {
            setIsLoading(false);
        }
    }, [applySettings, message, token]);

    useEffect(() => {
        void load();
    }, [load]);

    const updateRow = useCallback((key: string, patch: Partial<AdminModelCost>) => {
        setRows((current) => current.map((item) => (item.modelId || item.model) === key ? { ...item, ...patch } : item));
        setDirty(true);
    }, []);

    const updateAllRows = useCallback((patch: Partial<AdminModelCost>) => {
        setRows((current) => current.map((item) => ({ ...item, ...patch })));
        setDirty(true);
    }, []);

    const save = useCallback(async () => {
        const base = settingsRef.current;
        if (!token || !base) return;
        setIsSaving(true);
        try {
            const saved = await saveAdminSettings(token, {
                ...base,
                public: { ...base.public, modelChannel: { ...base.public.modelChannel, modelCosts: rows } },
            });
            applySettings(saved);
            setDirty(false);
            message.success("已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setIsSaving(false);
        }
    }, [applySettings, message, rows, token]);

    return { settings, rows, isLoading, isSaving, dirty, load, save, updateRow, updateAllRows };
}
