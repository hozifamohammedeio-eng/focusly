import type { ReactNode } from "react";
import styles from "./transition.module.css";

export default function AppTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.page}>{children}</div>;
}