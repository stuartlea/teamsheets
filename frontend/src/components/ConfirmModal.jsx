import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6 shadow-2xl relative transform transition-all scale-100">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex gap-4">
                    <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isDestructive ? 'bg-red-900/20 text-red-500' : 'bg-blue-900/20 text-blue-500'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors text-sm"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2 rounded-lg font-bold text-white transition-colors text-sm shadow-lg ${
                            isDestructive 
                            ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
