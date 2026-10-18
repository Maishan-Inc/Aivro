import type { CSSProperties } from "react";
import styles from "./flow-background.module.css";

export function FlowBackground() {
    return <div className={styles.flow} aria-hidden="true">
        {[9, 29, 71, 91].map((position, index) => <div key={position} className={styles.vertical} style={{ left: `${position}%`, "--delay": `${index * -2.7}s`, "--duration": `${8 + index * 1.3}s` } as CSSProperties}><span /></div>)}
        {[23, 57, 87].map((position, index) => <div key={position} className={styles.horizontal} style={{ top: `${position}%`, "--delay": `${index * -3.7}s`, "--duration": `${10 + index * 1.4}s` } as CSSProperties}><span /></div>)}
        <div className={styles.clearance} />
    </div>;
}
