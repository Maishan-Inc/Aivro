import { QueryClient } from "@tanstack/react-query";

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: 600_000,
                retry: false,
                refetchOnWindowFocus: false,
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
    if (typeof window === "undefined") return createQueryClient();
    return browserQueryClient ??= createQueryClient();
}
