const children = [
    {
        name: "api",
        command: ["/app/server"],
        cwd: "/app",
        env: { ...process.env, PORT: "8080" },
    },
    {
        name: "web",
        command: ["bun", "run", "start"],
        cwd: "/app/web",
        env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: "3000" },
    },
].map((item) => ({
    ...item,
    process: Bun.spawn({
        cmd: item.command,
        cwd: item.cwd,
        env: item.env,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    }),
}));

let shuttingDown = false;

async function stopAll(exitCode) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
        try {
            child.process.kill("SIGTERM");
        } catch {
            // Process may already be gone.
        }
    }
    const forceExit = setTimeout(() => {
        for (const child of children) {
            try {
                child.process.kill("SIGKILL");
            } catch {
                // Process may already be gone.
            }
        }
        process.exit(exitCode);
    }, 8000);
    forceExit.unref?.();
    await Promise.allSettled(children.map((child) => child.process.exited));
    clearTimeout(forceExit);
    process.exit(exitCode);
}

for (const child of children) {
    child.process.exited.then((exitCode) => {
        if (shuttingDown) return;
        console.error(`[entrypoint] ${child.name} exited with code ${exitCode}`);
        void stopAll(exitCode || 1);
    });
}

process.on("SIGINT", () => void stopAll(130));
process.on("SIGTERM", () => void stopAll(143));
