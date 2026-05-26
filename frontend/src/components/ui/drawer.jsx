import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;
const DrawerPortal = DialogPrimitive.Portal;

const DrawerOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
));
DrawerOverlay.displayName = "DrawerOverlay";

const DrawerContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-full max-w-md rounded-l-3xl border border-cream bg-white p-6 shadow-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DrawerClose className="absolute right-4 top-4 rounded-full p-1 text-[#5C5C5C] transition hover:bg-[#F2F0ED] focus:outline-none focus:ring-2 focus:ring-moss">
        <X className="h-4 w-4" />
      </DrawerClose>
    </DialogPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-4 flex flex-col gap-2", className)} {...props} />
));
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-4 flex justify-end gap-2", className)} {...props} />
));
DrawerFooter.displayName = "DrawerFooter";

export { Drawer, DrawerTrigger, DrawerContent, DrawerClose, DrawerHeader, DrawerFooter };
