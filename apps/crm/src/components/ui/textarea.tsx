import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onChange, onBlur, ...props }, ref) => {
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value.toUpperCase();
    const nextEvent = {
      ...event,
      target: { ...event.target, value },
      currentTarget: { ...event.currentTarget, value },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange?.(nextEvent);
  };
  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    const value = event.target.value.toUpperCase();
    const nextEvent = { ...event, target: { ...event.target, value }, currentTarget: { ...event.currentTarget, value } } as React.FocusEvent<HTMLTextAreaElement>;
    onChange?.(nextEvent as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    onBlur?.(event);
  };
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      onChange={handleChange}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
