"use client";

import { type CSSProperties, useEffect, useId, useRef } from "react";
import { Globe2 } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import homeStyles from "./home.module.css";
import styles from "./home-network.module.css";

const cities = [
    { name: "北京", lon: 116.4, lat: 39.9, label: [9, -10] },
    { name: "成都", lon: 104.1, lat: 30.6, label: [-10, -7] },
    { name: "上海", lon: 121.5, lat: 31.2, label: [10, 4] },
    { name: "台北", lon: 121.6, lat: 25 },
    { name: "东京", lon: 139.7, lat: 35.7, label: [10, -7] },
    { name: "大阪", lon: 135.5, lat: 34.7 },
    { name: "首尔", lon: 127, lat: 37.6 },
    { name: "新加坡", lon: 103.8, lat: 1.4, label: [-10, 18] },
    { name: "曼谷", lon: 100.5, lat: 13.8 },
    { name: "胡志明市", lon: 106.7, lat: 10.8 },
    { name: "吉隆坡", lon: 101.7, lat: 3.1 },
    { name: "雅加达", lon: 106.8, lat: -6.2 },
    { name: "孟买", lon: 72.9, lat: 19.1 },
    { name: "新德里", lon: 77.2, lat: 28.6 },
    { name: "伦敦", lon: -0.1, lat: 51.5, label: [-10, -12] },
    { name: "巴黎", lon: 2.4, lat: 48.9 },
    { name: "法兰克福", lon: 8.7, lat: 50.1 },
    { name: "阿姆斯特丹", lon: 4.9, lat: 52.4 },
    { name: "苏黎世", lon: 8.5, lat: 47.4 },
    { name: "马德里", lon: -3.7, lat: 40.4 },
    { name: "米兰", lon: 9.2, lat: 45.5 },
    { name: "斯德哥尔摩", lon: 18.1, lat: 59.3 },
    { name: "华沙", lon: 21, lat: 52.2 },
    { name: "旧金山", lon: -122.4, lat: 37.8, label: [-10, -8] },
    { name: "洛杉矶", lon: -118.2, lat: 34.1 },
    { name: "西雅图", lon: -122.3, lat: 47.6 },
    { name: "纽约", lon: -74, lat: 40.7, label: [10, 5] },
    { name: "芝加哥", lon: -87.6, lat: 41.9 },
    { name: "达拉斯", lon: -96.8, lat: 32.8 },
    { name: "多伦多", lon: -79.4, lat: 43.7 },
    { name: "温哥华", lon: -123.1, lat: 49.3 },
    { name: "墨西哥城", lon: -99.1, lat: 19.4 },
    { name: "圣保罗", lon: -46.6, lat: -23.6, label: [10, 6] },
    { name: "圣地亚哥", lon: -70.7, lat: -33.5 },
    { name: "布宜诺斯艾利斯", lon: -58.4, lat: -34.6 },
    { name: "波哥大", lon: -74.1, lat: 4.7 },
    { name: "迪拜", lon: 55.3, lat: 25.2, label: [-10, 18] },
    { name: "利雅得", lon: 46.7, lat: 24.7 },
    { name: "约翰内斯堡", lon: 28, lat: -26.2, label: [10, 18] },
    { name: "内罗毕", lon: 36.8, lat: -1.3 },
    { name: "拉各斯", lon: 3.4, lat: 6.5 },
    { name: "悉尼", lon: 151.2, lat: -33.9, label: [-10, 18] },
    { name: "奥克兰", lon: 174.8, lat: -36.8 },
];
const project = (lon: number, lat: number) => ({ x: +(540 + lon * 3).toFixed(1), y: +(300 - lat * 3).toFixed(1) });
const hongKong = project(114.2, 22.3);
const routes = cities.map((city, index) => {
    const point = project(city.lon, city.lat);
    const distance = Math.hypot(point.x - hongKong.x, point.y - hongKong.y);
    const top = Math.max(20, Math.min(point.y, hongKong.y) - Math.max(26, distance * .28));
    return { ...city, ...point, path: `M${hongKong.x},${hongKong.y} Q${((hongKong.x + point.x) / 2).toFixed(1)},${top.toFixed(1)} ${point.x},${point.y}`, duration: 5 + distance / 220, delay: -(index * .57) };
});

export function HomeNetwork() {
    const id = useId();
    const { tr } = useI18n();
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const center = () => { map.scrollLeft = Math.max(0, map.scrollWidth * hongKong.x / 1080 - map.clientWidth / 2); };
        const observer = new ResizeObserver(center);
        observer.observe(map);
        center();
        return () => observer.disconnect();
    }, []);

    return <section id="network" className={styles.network} aria-labelledby="network-title" data-reveal>
        <div className={`${homeStyles.discoveryHeading} ${styles.heading}`}>
            <div><span className={homeStyles.eyebrow}>灵感不止于此</span><h2 id="network-title">从香港连接世界</h2></div>
            <p>跨越时区，让创作在世界各地发生。</p>
        </div>
        <div ref={mapRef} className={styles.map} data-native-scroll tabIndex={0} aria-label="世界连线地图，可左右滑动查看">
            <svg viewBox="0 0 1080 560" role="img" aria-labelledby={`${id}-title ${id}-description`}>
                <title id={`${id}-title`}>{tr("从香港连接世界")}</title>
                <desc id={`${id}-description`}>{tr("香港出发，连接亚洲、北美、欧洲、南美、中东、非洲和大洋洲的城市；中国包括北京、成都和上海。")}</desc>
                <defs>
                    <mask id={`${id}-land`} maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="560"><image href="/world-map.svg" width="1080" height="560" /></mask>
                    <pattern id={`${id}-dots`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".85" fill="currentColor" /></pattern>
                    <radialGradient id={`${id}-glow`}><stop stopColor="currentColor" stopOpacity=".09" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></radialGradient>
                </defs>
                <ellipse cx={hongKong.x} cy={hongKong.y} rx="200" ry="150" fill={`url(#${id}-glow)`} />
                <g mask={`url(#${id}-land)`}><rect width="1080" height="560" fill="currentColor" opacity=".025" /><rect width="1080" height="560" fill={`url(#${id}-dots)`} opacity=".32" /></g>
                <g className={styles.routes} fill="none" stroke="currentColor" strokeWidth=".7">{routes.map((city) => <path key={city.name} d={city.path} />)}</g>
                {routes.map((city) => <g key={city.name} style={{ "--duration": `${city.duration}s`, "--delay": `${city.delay}s` } as CSSProperties}>
                    <circle className={styles.packet} r="2" fill="currentColor" style={{ offsetPath: `path("${city.path}")` }} />
                    <circle className={styles.ripple} cx={city.x} cy={city.y} r="3" fill="none" stroke="currentColor" strokeWidth=".7" />
                    <circle cx={city.x} cy={city.y} r={city.label ? 2.5 : 1.8} fill="currentColor" className={styles.city}><title>{tr(city.name)}</title></circle>
                    {city.label ? <text x={city.x + city.label[0]} y={city.y + city.label[1]} textAnchor={city.label[0] < 0 ? "end" : "start"} className={styles.cityLabel}>{tr(city.name)}</text> : null}
                </g>)}
                <g>
                    <circle className={styles.originPulse} cx={hongKong.x} cy={hongKong.y} r="8" fill="none" stroke="currentColor" />
                    <circle cx={hongKong.x} cy={hongKong.y} r="6" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx={hongKong.x} cy={hongKong.y} r="2.5" fill="currentColor" />
                    <path d={`M${hongKong.x},${hongKong.y + 10} v16 h10`} fill="none" stroke="currentColor" strokeWidth=".7" />
                    <text x={hongKong.x + 15} y={hongKong.y + 30} className={styles.originLabel}>{tr("香港")}</text>
                </g>
            </svg>
        </div>
        <div className={styles.legend}>
            <span className={styles.departure}><Globe2 size={15} strokeWidth={1.5} />香港出发</span>
            <span>亚洲 · 北美 · 欧洲 · 南美 · 中东 · 非洲 · 大洋洲</span>
            <span>中国 · 北京 / 成都 / 上海</span>
        </div>
    </section>;
}
