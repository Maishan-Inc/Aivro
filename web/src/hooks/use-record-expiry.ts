"use client";

import { useEffect } from "react";

export function useRecordExpiry(record: { expiresAt: string } | null, onExpire: (value: null) => void) {
    useEffect(() => {
        if (!record) return;
        let timer = 0;
        const check = () => {
            const delay = Date.parse(record.expiresAt) - Date.now();
            if (delay <= 0) onExpire(null);
            else timer = window.setTimeout(check, Math.min(2147483647, delay));
        };
        check();
        return () => window.clearTimeout(timer);
    }, [record, onExpire]);
}
