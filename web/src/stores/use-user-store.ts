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
    hydrateUser: (force?: boolean) => Promise<void>;
    login: (payload: AuthPayload) => Promise<AuthUser>;
    register: (payload: AuthPayload) => Promise<AuthUser>;
};

let sessionVersion = 0;
let hydrationVersion = 0;
let pendingLogout: Promise<unknown> = Promise.resolve();
let userLoadedAt = 0;
let userRequest: { version: number; promise: Promise<void> } | null = null;

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            token: "",
            user: null,
            isReady: false,
            isLoading: false,
            setSession: (_token, user) => {
                sessionVersion++;
                userLoadedAt = Date.now();
                set({ token: COOKIE_SESSION_TOKEN, user, isReady: true, isLoading: false });
            },
            clearSession: () => {
                sessionVersion++;
                userLoadedAt = 0;
                pendingLogout = logout().catch(() => undefined);
                set({ token: "", user: null, isReady: true, isLoading: false });
            },
            hydrateUser: (force = true) => {
                const version = sessionVersion;
                if (!force && userRequest?.version === version) return userRequest.promise;
                if (!force && get().isReady && Date.now() - userLoadedAt < 30_000) return Promise.resolve();
                const hydration = ++hydrationVersion;
                const token = get().token;
                set({ isLoading: true });
                const promise = (async () => {
                    try {
                        await pendingLogout;
                        if (version !== sessionVersion || hydration !== hydrationVersion) return;
                        const user = await fetchCurrentUser(token || undefined);
                        if (version !== sessionVersion || hydration !== hydrationVersion) return;
                        userLoadedAt = Date.now();
                        if (user.role === "guest") {
                            set({ token: "", user: null, isReady: true, isLoading: false });
                            return;
                        }
                        set({ token: COOKIE_SESSION_TOKEN, user, isReady: true, isLoading: false });
                    } catch {
                        if (version !== sessionVersion || hydration !== hydrationVersion) return;
                        userLoadedAt = 0;
                        set({ token: "", user: null, isReady: true, isLoading: false });
                    }
                })().finally(() => {
                    if (userRequest?.promise === promise) userRequest = null;
                });
                userRequest = { version, promise };
                return promise;
            },
            login: async (payload) => {
                const version = ++sessionVersion;
                set({ isLoading: true });
                try {
                    await pendingLogout;
                    if (version !== sessionVersion) throw new Error("登录状态已变化，请重试");
                    const session = await login(payload);
                    if (version !== sessionVersion) throw new Error("登录状态已变化，请重试");
                    userLoadedAt = Date.now();
                    set({ token: COOKIE_SESSION_TOKEN, user: session.user, isReady: true, isLoading: false });
                    return session.user;
                } catch (error) {
                    if (version === sessionVersion) set({ isLoading: false });
                    throw error;
                }
            },
            register: async (payload) => {
                const version = ++sessionVersion;
                set({ isLoading: true });
                try {
                    await pendingLogout;
                    if (version !== sessionVersion) throw new Error("登录状态已变化，请重试");
                    const session = await register(payload);
                    if (version !== sessionVersion) throw new Error("登录状态已变化，请重试");
                    userLoadedAt = Date.now();
                    set({ token: COOKIE_SESSION_TOKEN, user: session.user, isReady: true, isLoading: false });
                    return session.user;
                } catch (error) {
                    if (version === sessionVersion) set({ isLoading: false });
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
