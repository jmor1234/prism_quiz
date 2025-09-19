"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number; // px
  height: number; // px viewport
  overscan?: number; // items
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
}

export function VirtualizedList<T>({ items, itemHeight, height, overscan = 6, renderItem, keyExtractor }: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const total = items.length;
  const viewportItems = Math.ceil(height / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(total - 1, startIndex + viewportItems + overscan * 2);
  const offsetY = startIndex * itemHeight;

  const visible = useMemo(() => items.slice(startIndex, endIndex + 1), [items, startIndex, endIndex]);

  return (
    <div ref={containerRef} className="overflow-auto" style={{ height }}>
      <div style={{ height: total * itemHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visible.map((item, i) => (
            <React.Fragment key={keyExtractor ? keyExtractor(item, startIndex + i) : startIndex + i}>
              {renderItem(item, startIndex + i)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedList;


