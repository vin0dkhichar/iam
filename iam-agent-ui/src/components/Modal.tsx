"use client";

import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export default function Modal({ title, onClose, children, width = "600" }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-h-[80vh] w-full rounded-[10px] border-4 border-[#EABB13] bg-white p-8 shadow-lg"
        style={{ maxWidth: `${width}px` }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[22px] font-bold text-[#ED7C22]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[28px] leading-none text-gray-500 hover:text-gray-800"
          >
            ×
          </button>
        </div>
        <div className="modal-scroll max-h-[calc(80vh-120px)] overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  );
}
