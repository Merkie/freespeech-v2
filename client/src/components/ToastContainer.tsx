import { For } from 'solid-js';
import { cn } from '@/lib/cn';
import { toasts } from '@/lib/toast';

export default function ToastContainer() {
	return (
		<div class="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
			<For each={toasts()}>
				{(toast) => (
					<div
						class={cn('rounded-lg px-4 py-2 text-sm font-medium shadow-lg', {
							'bg-blue-600 text-white': toast.type === 'info',
							'bg-green-600 text-white': toast.type === 'success',
							'bg-red-600 text-white': toast.type === 'error',
						})}
					>
						{toast.message}
					</div>
				)}
			</For>
		</div>
	);
}
