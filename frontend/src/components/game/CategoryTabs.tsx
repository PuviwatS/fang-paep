import { CATEGORIES } from "@/lib/constants";
import type { Category } from "@/lib/types";
import styles from "./CategoryTabs.module.css";

interface CategoryTabsProps {
  value: Category;
  onChange: (category: Category) => void;
}

export function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="หมวดเพลง">
      {CATEGORIES.map((category) => {
        const isActive = category.key === value;
        return (
          <button
            key={category.key}
            className={isActive ? `${styles.tab} ${styles.active}` : styles.tab}
            onClick={() => onChange(category.key)}
            aria-pressed={isActive}
          >
            {category.label}
          </button>
        );
      })}
    </nav>
  );
}
