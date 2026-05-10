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
  toast.style.animation = 'slideUp 0.2s ease-out';

  shadow.appendChild(toast);
  currentToast = toast;

  // Auto-dismiss after 2.5s
  setTimeout(() => {
    if (currentToast === toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(16px)';
      toast.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => {
        if (currentToast === toast) {
          toast.remove();
          currentToast = null;
        }
      }, 200);
    }
  }, 2500);
}
