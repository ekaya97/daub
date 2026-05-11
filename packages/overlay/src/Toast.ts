let currentToast: HTMLDivElement | null = null;

export function showToast(
  shadow: ShadowRoot,
  message: string,
  type: 'success' | 'error' | 'warning' = 'success',
): void {
  // Remove existing toast
  if (currentToast) {
    currentToast.remove();
    currentToast = null;
  }

  const toast = document.createElement('div');
  toast.className = `daub-toast ${type}`;
  toast.textContent = message;

  shadow.appendChild(toast);
  currentToast = toast;

  // Auto-dismiss after 2.5s
  setTimeout(() => {
    if (currentToast === toast) {
      toast.style.animation = 'daub-toast-out 0.2s ease-in forwards';
      setTimeout(() => {
        if (currentToast === toast) {
          toast.remove();
          currentToast = null;
        }
      }, 200);
    }
  }, 2500);
}
