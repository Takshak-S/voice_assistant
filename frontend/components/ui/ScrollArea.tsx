'use client';

import { forwardRef, HTMLAttributes, useRef, useEffect, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };

    useImperativeHandle(ref, () => ({
      ...scrollRef.current,
      scrollToBottom,
    } as HTMLDivElement & { scrollToBottom: () => void }));

    useEffect(() => {
      scrollToBottom();
    }, [children]);

    return (
      <div
        ref={scrollRef}
        className={cn('scrollbar-hide overflow-y-auto', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';