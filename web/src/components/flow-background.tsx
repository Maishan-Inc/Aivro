import type { CSSProperties } from "react";
import styles from "./flow-background.module.css";

export function FlowBackground() {
    return <div className={styles.flow} aria-hidden="true">
        <div className={styles.grid} />
        {[8, 22, 50, 78, 92].map((position, index) => <div key={position} className={styles.vertical} style={{ left: `${position}%`, "--delay": `${index * -3.4}s`, "--duration": `${12 + index}s` } as CSSProperties}><span /></div>)}
        {[18, 50, 82].map((position, index) => <div key={position} className={styles.horizontal} style={{ top: `${position}%`, "--delay": `${index * -4.7}s`, "--duration": `${15 + index}s` } as CSSProperties}><span /></div>)}
        {[8, 22, 78, 92].map((position) => <i key={position} className={styles.cross} style={{ left: `${position}%` }}>+</i>)}
        <div className={styles.clearance} />
    </div>;
}
