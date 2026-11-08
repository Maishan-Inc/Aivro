import { Unzip, UnzipInflate, zipSync } from "fflate";

type ZipFile = {
    name: string;
    data: BlobPart;
};

export async function createZip(files: ZipFile[]) {
    const entries = await Promise.all(
        files.map(async (file) => {
            const data = new Uint8Array(await new Blob([file.data]).arrayBuffer());
            return [file.name, data] as const;
        }),
    );
    return new Blob([zipSync(Object.fromEntries(entries), { level: 0 })], { type: "application/zip" });
}

export async function readZip(file: Blob) {
    const limitError = () => new Error("素材包超过大小或数量限制");
    if (file.size > 128 * 1024 * 1024) throw limitError();
    const entries = new Map<string, Blob>();
    const names = new Set<string>();
    let totalBytes = 0;
    let fileCount = 0;
    const unzip = new Unzip((entry) => {
        if (names.size >= 512 || (entry.originalSize || 0) > 64 * 1024 * 1024) throw limitError();
        const name = entry.name;
        if (!name || name.length > 1024 || /[\\:\x00-\x1f]/.test(name) || name.startsWith("/") || name.replace(/\/$/, "").split("/").some((part) => !part || part === "." || part === "..") || names.has(name)) throw new Error("素材包格式无效");
        names.add(name);
        if (name.endsWith("/")) return;
        fileCount++;
        const chunks: BlobPart[] = [];
        let bytes = 0;
        entry.ondata = (error, data, final) => {
            if (error) throw error;
            bytes += data.length;
            totalBytes += data.length;
            if (bytes > 64 * 1024 * 1024 || totalBytes > 256 * 1024 * 1024) { entry.terminate(); throw limitError(); }
            chunks.push(new Uint8Array(data));
            if (final) entries.set(name, new Blob(chunks));
        };
        entry.start();
    });
    unzip.register(UnzipInflate);
    const reader = file.stream().getReader();
    let chunkCount = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            for (let offset = 0; offset < value.length; offset += 4096) {
                unzip.push(value.subarray(offset, offset + 4096));
                if (++chunkCount % 64 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        unzip.push(new Uint8Array(), true);
        if (entries.size !== fileCount) throw new Error("素材包格式无效");
        return entries;
    } finally {
        await reader.cancel();
        reader.releaseLock();
    }
}
