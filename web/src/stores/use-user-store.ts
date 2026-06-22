"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { AUTH_TOKEN_KEY, COOKIE_SESSION_TOKEN, fetchCurrentUser, login, logout, register, type AuthPayload, type AuthUser } from "@/services/api/auth";

type UserStore = {
    token: string;
    user: AuthUser | null;
    isReady: boolean;
    isLoading: boolean;
    setSession: (token: string, user: AuthUser) => void;
    clearSession: () => void;
    hydrateUser: () => Promise<void>;
    login: (payload: AuthPayload) => Promise<AuthUser>;
    register: (payload: AuthPayload) => Promise<AuthUser>;
};

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            token: "",
            user: null,
            isReady: false,
            isLoading: false,
            setSession: (_token, user) => set({ token: COOKIE_SESSION_TOKEN, user, isReady: true }),
            clearSession: () => {
                void logout().catch(() => undefined);
                set({ token: "", user: null, isReady: true });
            },
            hydrateUser: async () => {
                const token = get().token;
                set({ isLoading: true });
                try {
                    const user = await fetchCurrentUser(token || undefined);
                    if (user.role === "guest") {
                        set({ token: "", user: null, isReady: true, isLoading: false });
                        return;
                    }
                    set({ token: COOKIE_SESSION_TOKEN, user, isReady: true, isLoading: false });
                } catch {
                    set({ token: "", user: null, isReady: true, isLoading: false });
                }
            },
            login: async (payload) => {
                set({ isLoading: true });
                try {
                    const session = await login(payload);
                    set({ token: COOKIE_SESSION_TOKEN, user: session.user, isReady: true, isLoading: false });
                    return session.user;
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },
            register: async (payload) => {
                set({ isLoading: true });
                try {
                    const session = await register(payload);
                    set({ token: COOKIE_SESSION_TOKEN, user: session.user, isReady: true, isLoading: false });
                    return session.user;
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },
        }),
        {
            name: AUTH_TOKEN_KEY,
            partialize: (state) => ({ token: state.token ? COOKIE_SESSION_TOKEN : "" }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.token = state.token ? COOKIE_SESSION_TOKEN : "";
                    state.isReady = false;
                }
            },
        },
    ),
);
