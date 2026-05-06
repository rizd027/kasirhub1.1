"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AlertConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  cancelText?: string
  confirmText?: string
  onConfirm: () => void
  variant?: "default" | "destructive"
}

export function AlertConfirm({
  open,
  onOpenChange,
  title,
  description,
  cancelText = "Batal",
  confirmText = "Ya, Hapus",
  onConfirm,
  variant = "destructive"
}: AlertConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[320px] rounded-2xl p-6 gap-6 border-none shadow-2xl shadow-indigo-100/50 duration-0 animate-none data-[state=open]:animate-none data-[state=closed]:animate-none" 
        showCloseButton={false}
        overlayClassName="bg-slate-900/40 backdrop-blur-[2px] duration-0 animate-none data-[state=open]:animate-none data-[state=closed]:animate-none"
      >
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl font-black text-center tracking-tight text-slate-800">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-center text-slate-500 font-medium text-xs leading-relaxed px-2">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          <Button 
            variant={variant === "destructive" ? "destructive" : "default"}
            className={cn(
              "h-12 font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95",
              variant === "destructive" 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-100" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
            )}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmText}
          </Button>
          <Button 
            variant="ghost"
            className="h-10 font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 uppercase tracking-[0.2em] text-[9px] rounded-xl transition-all"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
