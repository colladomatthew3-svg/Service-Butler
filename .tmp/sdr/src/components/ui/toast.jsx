"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToastProvider = ToastProvider;
exports.useToast = useToast;
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const cn_1 = require("@/lib/utils/cn");
const ToastContext = (0, react_1.createContext)(null);
function ToastProvider({ children }) {
    const [toasts, setToasts] = (0, react_1.useState)([]);
    const value = (0, react_1.useMemo)(() => ({
        showToast(title) {
            const id = Date.now() + Math.floor(Math.random() * 1000);
            setToasts((prev) => [...prev, { id, title }]);
            setTimeout(() => {
                setToasts((prev) => prev.filter((toast) => toast.id !== id));
            }, 2200);
        }
    }), []);
    return (<ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
        <div className="w-full max-w-md space-y-2">
          {toasts.map((toast) => (<div key={toast.id} className={(0, cn_1.cn)("animate-[toast-in_220ms_ease-out] flex items-center gap-2 rounded-xl border border-semantic-border bg-semantic-surface px-4 py-3 shadow-card", "text-sm font-medium text-semantic-text")}>
              <lucide_react_1.CheckCircle2 className="h-4 w-4 text-success-500"/>
              {toast.title}
            </div>))}
        </div>
      </div>
    </ToastContext.Provider>);
}
function useToast() {
    const ctx = (0, react_1.useContext)(ToastContext);
    if (!ctx)
        throw new Error("useToast must be used within ToastProvider");
    return ctx;
}
